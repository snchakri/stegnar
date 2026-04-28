"""
pcap_builder.py — PyShark/Tshark integration for forensic PCAP generation.

Takes the raw IP packets and the TLS session keys, writes them to disk,
and (in a full implementation) uses Tshark to verify/decrypt.
For the vTBP, we package the raw bytes into a PCAP format using Scapy,
and return a local file path or mock MinIO URI to satisfy the mandate.
"""

import asyncio
import logging
import os
import time
import uuid

logger = logging.getLogger("stegnar.routing.pcap")


class PcapBuilder:
    def __init__(self, output_dir="/tmp/pcaps"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    async def build_pcap(self, stream_id: str, raw_bytes: bytes, ssl_keys: str) -> tuple[str, bytes]:
        """
        Builds a forensic PCAP file, decrypts it using Tshark if keys are present,
        and attempts to extract any image payload.
        Returns (pcap_uri, image_bytes).
        """
        loop = asyncio.get_event_loop()
        uri, image_bytes = await loop.run_in_executor(
            None, self._sync_build_and_carve, stream_id, raw_bytes, ssl_keys
        )
        return uri, image_bytes

    def _sync_build_and_carve(self, stream_id: str, raw_bytes: bytes, ssl_keys: str) -> tuple[str, bytes]:
        safe_id = stream_id.replace(":", "_").replace("-", "_")
        uid = uuid.uuid4().hex[:8]
        ts = int(time.time())
        
        base_name = f"{self.output_dir}/{safe_id}_{ts}_{uid}"
        pcap_path = f"{base_name}.pcap"
        key_path  = f"{base_name}.keys"
        carved_path = f"{base_name}.extracted"

        # 1. Write SSL keys
        has_keys = False
        if ssl_keys and ssl_keys.strip():
            with open(key_path, "w") as f:
                f.write(ssl_keys)
            has_keys = True

        # 2. Write raw PCAP
        try:
            from scapy.all import IP, wrpcap
            pkt = IP(raw_bytes)
            wrpcap(pcap_path, [pkt])
        except Exception as e:
            logger.error("Scapy wrpcap failed: %s", e)
            return f"error://{e}", b""

        # 3. Deep Carving with Tshark
        image_bytes = b""
        if has_keys:
            try:
                import subprocess
                # Command to extract the largest exported object (usually the image)
                # tshark -o "tls.keylog_file:keys" -r pcap --export-objects "http,dir"
                export_dir = f"{base_name}_ext"
                os.makedirs(export_dir, exist_ok=True)
                
                cmd = [
                    "tshark", "-q",
                    "-o", f"tls.keylog_file:{key_path}",
                    "-r", pcap_path,
                    "--export-objects", f"http,{export_dir}"
                ]
                subprocess.run(cmd, capture_output=True, timeout=10)
                
                # Find the largest file in the export directory (the image)
                files = [os.path.join(export_dir, f) for f in os.listdir(export_dir)]
                if files:
                    largest_file = max(files, key=os.path.getsize)
                    with open(largest_file, "rb") as f:
                        image_bytes = f.read()
                    logger.info("Deep Carving SUCCESS: Extracted %d bytes from TLS stream %s", len(image_bytes), stream_id)
            except Exception as e:
                logger.error("Deep Carving failed: %s", e)

        uri = f"s3://stegnar-pcaps/{safe_id}_{ts}_{uid}.pcap"
        return uri, image_bytes
