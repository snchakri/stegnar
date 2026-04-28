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

    async def build_pcap(self, stream_id: str, raw_bytes: bytes, ssl_keys: str) -> str:
        """
        Builds a forensic PCAP file from the raw bytes and saves the SSL keys alongside it.
        Returns the URI to the saved artifact (mocked as an s3:// URI for the data layer).
        """
        # Run disk IO in a background thread to avoid blocking asyncio loop
        loop = asyncio.get_event_loop()
        uri = await loop.run_in_executor(
            None, self._sync_build_pcap, stream_id, raw_bytes, ssl_keys
        )
        return uri

    def _sync_build_pcap(self, stream_id: str, raw_bytes: bytes, ssl_keys: str) -> str:
        safe_id = stream_id.replace(":", "_").replace("-", "_")
        uid = uuid.uuid4().hex[:8]
        ts = int(time.time())
        
        base_name = f"{self.output_dir}/{safe_id}_{ts}_{uid}"
        pcap_path = f"{base_name}.pcap"
        key_path  = f"{base_name}.keys"

        # Write SSL keys if present
        if ssl_keys and ssl_keys.strip():
            with open(key_path, "w") as f:
                f.write(ssl_keys)

        # Write raw bytes as PCAP using Scapy
        # Since we receive raw IP packets from the endpoint agent's sniffer
        try:
            from scapy.all import IP, wrpcap
            # Convert raw bytes back to an IP packet
            pkt = IP(raw_bytes)
            wrpcap(pcap_path, [pkt])
            logger.debug("Generated forensic PCAP: %s", pcap_path)
            
            # In a full deployment, this is where we'd invoke PyShark/Tshark 
            # to validate or dissect the decrypted payload:
            # e.g., tshark -r pcap_path -o tls.keylog_file:key_path -V
            
        except Exception as e:
            logger.error("Failed to build PCAP using Scapy: %s", e)
            # Fallback: just write raw bytes
            with open(pcap_path + ".raw", "wb") as f:
                f.write(raw_bytes)

        # Return a simulated MinIO URI for the data layer
        return f"s3://stegnar-pcaps/{safe_id}_{ts}_{uid}.pcap"
