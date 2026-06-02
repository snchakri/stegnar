"""
cache.py — Redis SHA-256 hash cache for the Routing System.

On a CACHE HIT  → returns the cached verdict (skip MITM dispatch)
On a CACHE MISS → returns None (proceed to MITM dispatch)

After each new CALPA-NET analysis the routing system writes the result
back here so future identical images are served from cache.
"""

import logging
import os
import redis.asyncio as aioredis

logger = logging.getLogger("stegnar.routing.cache")

REDIS_URL     = os.environ.get("REDIS_URL",  "redis://redis:6379")
CACHE_TTL_SEC = int(os.environ.get("CACHE_TTL_SEC", str(7 * 24 * 3600)))  # 1 week

# Key prefix for hash cache entries
_PREFIX = "stegnar:cache:"


class HashCache:
    def __init__(self):
        self._client: aioredis.Redis | None = None

    async def connect(self, redis_client: aioredis.Redis):
        self._client = redis_client
        logger.info("Redis cache connected via shared client")

    async def lookup(self, sha256: str) -> dict | None:
        """
        Returns dict {verdict, steg_score} on hit, None on miss.
        Also increments a hit counter.
        """
        key = _PREFIX + sha256
        data = await self._client.hgetall(key)
        if not data:
            return None
        # Refresh TTL on access
        await self._client.expire(key, CACHE_TTL_SEC)
        # Increment hit counter (fire-and-forget)
        await self._client.hincrby(key, "hit_count", 1)
        logger.debug("Cache HIT sha256=%s verdict=%s", sha256[:16], data.get("verdict"))
        return {
            "verdict":    data.get("verdict", "UNKNOWN"),
            "steg_score": float(data.get("steg_score", "0")),
        }

    async def store(self, sha256: str, verdict: str, steg_score: float):
        """Write a new analysis result into the cache."""
        key = _PREFIX + sha256
        await self._client.hset(key, mapping={
            "verdict":    verdict,
            "steg_score": str(steg_score),
            "hit_count":  "0",
        })
        await self._client.expire(key, CACHE_TTL_SEC)
        logger.debug("Cache STORE sha256=%s verdict=%s score=%.3f", sha256[:16], verdict, steg_score)

    async def close(self):
        if self._client:
            await self._client.aclose()
