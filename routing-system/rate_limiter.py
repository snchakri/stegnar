"""
rate_limiter.py — Token-bucket rate limiter per endpoint_id.

Implemented in Redis using a sorted-set sliding window approach:
  - Key: stegnar:rl:<endpoint_id>
  - Each request adds a timestamped entry; entries older than the window are pruned.
  - If count > limit → reject (429-equivalent: drop the chunk silently).

This protects the MITM gateway from a single flooded endpoint.
"""

import logging
import os
import time

import redis.asyncio as aioredis

logger = logging.getLogger("stegnar.routing.rate_limiter")

REDIS_URL   = os.environ.get("REDIS_URL",       "redis://redis:6379")
RATE_LIMIT  = int(os.environ.get("RATE_LIMIT_RPS", "1000"))   # chunks per second
WINDOW_MS   = 1000   # 1 second sliding window

_PREFIX = "stegnar:rl:"


class RateLimiter:
    def __init__(self):
        self._client: aioredis.Redis | None = None

    async def connect(self, client: aioredis.Redis):
        """Share the same Redis client as the cache."""
        self._client = client

    async def is_allowed(self, endpoint_id: str) -> bool:
        """
        Returns True if the endpoint is within its rate limit.
        Uses a sliding-window counter in a Redis sorted set.
        """
        now_ms  = int(time.time() * 1000)
        win_start = now_ms - WINDOW_MS
        key = _PREFIX + endpoint_id

        pipe = self._client.pipeline()
        # Remove entries outside the window
        pipe.zremrangebyscore(key, "-inf", win_start)
        # Count remaining
        pipe.zcard(key)
        # Add this request
        pipe.zadd(key, {str(now_ms): now_ms})
        # Set TTL so keys auto-expire
        pipe.expire(key, 10)
        results = await pipe.execute()

        count = results[1]   # count BEFORE adding this request
        if count >= RATE_LIMIT:
            logger.warning("Rate limit exceeded for endpoint %s (%d >= %d)", endpoint_id, count, RATE_LIMIT)
            return False
        return True
