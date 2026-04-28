"""
key_extractor.py — SSLKEYLOGFILE watcher.

Watches the SSLKEYLOGFILE path for new lines written by the browser/curl
and yields them as strings. These are the TLS session keys that the MITM
gateway needs to decrypt HTTPS traffic captured by the sniffer.

Usage with curl:
    SSLKEYLOGFILE=/tmp/keys.log curl -sk https://target-server/stego.png

The watcher tail-follows the file in a background thread and forwards
new lines into an asyncio Queue.
"""

import asyncio
import logging
import os
import time
from pathlib import Path

logger = logging.getLogger("stegnar.key_extractor")


async def watch_keylog(
    keylog_path: str,
    queue: asyncio.Queue,
    stop_event: asyncio.Event,
    poll_interval: float = 0.1,
):
    """
    Tail-follow the SSLKEYLOGFILE and push new key lines into queue.
    Each item pushed is a single SSLKEYLOGFILE line (string).
    """
    path = Path(keylog_path)
    loop = asyncio.get_event_loop()

    # Wait for the file to be created
    while not path.exists() and not stop_event.is_set():
        await asyncio.sleep(1.0)

    logger.info("Watching SSLKEYLOGFILE: %s", keylog_path)

    position = 0
    while not stop_event.is_set():
        try:
            current_size = path.stat().st_size
        except FileNotFoundError:
            await asyncio.sleep(poll_interval)
            continue

        if current_size > position:
            with open(path, "r", errors="replace") as f:
                f.seek(position)
                for line in f:
                    line = line.rstrip("\n")
                    if line and not line.startswith("#"):
                        await queue.put(line)
                position = f.tell()

        await asyncio.sleep(poll_interval)

    logger.info("SSL key extractor stopped.")
