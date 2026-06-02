"""
sniffer.py — Raw packet capture using Scapy on the designated interface.

Captures all TCP/UDP packets on the interface (outbound + inbound) and
yields them as (raw_bytes, src_ip, dst_ip, src_port, dst_port, captured_at_ms).

Design:
  - Uses Scapy's AsyncSniffer for non-blocking capture in a background thread.
  - Puts captured payloads onto an asyncio Queue to bridge into the async world.
  - Only yields packets that have a non-empty payload layer.
"""

import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("stegnar.sniffer")

@dataclass
class CapturedPacket:
    raw_bytes:    bytes
    sha256:       str
    src_ip:       str
    dst_ip:       str
    src_port:     int
    dst_port:     int
    captured_at:  int   # Unix epoch ms


async def capture_loop(
    iface: str,
    queue: asyncio.Queue,
    stop_event: asyncio.Event,
    bpf_filter: str,
):
    """
    Continuously capture packets on `iface` and push CapturedPacket objects
    onto `queue`. Stops when stop_event is set.
    """
    from scapy.all import AsyncSniffer, IP, TCP, UDP, Raw

    loop = asyncio.get_event_loop()

    def _handle_pkt(pkt):
        # Only process IP packets with a transport layer
        if not (pkt.haslayer(IP) and (pkt.haslayer(TCP) or pkt.haslayer(UDP))):
            return

        ip  = pkt[IP]
        transport = pkt[TCP] if pkt.haslayer(TCP) else pkt[UDP]

        # Skip empty payloads
        payload_layer = pkt.getlayer(Raw)
        if payload_layer is None or len(payload_layer.load) == 0:
            return

        raw = bytes(ip)
        sha = hashlib.sha256(raw).hexdigest()
        cp  = CapturedPacket(
            raw_bytes   = raw,
            sha256      = sha,
            src_ip      = ip.src,
            dst_ip      = ip.dst,
            src_port    = int(transport.sport),
            dst_port    = int(transport.dport),
            captured_at = int(time.time() * 1000),
        )
        # Thread-safe push into the asyncio queue
        loop.call_soon_threadsafe(queue.put_nowait, cp)

    logger.info("Starting packet capture on interface '%s' (filter: %s)", iface, bpf_filter)
    sniffer = AsyncSniffer(iface=iface, prn=_handle_pkt, store=False, filter=bpf_filter)
    sniffer.start()

    try:
        await stop_event.wait()
    finally:
        sniffer.stop()
        logger.info("Packet capture stopped.")
