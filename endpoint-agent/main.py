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

    TARGET_URL = os.environ.get("TARGET_URL")

    async def auto_fetch():
        if not TARGET_URL:
            return
        logger.info("Auto-fetch task sleeping for 15s to allow system warmup...")
        await asyncio.sleep(15)
        logger.info("Executing auto-fetch for %s", TARGET_URL)
        import subprocess, tempfile, hashlib, struct, time as _time
        try:
            env = os.environ.copy()
            env["SSLKEYLOGFILE"] = KEYLOG_PATH

            if TARGET_URL.startswith("https://"):
                # For HTTPS: curl saves the response body to a temp file.
                # We then inject those raw image bytes as a synthetic packet so
                # Tshark doesn't need to decrypt — the node already has plaintext.
                fd, tmp_img = tempfile.mkstemp(suffix=".jpg")
                os.close(fd)
                cmd = f"curl -sk -o {tmp_img} {TARGET_URL}"
                subprocess.run(cmd, shell=True, executable="/bin/bash", env=env)

                with open(tmp_img, "rb") as f:
                    img_bytes = f.read()
                os.unlink(tmp_img)

                if len(img_bytes) > 1000:
                    sha = hashlib.sha256(img_bytes).hexdigest()
                    # Inject as a synthetic captured-packet wrapping the raw image.
                    # stream_id uses the target host:443 pair so routing can identify it.
                    from sniffer import CapturedPacket
                    import socket as _sock
                    try:
                        target_ip = _sock.gethostbyname("target-server")
                    except Exception:
                        target_ip = "0.0.0.0"
                    try:
                        my_ip = _sock.gethostbyname(_sock.gethostname())
                    except Exception:
                        my_ip = os.environ.get("ENDPOINT_ID", "unknown")

                    pkt = CapturedPacket(
                        raw_bytes=img_bytes,
                        sha256=sha,
                        src_ip=target_ip,
                        dst_ip=my_ip,        # unique per node → unique stream_id
                        src_port=443,
                        dst_port=int(sha[:4], 16) % 60000 + 1024,  # deterministic unique port
                        captured_at=int(_time.time()),
                    )
                    await pkt_queue.put(pkt)
                    logger.info("HTTPS auto-fetch: injected %d bytes for analysis.", len(img_bytes))
                else:
                    logger.warning("HTTPS auto-fetch: empty or too-small response from %s", TARGET_URL)

            else:
                # HTTP: just trigger the download; the sniffer captures it live
                cmd = f"curl -s -o /dev/null {TARGET_URL}"
                subprocess.run(cmd, shell=True, executable="/bin/bash", env=env)

            logger.info("Auto-fetch complete.")
        except Exception as e:
            logger.error("Auto-fetch failed: %s", e)



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
        asyncio.create_task(
            auto_fetch(),
            name="auto-fetch"
        )
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
