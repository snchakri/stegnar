"""
pcap_builder.py — Forensic PCAP builder and deep-carver.

Strategy:
  1. Receive a list of raw IP packets from the stream.
  2. Write them to a PCAP file using Scapy.
  3. Use Tshark to decrypt the TLS stream (if keys provided) and export HTTP objects.
  4. Extract the exported image file.
  5. Upload PCAP + image to MinIO.

Returns: (pcap_uri: str, image_uri: str, image_bytes: bytes)
"""

import asyncio
import logging
import os
import shutil
import subprocess
import time
import uuid

logger = logging.getLogger("stegnar.routing.pcap_builder")


class PcapBuilder:
    def __init__(self, output_dir: str = "/tmp/stegnar_pcaps"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)
        logger.info("[PcapBuilder] Initialized. output_dir=%s", self.output_dir)

    async def build_pcap(
        self,
        stream_id: str,
        raw_bytes: bytes,
        ssl_keys: str,
        is_list: bool = False,
        pkt_list: list = None,
    ) -> tuple:
        """
        Assembles a PCAP for forensic archiving and deep-carves any image payload.
        Returns (pcap_uri: str, image_uri: str, image_bytes: bytes).
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, self._sync_build, stream_id, raw_bytes, ssl_keys, is_list, pkt_list
        )
        return result

    def _sync_build(
        self,
        stream_id: str,
        raw_bytes: bytes,
        ssl_keys: str,
        is_list: bool,
        pkt_list: list,
    ) -> tuple:
        safe_id    = stream_id.replace(":", "_").replace("-", "_")
        uid        = uuid.uuid4().hex[:8]
        ts         = int(time.time())
        base       = f"{self.output_dir}/{safe_id}_{ts}_{uid}"
        pcap_path  = f"{base}.pcap"
        key_path   = f"{base}.keys"
        export_dir = f"{base}_ext"

        logger.debug(
            "[PcapBuilder] _sync_build stream=%s bytes=%d is_list=%s pkts=%d",
            stream_id, len(raw_bytes), is_list, len(pkt_list) if pkt_list else 0,
        )

        # Determine packet list
        packets = pkt_list if (is_list and pkt_list) else [raw_bytes]

        # ── 1. Write forensic PCAP ────────────────────────────────────────────
        pcap_written = False
        try:
            from scapy.all import IP, wrpcap
            scapy_pkts = []
            for p in packets:
                try:
                    # Only try to parse as IP if it starts with a valid IPv4 prefix (0x45).
                    if p and p[0] == 0x45:
                        scapy_pkts.append(IP(p))
                    else:
                        logger.debug(
                            "[PcapBuilder] Skipping non-IP bytes (first byte=0x%02x) stream=%s",
                            p[0] if p else 0, stream_id,
                        )
                except Exception as pkt_e:
                    logger.debug("[PcapBuilder] Packet parse error stream=%s: %s", stream_id, pkt_e)

            if scapy_pkts:
                wrpcap(pcap_path, scapy_pkts)
                pcap_written = True
                logger.info(
                    "[PcapBuilder] PCAP written: %s (%d packets)", pcap_path, len(scapy_pkts)
                )
            else:
                logger.info(
                    "[PcapBuilder] No valid IP packets found for stream=%s — "
                    "treating raw_bytes as direct image payload (%d bytes)",
                    stream_id, len(raw_bytes),
                )
                # Raw bytes are the image — upload directly, skip tshark
                return self._upload_direct_image(raw_bytes, safe_id, ts, uid, stream_id)

        except Exception as e:
            logger.error("[PcapBuilder] PCAP write failed for stream=%s: %s", stream_id, e)
            return "error://pcap_fail", "", b""

        # ── 2. Write SSL keys if present ──────────────────────────────────────
        has_keys = False
        if ssl_keys and ssl_keys.strip():
            try:
                with open(key_path, "w") as f:
                    f.write(ssl_keys)
                has_keys = True
                key_count = len([l for l in ssl_keys.split("\n") if l.strip()])
                logger.info("[PcapBuilder] TLS keys written for stream=%s: %d lines", stream_id, key_count)
            except Exception as e:
                logger.warning("[PcapBuilder] Failed to write SSL keys for stream=%s: %s", stream_id, e)

        # ── 3. Deep Carve with Tshark ─────────────────────────────────────────
        image_bytes = b""
        try:
            os.makedirs(export_dir, exist_ok=True)

            cmd = ["tshark", "-r", pcap_path]
            if has_keys:
                cmd.extend(["-o", f"tls.keylog_file:{key_path}"])
            cmd.extend(["--export-objects", f"http,{export_dir}"])

            logger.info(
                "[PcapBuilder] Running tshark cmd=%s", " ".join(cmd)
            )
            proc = subprocess.run(cmd, capture_output=True, timeout=15)

            if proc.returncode != 0:
                stderr_msg = proc.stderr.decode(errors="ignore")[:500]
                logger.warning(
                    "[PcapBuilder] tshark exited code=%d stream=%s stderr=%s",
                    proc.returncode, stream_id, stderr_msg,
                )
            else:
                logger.debug("[PcapBuilder] tshark completed OK for stream=%s", stream_id)

            if os.path.exists(export_dir):
                files = [os.path.join(export_dir, f) for f in os.listdir(export_dir)]
                if files:
                    largest_file = max(files, key=os.path.getsize)
                    fsize = os.path.getsize(largest_file)
                    if fsize > 1000:
                        with open(largest_file, "rb") as f:
                            image_bytes = f.read()
                        logger.info(
                            "[PcapBuilder] tshark carved %d bytes from stream=%s file=%s",
                            len(image_bytes), stream_id, os.path.basename(largest_file),
                        )
                    else:
                        logger.debug(
                            "[PcapBuilder] tshark exported only tiny files (%d bytes) from stream=%s",
                            fsize, stream_id,
                        )
                else:
                    logger.info(
                        "[PcapBuilder] tshark found no HTTP objects for stream=%s (keys=%s)",
                        stream_id, has_keys,
                    )

            if len(image_bytes) == 0:
                logger.info("[PcapBuilder] Fallback: attempting regex JPEG carve from raw stream...")
                start = raw_bytes.find(b"\xff\xd8\xff")
                if start != -1:
                    # Look for end of JPEG (there might be multiple \xff\xd9 in a stream, we want the last one or just assume the rest is jpeg)
                    # Actually, a simple rfind is better for single-image streams
                    end = raw_bytes.rfind(b"\xff\xd9")
                    if end != -1 and end > start:
                        image_bytes = raw_bytes[start:end+2]
                        logger.info("[PcapBuilder] Regex carved %d bytes from stream=%s", len(image_bytes), stream_id)

        except subprocess.TimeoutExpired:
            logger.error("[PcapBuilder] tshark TIMEOUT (15s) for stream=%s", stream_id)
        except Exception as e:
            logger.error("[PcapBuilder] tshark carving error for stream=%s: %s", stream_id, e)

        # ── 4. Upload to MinIO ────────────────────────────────────────────────
        pcap_uri  = ""
        image_uri = ""
        try:
            import minio_client as mc_mod
            mc = mc_mod.MinioClient()

            if pcap_written and os.path.exists(pcap_path):
                pcap_uri = mc.upload_file("stegnar-pcaps", pcap_path)
                if not pcap_uri:
                    pcap_uri = f"error://upload_failed/{os.path.basename(pcap_path)}"
                    logger.error("[PcapBuilder] PCAP upload failed for stream=%s", stream_id)

            if image_bytes:
                obj_name = f"{safe_id}_{ts}_{uid}.jpg"
                image_uri = mc.upload_bytes("stegnar-artifacts", image_bytes, obj_name)
                if not image_uri:
                    image_uri = f"error://upload_failed/{obj_name}"
                    logger.error("[PcapBuilder] Image upload failed for stream=%s", stream_id)
            else:
                logger.info(
                    "[PcapBuilder] No image bytes to upload for stream=%s", stream_id
                )

        except Exception as e:
            logger.error("[PcapBuilder] MinIO upload exception for stream=%s: %s", stream_id, e)
        finally:
            # ── 5. Cleanup temp files ──────────────────────────────────────────
            for path in [pcap_path, key_path]:
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except Exception as ce:
                        logger.debug("[PcapBuilder] Cleanup error removing %s: %s", path, ce)
            if os.path.exists(export_dir):
                try:
                    shutil.rmtree(export_dir)
                except Exception as ce:
                    logger.debug("[PcapBuilder] Cleanup error removing dir %s: %s", export_dir, ce)

        logger.info(
            "[PcapBuilder] Done stream=%s pcap_uri=%s image_uri=%s image_bytes=%d",
            stream_id, pcap_uri or "none", image_uri or "none", len(image_bytes),
        )
        return pcap_uri, image_uri, image_bytes

    def _upload_direct_image(
        self, raw_bytes: bytes, safe_id: str, ts: int, uid: str, stream_id: str
    ) -> tuple:
        """
        Upload raw image bytes directly to MinIO (no PCAP, no tshark).
        Used when endpoint injects pre-decrypted HTTPS image bytes.
        """
        image_uri = ""
        try:
            import minio_client as mc_mod
            mc = mc_mod.MinioClient()
            obj_name  = f"{safe_id}_{ts}_{uid}.jpg"
            image_uri = mc.upload_bytes("stegnar-artifacts", raw_bytes, obj_name)
            if image_uri:
                logger.info(
                    "[PcapBuilder] Direct image upload OK → %s (%d bytes) stream=%s",
                    image_uri, len(raw_bytes), stream_id,
                )
            else:
                image_uri = f"error://upload_failed/{obj_name}"
                logger.error(
                    "[PcapBuilder] Direct image upload FAILED stream=%s", stream_id
                )
        except Exception as e:
            logger.error(
                "[PcapBuilder] Direct image upload exception stream=%s: %s", stream_id, e
            )
        return "", image_uri, raw_bytes
