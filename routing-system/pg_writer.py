"""
pg_writer.py — Routing System PostgreSQL writer.

Writes to:
  - endpoint_registry  (upsert on each stream from an endpoint)
  - hash_cache         (persist Redis cache entries for audit/visibility)

Uses asyncpg for async, non-blocking I/O. Called directly from servicer.py.
"""

import asyncio
import logging
import os

import asyncpg

logger = logging.getLogger("stegnar.routing.pg")

DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://stegnar:stegnar_secret@postgres:5432/stegnar",
)

_pool: asyncpg.Pool | None = None


async def init_pool():
    """Initialize asyncpg connection pool. Call once from main."""
    global _pool
    while _pool is None:
        try:
            _pool = await asyncpg.create_pool(dsn=DSN, min_size=1, max_size=5)
            logger.info("[PGWriter] Connected to PostgreSQL: %s", DSN.split("@")[-1])
        except Exception as e:
            logger.warning("[PGWriter] Waiting for PostgreSQL... error: %s", e)
            await asyncio.sleep(3.0)


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        logger.info("[PGWriter] PostgreSQL pool closed.")


async def upsert_endpoint(
    endpoint_id: str,
    ip_address:  str,
    bytes_delta: int = 0,
):
    """
    Upsert a record in endpoint_registry.
    Creates the row on first contact; increments counters on subsequent calls.
    """
    if _pool is None:
        logger.warning("[PGWriter] upsert_endpoint skipped — pool not initialized")
        return
    try:
        await _pool.execute(
            """
            INSERT INTO endpoint_registry (endpoint_id, ip_address, first_seen, last_seen, total_chunks, total_bytes)
            VALUES ($1, $2, NOW(), NOW(), 1, $3)
            ON CONFLICT (endpoint_id) DO UPDATE
              SET last_seen    = NOW(),
                  ip_address   = EXCLUDED.ip_address,
                  total_chunks = endpoint_registry.total_chunks + 1,
                  total_bytes  = endpoint_registry.total_bytes  + EXCLUDED.total_bytes
            """,
            endpoint_id,
            ip_address or "",
            int(bytes_delta),
        )
        logger.debug(
            "[PGWriter] upsert_endpoint OK endpoint=%s ip=%s bytes_delta=%d",
            endpoint_id, ip_address, bytes_delta,
        )
    except Exception as e:
        logger.error(
            "[PGWriter] upsert_endpoint FAILED endpoint=%s: %s", endpoint_id, e
        )


async def store_hash_cache(sha256: str, verdict: str, steg_score: float, model_type: str = "srnet"):
    """
    Persist a CALPA analysis result in the PostgreSQL hash_cache table.
    Increments hit_count if the hash already exists.
    """
    if _pool is None:
        logger.warning("[PGWriter] store_hash_cache skipped — pool not initialized")
        return
    try:
        await _pool.execute(
            """
            INSERT INTO hash_cache (sha256, verdict, steg_score, model_type, analyzed_at, hit_count)
            VALUES ($1, $2, $3, $4, NOW(), 0)
            ON CONFLICT (sha256) DO UPDATE
              SET hit_count   = hash_cache.hit_count + 1,
                  verdict     = EXCLUDED.verdict,
                  steg_score  = EXCLUDED.steg_score,
                  analyzed_at = NOW()
            """,
            sha256,
            verdict,
            float(steg_score),
            model_type,
        )
        logger.debug(
            "[PGWriter] store_hash_cache OK sha256=%s verdict=%s score=%.4f",
            sha256[:16], verdict, steg_score,
        )
    except Exception as e:
        logger.error(
            "[PGWriter] store_hash_cache FAILED sha256=%s: %s", sha256[:16], e
        )
