"""
main.py — Routing System entry point.

Initializes the Redis connections, sets up the RouterService gRPC servicer,
and runs the asyncio gRPC server.
"""

import asyncio
import logging
import os
import signal

import grpc
import grpc.experimental.aio as aio
import redis.asyncio as aioredis

import sys
sys.path.insert(0, "/app/proto")
import stegnar_pb2_grpc as pb_grpc

from cache        import HashCache
from rate_limiter import RateLimiter
from dispatcher   import MITMDispatcher
from queue_writer import QueueWriter
from servicer     import RouterServicer
import pg_writer

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("stegnar.routing.main")

LISTEN_ADDR = os.environ.get("GRPC_LISTEN_ADDR", "0.0.0.0:50051")
REDIS_URL   = os.environ.get("REDIS_URL",        "redis://redis:6379")


async def serve():
    # 1. Initialize Redis client (shared for cache, rate limit, queue)
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    await redis_client.ping()

    # 2. Initialize components
    cache   = HashCache()
    limiter = RateLimiter()
    queue   = QueueWriter()
    await cache.connect(redis_client)
    await limiter.connect(redis_client)
    await queue.connect(redis_client)

    # 2b. Initialize PostgreSQL writer (endpoint_registry + hash_cache)
    await pg_writer.init_pool()

    dispatcher = MITMDispatcher()
    await dispatcher.connect()

    # 3. Setup gRPC Server
    server = aio.server(
        options=[
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
            ("grpc.max_send_message_length",    50 * 1024 * 1024),
            ("grpc.keepalive_time_ms",          20_000),
            ("grpc.keepalive_timeout_ms",       10_000),
        ]
    )
    servicer = RouterServicer(cache, limiter, dispatcher, queue)
    await servicer.start()
    pb_grpc.add_RouterServiceServicer_to_server(servicer, server)

    server.add_insecure_port(LISTEN_ADDR)
    logger.info("Routing System gRPC server starting on %s", LISTEN_ADDR)
    await server.start()

    # Graceful shutdown handling
    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def _stop():
        logger.info("Shutdown signal received.")
        stop_event.set()

    loop.add_signal_handler(signal.SIGTERM, _stop)
    loop.add_signal_handler(signal.SIGINT, _stop)

    await stop_event.wait()

    logger.info("Stopping gRPC server...")
    await server.stop(grace=5)
    await dispatcher.close()
    await cache.close()
    await pg_writer.close_pool()
    await redis_client.aclose()
    logger.info("Routing System stopped cleanly.")

if __name__ == "__main__":
    asyncio.run(serve())
