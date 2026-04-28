"""
main.py — Endpoint Agent entry point.

Runs three concurrent async tasks:
  1. capture_loop  — Scapy raw packet sniffer → pkt_queue
  2. watch_keylog  — SSLKEYLOGFILE tail-follower → key_queue
  3. stream_to_router — gRPC unidirectional stream to Routing System

On SIGTERM/SIGINT, sets stop_event and waits for all tasks to finish.
"""

import asyncio
import logging
import os
import signal
import sys

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("stegnar.agent")

from sniffer      import capture_loop
from key_extractor import watch_keylog
from grpc_client   import stream_to_router

IFACE       = os.environ.get("CAPTURE_IFACE",  "eth0")
KEYLOG_PATH = os.environ.get("SSLKEYLOGFILE",  "/tmp/ssl_keys.log")
QUEUE_SIZE  = 1000


async def main():
    stop_event = asyncio.Event()
    pkt_queue  = asyncio.Queue(maxsize=QUEUE_SIZE)
    key_queue  = asyncio.Queue(maxsize=QUEUE_SIZE)

    loop = asyncio.get_event_loop()

    def _handle_signal():
        logger.info("Shutdown signal received.")
        stop_event.set()

    loop.add_signal_handler(signal.SIGTERM, _handle_signal)
    loop.add_signal_handler(signal.SIGINT,  _handle_signal)

    logger.info(
        "Endpoint Agent starting — id=%s iface=%s keylog=%s",
        os.environ.get("ENDPOINT_ID", "?"), IFACE, KEYLOG_PATH
    )

    tasks = [
        asyncio.create_task(
            capture_loop(IFACE, pkt_queue, stop_event),
            name="sniffer"
        ),
        asyncio.create_task(
            watch_keylog(KEYLOG_PATH, key_queue, stop_event),
            name="key-extractor"
        ),
        asyncio.create_task(
            stream_to_router(pkt_queue, key_queue, stop_event),
            name="grpc-stream"
        ),
    ]

    done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_EXCEPTION)

    for t in done:
        if t.exception():
            logger.error("Task %s raised: %s", t.get_name(), t.exception())

    stop_event.set()
    for t in pending:
        t.cancel()
    await asyncio.gather(*pending, return_exceptions=True)

    logger.info("Endpoint Agent stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
