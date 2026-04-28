"""
servicer.py — gRPC RouterService implementation.

Handles the StreamPayload RPC from Endpoint Agents.

For each incoming PayloadChunk:
  1. Rate-limit check → drop if exceeded
  2. Redis cache lookup by SHA-256
     → HIT:  write CACHE_HIT event to queue, skip MITM dispatch
     → MISS: detect if payload contains an image (MIME sniff)
       → IMAGE:    dispatch to MITM gateway → write result to cache + queue
       → NO_IMAGE: write NO_IMAGE event to queue (minimal metadata)

This is the central decision engine of the vTBP system.
"""

import hashlib
import logging
import time

import grpc

import sys
sys.path.insert(0, "/app/proto")
import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

from cache        import HashCache
from rate_limiter import RateLimiter
from dispatcher   import MITMDispatcher
from queue_writer import QueueWriter
from pcap_builder import PcapBuilder
from key_store    import KeyStore

logger = logging.getLogger("stegnar.routing.servicer")

# Image magic bytes for MIME sniffing
_IMAGE_MAGIC = {
    b'\xff\xd8\xff':   "jpeg",
    b'\x89PNG\r\n':    "png",
    b'RIFF':           "webp",  # needs additional check at offset 8
    b'BM':             "bmp",
    b'GIF87a':         "gif",
    b'GIF89a':         "gif",
}


def _sniff_image(raw_bytes: bytes) -> bool:
    """Return True if raw_bytes starts with a known image magic signature."""
    for magic in _IMAGE_MAGIC:
        if raw_bytes[:len(magic)] == magic:
            return True
    return False


class RouterServicer(pb_grpc.RouterServiceServicer):

    def __init__(
        self,
        cache:      HashCache,
        limiter:    RateLimiter,
        dispatcher: MITMDispatcher,
        queue:      QueueWriter,
    ):
        self._cache      = cache
        self._limiter    = limiter
        self._dispatcher = dispatcher
        self._queue      = queue
        self._pcap_builder = PcapBuilder()
        self._key_store    = KeyStore()

    async def StreamPayload(self, request_iterator, context):  # noqa: N802
        chunks_recv = 0

        async for chunk in request_iterator:
            chunks_recv += 1

            # 1. Rate limit
            if not await self._limiter.is_allowed(chunk.endpoint_id):
                # Silently drop — gRPC flow control will throttle the client
                continue

            # 3. Build forensic PCAP and get MinIO URI + Deep Carved Image
            # Accumulate keys for this stream
            self._key_store.add_keys(chunk.stream_id, chunk.ssl_keylog)
            all_keys = self._key_store.get_keys(chunk.stream_id)

            pcap_uri, carved_image = await self._pcap_builder.build_pcap(
                chunk.stream_id, chunk.raw_bytes, all_keys
            )

            # 4. Cache lookup
            cached = await self._cache.lookup(chunk.sha256)
            if cached is not None:
                logger.info(
                    "CACHE HIT  endpoint=%s stream=%s sha=%s verdict=%s",
                    chunk.endpoint_id, chunk.stream_id, chunk.sha256[:12], cached["verdict"]
                )
                await self._queue.write_event(
                    stream_id   = chunk.stream_id,
                    endpoint_id = chunk.endpoint_id,
                    sha256      = chunk.sha256,
                    verdict     = "CACHE_HIT",
                    steg_score  = cached["steg_score"],
                    src_ip      = chunk.src_ip,
                    dst_ip      = chunk.dst_ip,
                    bytes_total = len(chunk.raw_bytes),
                    pcap_uri    = pcap_uri,
                )
                continue

            # 5. Image Determination (MIME sniff OR Deep Carved)
            image_bytes_to_analyze = b""
            if _sniff_image(chunk.raw_bytes):
                image_bytes_to_analyze = chunk.raw_bytes
            elif carved_image:
                image_bytes_to_analyze = carved_image

            if not image_bytes_to_analyze:
                await self._queue.write_event(
                    stream_id   = chunk.stream_id,
                    endpoint_id = chunk.endpoint_id,
                    sha256      = chunk.sha256,
                    verdict     = "NO_IMAGE",
                    steg_score  = 0.0,
                    src_ip      = chunk.src_ip,
                    dst_ip      = chunk.dst_ip,
                    bytes_total = len(chunk.raw_bytes),
                    pcap_uri    = pcap_uri,
                )
                continue

            # 6. Dispatch to MITM Gateway for CALPA-NET analysis
            logger.info(
                "DISPATCHING image endpoint=%s stream=%s sha=%s bytes=%d",
                chunk.endpoint_id, chunk.stream_id, chunk.sha256[:12], len(image_bytes_to_analyze)
            )
            result = await self._dispatcher.analyze(
                stream_id   = chunk.stream_id,
                image_bytes = image_bytes_to_analyze,
                sha256      = chunk.sha256,
                endpoint_id = chunk.endpoint_id,
                src_ip      = chunk.src_ip,
                dst_ip      = chunk.dst_ip,
            )

            # 7. Store in cache (even errors, to avoid re-dispatching)
            if result.verdict not in ("ERROR",):
                await self._cache.store(chunk.sha256, result.verdict, result.confidence)

            # 8. Write to event queue
            await self._queue.write_event(
                stream_id   = chunk.stream_id,
                endpoint_id = chunk.endpoint_id,
                sha256      = chunk.sha256,
                verdict     = result.verdict,
                steg_score  = result.confidence,
                src_ip      = chunk.src_ip,
                dst_ip      = chunk.dst_ip,
                bytes_total = len(chunk.raw_bytes),
                latency_ms  = result.latency_ms,
                model_type  = result.model_type or "srnet",
                pcap_uri    = pcap_uri,
            )

            logger.info(
                "ANALYSIS DONE endpoint=%s stream=%s verdict=%s confidence=%.3f",
                chunk.endpoint_id, chunk.stream_id, result.verdict, result.confidence
            )

        return pb.StreamAck(
            ok=True,
            chunks_recv=chunks_recv,
            message=f"processed {chunks_recv} chunks"
        )
