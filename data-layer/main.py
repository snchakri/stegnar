"""
====================================================================================================
  stegnar-data · main.py — Continuous Ingestion Daemon & Persistent Ledger Writer
====================================================================================================

  THE ASYNCHRONOUS DATA LEDGER:
  ----------------------------
  The Data Layer operates as a stateless backend queue worker. Its core mandate is to ingest parsed
  threat data and forensic metadata from the hot Redis Streams queue and commit it reliably to Postgres
  (TimescaleDB) and object storage.
  
  This decoupling acts as a vital "shock absorber", preventing incoming network packet streams from being
  dropped or backed up during spikes in analysis volumes or during database locks.

  QUEUING MECHANICS & CONSUMER GROUPS:
  ------------------------------------
  - Redis Stream Name: `stegnar:db_queue` (configurable via `REDIS_STREAM`)
  - Consumer Group Name: `data_layer_cg`
  - Client Worker Name: `worker_1` (each worker instance gets a unique ID in a swarm setup)

  Upon startup, the script verifies or dynamically creates the Redis Consumer Group at ID '0' (beginning of
  stream). It then enters a non-blocking asyncio read group loop, bulk-processing batches of up to 50
  threat records per tick, writing them to relational hypertables, and executing explicit ACKs to purge completed
  records from the message stream.
====================================================================================================
"""

import asyncio
import logging
import os
import signal

import redis.asyncio as aioredis
from pg_writer import PostgresWriter

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("stegnar.data.main")

REDIS_URL    = os.environ.get("REDIS_URL",    "redis://redis:6379")
REDIS_STREAM = os.environ.get("REDIS_STREAM", "stegnar:db_queue")
GROUP_NAME   = "data_layer_cg"
CONSUMER_NAME= "worker_1"


async def consume_loop(redis_client: aioredis.Redis, pg: PostgresWriter, stop_event: asyncio.Event):
    # Ensure consumer group exists
    try:
        await redis_client.xgroup_create(REDIS_STREAM, GROUP_NAME, id="0", mkstream=True)
        logger.info("Created consumer group %s for stream %s", GROUP_NAME, REDIS_STREAM)
    except aioredis.ResponseError as e:
        if "BUSYGROUP" in str(e):
            pass # already exists
        else:
            raise

    logger.info("Data Layer consumer loop started.")

    while not stop_event.is_set():
        try:
            # Block for up to 1 second waiting for new messages
            streams = await redis_client.xreadgroup(
                GROUP_NAME, CONSUMER_NAME, {REDIS_STREAM: ">"}, count=50, block=1000
            )
            if not streams:
                continue

            for stream_name, messages in streams:
                for msg_id, msg_data in messages:
                    try:
                        await pg.insert_event(msg_data)
                        # ACK the message so it doesn't stay pending
                        await redis_client.xack(REDIS_STREAM, GROUP_NAME, msg_id)
                    except Exception as e:
                        logger.error("Error processing message %s: %s", msg_id, e, exc_info=True)

        except asyncio.TimeoutError:
            continue
        except Exception as e:
            logger.error("Redis consumer error: %s", e)
            await asyncio.sleep(2)


async def serve():
    redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    await redis_client.ping()

    pg = PostgresWriter()
    await pg.connect()

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()

    def _stop():
        logger.info("Shutdown signal received.")
        stop_event.set()

    loop.add_signal_handler(signal.SIGTERM, _stop)
    loop.add_signal_handler(signal.SIGINT, _stop)

    consumer_task = asyncio.create_task(consume_loop(redis_client, pg, stop_event))

    await stop_event.wait()
    logger.info("Stopping Data Layer...")

    await consumer_task
    await pg.close()
    await redis_client.aclose()
    logger.info("Data Layer stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(serve())
