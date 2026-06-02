"""
====================================================================================================
  stegnar-routing · servicer.py — gRPC RouterService Orchestration Engine
====================================================================================================

  THE PILLARS OF ORCHESTRATION:
  ----------------------------
  The `RouterServicer` operates as the high-throughput asynchronous core of the entire Stegnar platform.
  It acts as the traffic cop and central arbiter between edge sensors (Endpoint Agents), privileged
  MITM Decryption nodes, and the cold storage database layer.

  THE PIPELINE PIPELINE PROCESS:
  ----------------------------
  For each connection and stream payload initiated by edge sensors, the servicer executes a highly
  structured, multi-stage processing pipeline:

    1. Rate Limiting (Token Bucket): Immediately queries the `RateLimiter` to check if the endpoint has
       exceeded requests. Dropped chunks protect the system from accidental DoS.
    2. Stream Reassembly & Tracking: Accumulates raw incoming bytes, dynamically mapping incoming keys to
       active TLS payloads.
    3. Forensic PCAP Generation: Background PyShark/Tshark reassembles TLS keys and raw capture bytes
       into fully compliant, decryption-ready `.pcap` files for deep forensic audits.
    4. Hash Deduplication Bypass (Sub-Millisecond Cache): Compares the SHA-256 hash of payloads against
       a hot Redis `HashCache`. If matched (verdict cached), it commands the endpoint agent to abort
       transmission (`skip_check`), bypassing ML analysis entirely to save compute cycles.
    5. Sniffing & Payload Extraction: Inspects raw data or carved output via magic bytes to detect image type files.
    6. MITM Probe Dispatch: Non-blocking gRPC dispatch to the central `stegnar-mitm` gateway.
    7. Persistence: Streams the completed score, forensic `.pcap` URI, and metadata to Redis Stream
       for decoupled time-series writing (TimescaleDB / Postgres).

  This decoupled design ensures maximum fault isolation: ML probes can go offline without dropping a
  single byte of incoming traffic.
====================================================================================================
"""

import asyncio
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
import pg_writer  # for endpoint_registry + hash_cache writes

logger = logging.getLogger("stegnar.routing.servicer")

# Image magic bytes for MIME sniffing
_IMAGE_MAGIC = {
    b'\xff\xd8\xff':   "jpeg",
    b'\x89PNG\r\n':    "png",
    b'RIFF':           "webp",
    b'BM':             "bmp",
    b'GIF87a':         "gif",
    b'GIF89a':         "gif",
}


def _sniff_image(raw_bytes: bytes) -> bool:
    """Return True if raw_bytes starts with a known image magic signature."""
    for magic in _IMAGE_MAGIC:
        if raw_bytes[:len(magic)] == magic:
            logger.debug("[Servicer] MIME sniff match: %s", _IMAGE_MAGIC[magic])
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
        self._streams      = {}
        self._reaper_task  = None
        self._settings_task = None
        self._active_scans = 0
        self._max_scans = 10
        logger.info("[Servicer] RouterServicer initialized.")

    async def start(self):
        """Start background tasks. Must be called inside the asyncio event loop."""
        loop = asyncio.get_running_loop()
        self._reaper_task = loop.create_task(self._reaper(), name="stream-reaper")
        self._settings_task = loop.create_task(self._settings_sync(), name="settings-sync")
        logger.info("[Servicer] RouterServicer started — stream reaper is running.")

    async def _settings_sync(self):
        while True:
            try:
                if self._cache and self._cache._client:
                    val = await self._cache._client.hget("stegnar:settings", "maxConcurrentScans")
                    if val:
                        self._max_scans = int(val)
            except Exception as e:
                logger.error("[Servicer] Failed to sync settings: %s", e)
            await asyncio.sleep(10.0)

    async def _reaper(self):
        logger.info("[Servicer] Stream reaper started.")
        while True:
            await asyncio.sleep(5.0)
            now = time.time()
            to_process = []
            for stream_id, data in list(self._streams.items()):
                age = now - data['last_seen']
                if age > 5.0:
                    to_process.append((stream_id, data))
                    del self._streams[stream_id]

            if to_process:
                logger.info("[Servicer] Reaper flushing %d idle stream(s).", len(to_process))
            for stream_id, data in to_process:
                try:
                    await self._process_stream(stream_id, data)
                except Exception as e:
                    logger.error("[Servicer] Reaper error for stream=%s: %s", stream_id, e, exc_info=True)

    async def _process_stream(self, stream_id: str, data: dict):
        raw_bytes   = b"".join(data['chunks'])
        chunk       = data['metadata']
        endpoint_id = data['endpoint_id']

        logger.info(
            "[Servicer] Processing stream=%s endpoint=%s total_bytes=%d chunks=%d",
            stream_id, endpoint_id, len(raw_bytes), len(data['chunks']),
        )

        # ── Upsert endpoint registry ──────────────────────────────────────────
        await pg_writer.upsert_endpoint(
            endpoint_id=endpoint_id,
            ip_address=chunk.src_ip or chunk.dst_ip or "",
            bytes_delta=len(raw_bytes),
        )

        # ── Build forensic PCAP + upload artifacts ────────────────────────────
        all_keys = self._key_store.get_keys(endpoint_id)
        logger.debug(
            "[Servicer] SSL keys available for endpoint=%s: %d chars",
            endpoint_id, len(all_keys) if all_keys else 0,
        )

        pcap_uri, image_uri, carved_image = await self._pcap_builder.build_pcap(
            stream_id, raw_bytes, all_keys, is_list=True, pkt_list=data['chunks']
        )
        logger.info(
            "[Servicer] PCAP build result stream=%s pcap_uri=%s image_uri=%s carved=%d bytes",
            stream_id, pcap_uri or "none", image_uri or "none", len(carved_image),
        )

        # ── SHA-256 of reassembled payload for cache lookup ───────────────────
        full_sha256 = hashlib.sha256(raw_bytes).hexdigest()
        logger.debug("[Servicer] SHA256 stream=%s hash=%s", stream_id, full_sha256[:16])

        # ── Cache lookup ──────────────────────────────────────────────────────
        cached = await self._cache.lookup(full_sha256)
        if cached is not None:
            logger.info(
                "[Servicer] CACHE HIT endpoint=%s stream=%s sha=%s verdict=%s",
                endpoint_id, stream_id, full_sha256[:12], cached["verdict"],
            )
            await pg_writer.store_hash_cache(
                sha256=full_sha256,
                verdict=cached["verdict"],
                steg_score=cached["steg_score"],
            )
            await self._queue.write_event(
                stream_id   = stream_id,
                endpoint_id = endpoint_id,
                sha256      = full_sha256,
                verdict     = "CACHE_HIT",
                steg_score  = cached["steg_score"],
                src_ip      = chunk.src_ip,
                dst_ip      = chunk.dst_ip,
                bytes_total = len(raw_bytes),
                pcap_uri    = pcap_uri,
                image_uri   = image_uri,
            )
            return

        # ── Image determination (MIME sniff OR tshark-carved) ─────────────────
        image_bytes_to_analyze = b""
        if _sniff_image(raw_bytes):
            image_bytes_to_analyze = raw_bytes
            logger.info(
                "[Servicer] Direct image payload detected stream=%s bytes=%d",
                stream_id, len(raw_bytes),
            )
        elif carved_image:
            image_bytes_to_analyze = carved_image
            logger.info(
                "[Servicer] Using tshark-carved image stream=%s bytes=%d",
                stream_id, len(carved_image),
            )

        if not image_bytes_to_analyze:
            logger.info(
                "[Servicer] NO_IMAGE for stream=%s endpoint=%s — queuing metadata only",
                stream_id, endpoint_id,
            )
            await self._queue.write_event(
                stream_id   = stream_id,
                endpoint_id = endpoint_id,
                sha256      = full_sha256,
                verdict     = "NO_IMAGE",
                steg_score  = 0.0,
                src_ip      = chunk.src_ip,
                dst_ip      = chunk.dst_ip,
                bytes_total = len(raw_bytes),
                pcap_uri    = pcap_uri,
                image_uri   = image_uri,
            )
            return

        # ── Dispatch to MITM Gateway for CALPA-NET analysis ───────────────────
        logger.info(
            "[Servicer] DISPATCHING to MITM endpoint=%s stream=%s sha=%s bytes=%d",
            endpoint_id, stream_id, full_sha256[:12], len(image_bytes_to_analyze),
        )
        while self._active_scans >= self._max_scans:
            await asyncio.sleep(0.5)
        
        self._active_scans += 1
        try:
            result = await self._dispatcher.analyze(
                stream_id   = stream_id,
                image_bytes = image_bytes_to_analyze,
                sha256      = full_sha256,
                endpoint_id = endpoint_id,
                src_ip      = chunk.src_ip,
                dst_ip      = chunk.dst_ip,
            )
        finally:
            self._active_scans -= 1
        logger.info(
            "[Servicer] CALPA result stream=%s verdict=%s confidence=%.4f latency=%dms model=%s",
            stream_id, result.verdict, result.confidence,
            result.latency_ms or 0, result.model_type or "srnet",
        )

        # ── Store in Redis cache ───────────────────────────────────────────────
        if result.verdict not in ("ERROR",):
            await self._cache.store(full_sha256, result.verdict, result.confidence)
            # Also persist to PostgreSQL hash_cache for SOC visibility
            await pg_writer.store_hash_cache(
                sha256     = full_sha256,
                verdict    = result.verdict,
                steg_score = result.confidence,
                model_type = result.model_type or "srnet",
            )

        # ── Write event to Redis queue → data-layer → PostgreSQL ──────────────
        await self._queue.write_event(
            stream_id   = stream_id,
            endpoint_id = endpoint_id,
            sha256      = full_sha256,
            verdict     = result.verdict,
            steg_score  = result.confidence,
            src_ip      = chunk.src_ip,
            dst_ip      = chunk.dst_ip,
            bytes_total = len(raw_bytes),
            latency_ms  = result.latency_ms,
            model_type  = result.model_type or "srnet",
            pcap_uri    = pcap_uri,
            image_uri   = image_uri,
        )

        logger.info(
            "[Servicer] ANALYSIS DONE endpoint=%s stream=%s verdict=%s score=%.4f pcap=%s img=%s",
            endpoint_id, stream_id, result.verdict, result.confidence,
            pcap_uri or "none", image_uri or "none",
        )

    async def StreamPayload(self, request_iterator, context):  # noqa: N802
        chunks_recv = 0
        touched_streams = set()

        async for chunk in request_iterator:
            chunks_recv += 1

            # Rate limit
            if not await self._limiter.is_allowed(chunk.endpoint_id):
                logger.warning(
                    "[Servicer] Rate limit exceeded endpoint=%s — dropping chunk",
                    chunk.endpoint_id,
                )
                continue

            # Accumulate TLS keys indexed by endpoint
            if chunk.ssl_keylog:
                self._key_store.add_keys(chunk.endpoint_id, chunk.ssl_keylog)
                logger.debug(
                    "[Servicer] SSL keylog updated for endpoint=%s (%d bytes)",
                    chunk.endpoint_id, len(chunk.ssl_keylog),
                )

            if chunk.stream_id not in self._streams:
                self._streams[chunk.stream_id] = {
                    'chunks':      [],
                    'metadata':    chunk,
                    'endpoint_id': chunk.endpoint_id,
                    'last_seen':   time.time(),
                }
                logger.debug(
                    "[Servicer] New stream registered: stream_id=%s endpoint=%s",
                    chunk.stream_id, chunk.endpoint_id,
                )

            self._streams[chunk.stream_id]['chunks'].append(chunk.raw_bytes)
            self._streams[chunk.stream_id]['last_seen'] = time.time()
            touched_streams.add(chunk.stream_id)

        logger.info(
            "[Servicer] StreamPayload RPC complete — chunks_recv=%d streams=%d",
            chunks_recv, len(touched_streams),
        )

        # Force process all streams touched by this connection before returning
        for stream_id in touched_streams:
            if stream_id in self._streams:
                data = self._streams.pop(stream_id)
                try:
                    await self._process_stream(stream_id, data)
                except Exception as e:
                    logger.error(
                        "[Servicer] Error processing stream=%s on disconnect: %s",
                        stream_id, e, exc_info=True,
                    )

        return pb.StreamAck(
            ok=True,
            chunks_recv=chunks_recv,
            message=f"processed {chunks_recv} chunks",
        )
