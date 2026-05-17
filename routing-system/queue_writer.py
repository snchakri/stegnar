"""
queue_writer.py — Write events to Redis Streams for the Data Layer consumer.

Stream name: stegnar:db_queue

Each entry (XADD) contains flat string fields (Redis Streams requirement):
  stream_id, endpoint_id, sha256, verdict, steg_score, src_ip, dst_ip,
  bytes_total, latency_ms, model_type, pcap_uri, image_uri, ts_epoch_ms
"""

import json
import logging
import os
import time

import redis.asyncio as aioredis

logger = logging.getLogger("stegnar.routing.queue_writer")

STREAM_NAME = os.environ.get("REDIS_STREAM", "stegnar:db_queue")
MAX_LEN     = 10_000   # cap stream length to avoid unbounded growth


class QueueWriter:
    def __init__(self):
        self._client: aioredis.Redis | None = None

    async def connect(self, client: aioredis.Redis):
        self._client = client

    async def write_event(
        self,
        stream_id:   str,
        endpoint_id: str,
        sha256:      str,
        verdict:     str,
        steg_score:  float,
        src_ip:      str       = "",
        dst_ip:      str       = "",
        bytes_total: int       = 0,
        latency_ms:  int       = 0,
        model_type:  str       = "srnet",
        pcap_uri:    str       = "",
        image_uri:   str       = "",
    ):
        """Push an analysis event onto the Redis Stream."""
        entry = {
            "stream_id":   stream_id,
            "endpoint_id": endpoint_id,
            "sha256":      sha256,
            "verdict":     verdict,
            "steg_score":  str(steg_score),
            "src_ip":      src_ip,
            "dst_ip":      dst_ip,
            "bytes_total": str(bytes_total),
            "latency_ms":  str(latency_ms),
            "model_type":  model_type,
            "pcap_uri":    pcap_uri,
            "image_uri":   image_uri,
            "ts_epoch_ms": str(int(time.time() * 1000)),
        }
        msg_id = await self._client.xadd(
            STREAM_NAME, entry, maxlen=MAX_LEN, approximate=True
        )
        logger.debug("Queue write → %s id=%s verdict=%s", STREAM_NAME, msg_id, verdict)
        return msg_id
