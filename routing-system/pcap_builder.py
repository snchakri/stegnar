"""
pcap_builder.py — Forensic PCAP builder and deep-carver.

Strategy:
  1. Receive a list of raw IP packets from the stream.
  2. Write them to a PCAP file using Scapy.
  3. Use Tshark to decrypt the TLS stream (if keys provided) and export HTTP objects.
  4. Extract the exported image file.
"""

import asyncio
import logging
import os
import time
import uuid
import subprocess

logger = logging.getLogger("stegnar.routing.pcap_builder")

class PcapBuilder:
    def __init__(self, output_dir: str = "/tmp/stegnar_pcaps"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

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
        Returns (pcap_uri: str, image_bytes: bytes).
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
        safe_id   = stream_id.replace(":", "_").replace("-", "_")
        uid       = uuid.uuid4().hex[:8]
        ts        = int(time.time())
        base      = f"{self.output_dir}/{safe_id}_{ts}_{uid}"
        pcap_path = f"{base}.pcap"
        key_path  = f"{base}.keys"
        export_dir = f"{base}_ext"

        # Determine packet list
        packets = pkt_list if (is_list and pkt_list) else [raw_bytes]

        # 1. Write forensic PCAP
        try:
            from scapy.all import IP, wrpcap
            scapy_pkts = []
            for p in packets:
                try:
                    # Sniffer now sends IP bytes, so IP(p) is correct.
                    scapy_pkts.append(IP(p))
                except Exception:
                    pass
            if scapy_pkts:
                wrpcap(pcap_path, scapy_pkts)
        except Exception as e:
            logger.warning("PCAP write failed: %s", e)
            return f"error://pcap_fail", b""

        # 2. Write SSL keys if present
        has_keys = False
        if ssl_keys and ssl_keys.strip():
            with open(key_path, "w") as f:
                f.write(ssl_keys)
            has_keys = True
            key_count = len([l for l in ssl_keys.split("\n") if l.strip()])
            logger.info("TLS keys for stream %s: %d lines", stream_id, key_count)

        # 3. Deep Carve with Tshark
        image_bytes = b""
        try:
            os.makedirs(export_dir, exist_ok=True)
            
            # Basic Tshark command
            cmd = ["tshark", "-r", pcap_path]
            
            # Add TLS keys if we have them
            if has_keys:
                cmd.extend(["-o", f"tls.keylog_file:{key_path}"])
            
            # Export HTTP objects (Tshark handles decrypted TLS as HTTP)
            cmd.extend(["--export-objects", f"http,{export_dir}"])
            
            # Run Tshark
            # We use a timeout to avoid hanging on malformed pcaps
            proc = subprocess.run(cmd, capture_output=True, timeout=15)
            
            if proc.returncode != 0:
                logger.warning("Tshark exited with code %d: %s", proc.returncode, proc.stderr.decode(errors='ignore'))

            # Check export directory for images
            files = [os.path.join(export_dir, f) for f in os.listdir(export_dir)]
            if files:
                # Find the largest file (usually the image we're looking for)
                largest_file = max(files, key=os.path.getsize)
                if os.path.getsize(largest_file) > 1000: # Ignore tiny files/headers
                    with open(largest_file, "rb") as f:
                        image_bytes = f.read()
                    logger.info("Tshark SUCCESS: Carved %d bytes from stream %s", len(image_bytes), stream_id)
                else:
                    logger.debug("Tshark exported only small files from %s", stream_id)
            else:
                tshark_err = proc.stderr.decode(errors='ignore')[:400]
                logger.info("Tshark NO objects from %s (keys=%s). stderr: %s", stream_id, has_keys, tshark_err)

        except Exception as e:
            logger.error("Tshark carving failed for %s: %s", stream_id, e)

        uri = f"s3://stegnar-pcaps/{safe_id}_{ts}_{uid}.pcap"
        return uri, image_bytes
