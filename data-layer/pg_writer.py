"""
pg_writer.py — Asynchronous PostgreSQL writer using asyncpg.

Writes events from the Redis DB queue into TimescaleDB.
"""

import logging
import os
import datetime
import asyncio

import asyncpg

logger = logging.getLogger("stegnar.data.pg")

DSN = os.environ.get("POSTGRES_DSN", "postgresql://stegnar:stegnar_secret@postgres:5432/stegnar")


class PostgresWriter:
    def __init__(self):
        self._pool = None

    async def connect(self):
        while self._pool is None:
            try:
                self._pool = await asyncpg.create_pool(dsn=DSN, min_size=2, max_size=10)
                logger.info("Connected to PostgreSQL: %s", DSN.split("@")[-1])
            except Exception as e:
                logger.warning("Waiting for PostgreSQL... error: %s", e)
                await asyncio.sleep(3.0)

    async def insert_event(self, entry: dict):
        """Insert a single network_event record."""
        query = """
            INSERT INTO network_events (
                ts, endpoint_id, stream_id, src_ip, dst_ip, sha256,
                bytes_total, steg_score, verdict, latency_ms, model_type,
                pcap_uri, image_uri
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            )
        """
        ts_ms = int(entry.get("ts_epoch_ms", 0))
        if ts_ms == 0:
            ts = datetime.datetime.now(datetime.timezone.utc)
        else:
            ts = datetime.datetime.fromtimestamp(ts_ms / 1000.0, tz=datetime.timezone.utc)

        await self._pool.execute(
            query,
            ts,
            entry.get("endpoint_id"),
            entry.get("stream_id"),
            entry.get("src_ip"),
            entry.get("dst_ip"),
            entry.get("sha256"),
            int(entry.get("bytes_total", 0)),
            float(entry.get("steg_score", 0.0)),
            entry.get("verdict"),
            int(entry.get("latency_ms", 0)),
            entry.get("model_type", "srnet"),
            entry.get("pcap_uri"),
            entry.get("image_uri"),
        )
        logger.debug("Inserted event for stream_id=%s verdict=%s", entry.get("stream_id"), entry.get("verdict"))

    async def close(self):
        if self._pool:
            await self._pool.close()
