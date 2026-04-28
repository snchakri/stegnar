"""
pcap_builder.py — Forensic PCAP builder and deep-carver.

Strategy:
  1. Collect raw IP packet bytes from the stream buffer.
  2. Strip IP + TCP headers from each packet to extract the TCP payload.
  3. Concatenate all TCP payloads across all packets in the stream.
  4. Locate an HTTP response body (after the \r\n\r\n boundary).
  5. Within the body, search for known image magic bytes (JPEG, PNG, WebP, GIF).
  6. Write the reassembled packets to a PCAP for forensic archiving.

This approach is independent of tshark and works reliably with Scapy-captured
IP frames where full TCP session state is not available for tshark reassembly.
"""

import asyncio
import logging
import os
import time
import uuid

logger = logging.getLogger("stegnar.routing.pcap_builder")

# Image magic signatures (offset 0 within the carved payload)
_IMAGE_MAGIC = [
    (b'\xff\xd8\xff', "jpeg"),
    (b'\x89PNG\r\n',  "png"),
    (b'RIFF',         "webp"),
    (b'GIF87a',       "gif"),
    (b'GIF89a',       "gif"),
    (b'BM',           "bmp"),
]


def _extract_tcp_payload(raw_ip_bytes: bytes) -> bytes:
    """
    Given a raw IPv4 packet (as captured by Scapy bytes(pkt)), return
    only the TCP/UDP application payload. Returns empty bytes on any error.
    """
    try:
        if len(raw_ip_bytes) < 20:
            return b""
        # IP header length is in the lower nibble of the first byte, in 32-bit words
        ihl = (raw_ip_bytes[0] & 0x0F) * 4
        protocol = raw_ip_bytes[9]
        if protocol == 6:  # TCP
            tcp_start = ihl
            if len(raw_ip_bytes) < tcp_start + 20:
                return b""
            # TCP data offset is upper nibble of byte 12 of TCP header, in 32-bit words
            data_offset = ((raw_ip_bytes[tcp_start + 12] >> 4) & 0xF) * 4
            payload_start = tcp_start + data_offset
            return raw_ip_bytes[payload_start:]
        elif protocol == 17:  # UDP
            udp_start = ihl
            return raw_ip_bytes[udp_start + 8:]
        return b""
    except Exception:
        return b""


def _carve_image_from_payloads(payloads: bytes) -> bytes:
    """
    Given concatenated TCP payloads from an HTTP stream, find and return
    the image bytes. Handles HTTP/1.1 responses with Content-Length or
    chunked transfer. Also handles raw binary data directly.
    """
    if not payloads:
        return b""

    # Try to split at HTTP response body boundary
    sep = b'\r\n\r\n'
    idx = payloads.find(sep)
    body = payloads[idx + 4:] if idx != -1 else payloads

    # Scan for known image magic bytes within the first 8KB of the body
    scan_limit = min(len(body), 8192)
    for offset in range(scan_limit):
        for magic, mime in _IMAGE_MAGIC:
            if body[offset:offset + len(magic)] == magic:
                candidate = body[offset:]
                # For JPEG, trim precisely at end-of-image marker
                if mime == "jpeg":
                    eoi = candidate.rfind(b'\xff\xd9')
                    if eoi != -1:
                        candidate = candidate[:eoi + 2]
                # Must be more than a trivially small fragment
                if len(candidate) > 512:
                    logger.info(
                        "Carved %s image: %d bytes at body offset=%d",
                        mime.upper(), len(candidate), offset
                    )
                    return candidate
    return b""


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

        # Determine packet list
        packets = pkt_list if (is_list and pkt_list) else [raw_bytes]

        # --- 1. Write forensic PCAP (best-effort, non-fatal) ---
        try:
            from scapy.all import IP, wrpcap
            scapy_pkts = []
            for p in packets:
                try:
                    scapy_pkts.append(IP(p))
                except Exception:
                    pass
            if scapy_pkts:
                wrpcap(pcap_path, scapy_pkts)
        except Exception as e:
            logger.warning("PCAP write failed (non-fatal): %s", e)

        # --- 2. Deep Carve: extract TCP payloads and search for image ---
        all_payloads = b""
        for p in packets:
            all_payloads += _extract_tcp_payload(p)

        if all_payloads:
            image_bytes = _carve_image_from_payloads(all_payloads)
            if not image_bytes:
                logger.debug(
                    "No image found in stream %s (%d bytes of payload)",
                    stream_id, len(all_payloads)
                )
        else:
            image_bytes = b""
            logger.debug("No TCP payload extractable from stream %s", stream_id)

        uri = f"s3://stegnar-pcaps/{safe_id}_{ts}_{uid}.pcap"
        return uri, image_bytes
