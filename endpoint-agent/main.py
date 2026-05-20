"""
main.py — Endpoint Agent entry point.

Runs concurrent async tasks:
  1. capture_loop     — Scapy raw packet sniffer → pkt_queue
  2. watch_keylog     — SSLKEYLOGFILE tail-follower → key_queue
  3. stream_to_router — Cyclic gRPC stream to Routing System (connect→stream→disconnect→repeat)
  4. fetch_loop       — Periodic HTTP/S image fetcher (runs forever, refetches every FETCH_INTERVAL)

Tasks run until SIGTERM/SIGINT.
"""

import asyncio
import hashlib
import logging
import os
import pathlib
import signal
import socket as _sock
import subprocess
import tempfile
import time as _time

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("stegnar.agent")

from sniffer       import capture_loop, CapturedPacket
from key_extractor import watch_keylog
from grpc_client   import stream_to_router

IFACE          = os.environ.get("CAPTURE_IFACE",   "eth0")
CAPTURE_FILTER = os.environ.get(
    "CAPTURE_FILTER",
    "not port 50051 and not port 50052 and not port 8080 and not port 9000",
)
KEYLOG_PATH    = os.environ.get("SSLKEYLOGFILE",   "/tmp/ssl_keys.log")
TARGET_URL     = os.environ.get("TARGET_URL",       "")
ENDPOINT_ID    = os.environ.get("ENDPOINT_ID",      "unknown")
SOC_API_URL    = os.environ.get("SOC_API_URL",      "http://soc-api:3001")
FETCH_INTERVAL = int(os.environ.get("FETCH_INTERVAL", "25"))  # seconds between fetches
QUEUE_SIZE     = 1000
SEND_ONCE_MARKER = os.environ.get("SEND_ONCE_MARKER", "/tmp/stegnar_send_once.done")


async def heartbeat_loop(stop_event: asyncio.Event):
    """
    Sends a heartbeat POST to the SOC API every 15s so endpoint_registry
    is populated immediately — even before the first gRPC cycle completes.
    """
    import urllib.request, json as _json
    url = f"{SOC_API_URL}/api/agents/heartbeat"

    # Resolve own IP
    try:
        my_ip = _sock.gethostbyname(_sock.gethostname())
    except Exception:
        my_ip = "unknown"

    hb_no = 0
    while not stop_event.is_set():
        hb_no += 1
        try:
            body = _json.dumps({"endpoint_id": ENDPOINT_ID, "ip": my_ip}).encode()
            req  = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=5) as resp:
                result = _json.loads(resp.read())
            logger.debug("[heartbeat] #%d → %s ok=%s", hb_no, url, result.get("ok"))
        except Exception as e:
            logger.warning("[heartbeat] #%d failed: %s", hb_no, e)

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            pass




async def fetch_loop(pkt_queue: asyncio.Queue, stop_event: asyncio.Event):
    """
    Perform a single POST upload of IMAGE_FILE to TARGET_URL.
    """
    IMAGE_FILE = os.environ.get("IMAGE_FILE", "")
    if not TARGET_URL or not IMAGE_FILE:
        logger.info("[fetch_loop] No TARGET_URL or IMAGE_FILE set — idle.")
        await stop_event.wait()
        return

    marker_path = pathlib.Path(SEND_ONCE_MARKER)
    if marker_path.exists():
        logger.info("[fetch_loop] Send-once marker exists (%s). Skipping upload.", marker_path)
        await stop_event.wait()
        return

    logger.info("[fetch_loop] Starting single upload — file=%s target=%s", IMAGE_FILE, TARGET_URL)

    # Initial warm-up delay so routing comes fully online
    await asyncio.sleep(12)

    try:
        env = os.environ.copy()
        env["SSLKEYLOGFILE"] = KEYLOG_PATH

        proc = subprocess.run(
            ["curl", "-s", "-S", "-k", "-X", "POST", "-H", "Content-Type: image/jpeg", "--data-binary", f"@{IMAGE_FILE}", TARGET_URL],
            env=env, capture_output=True, timeout=15,
        )
        logger.info(
            "[fetch_loop] Upload completed. rc=%d stdout=%s stderr=%s",
            proc.returncode, proc.stdout.decode()[:100], proc.stderr.decode(errors="ignore")[:200],
        )

        if proc.returncode == 0:
            marker_path.parent.mkdir(parents=True, exist_ok=True)
            marker_path.write_text(str(int(_time.time())), encoding="utf-8")
            logger.info("[fetch_loop] Send-once marker written: %s", marker_path)
        else:
            logger.warning("[fetch_loop] Upload failed, marker not written (rc=%d)", proc.returncode)

    except subprocess.TimeoutExpired:
        logger.error("[fetch_loop] Upload TIMED OUT for %s", TARGET_URL)
    except Exception as e:
        logger.error("[fetch_loop] Upload error: %s", e, exc_info=True)

    # After single upload, just wait forever so sniffer and gRPC stay alive
    logger.info("[fetch_loop] Upload finished. Waiting for shutdown.")
    await stop_event.wait()


async def main():
    stop_event = asyncio.Event()
    pkt_queue  = asyncio.Queue(maxsize=QUEUE_SIZE)
    key_queue  = asyncio.Queue(maxsize=QUEUE_SIZE)

    loop = asyncio.get_event_loop()

    def _handle_signal():
        logger.info("[Agent] Shutdown signal received.")
        stop_event.set()

    loop.add_signal_handler(signal.SIGTERM, _handle_signal)
    loop.add_signal_handler(signal.SIGINT,  _handle_signal)

    logger.info(
        "[Agent] Starting — id=%s iface=%s keylog=%s target=%s capture_filter=%s marker=%s fetch_interval=%ds",
        ENDPOINT_ID, IFACE, KEYLOG_PATH, TARGET_URL or "(none)", CAPTURE_FILTER, SEND_ONCE_MARKER, FETCH_INTERVAL,
    )

    tasks = [
        asyncio.create_task(capture_loop(IFACE, pkt_queue, stop_event, CAPTURE_FILTER), name="sniffer"),
        asyncio.create_task(watch_keylog(KEYLOG_PATH, key_queue, stop_event),   name="key-extractor"),
        asyncio.create_task(stream_to_router(pkt_queue, key_queue, stop_event), name="grpc-stream"),
        asyncio.create_task(fetch_loop(pkt_queue, stop_event),                  name="fetch-loop"),
        asyncio.create_task(heartbeat_loop(stop_event),                         name="heartbeat"),
    ]

    # Wait for ALL tasks (or stop_event) — not FIRST_EXCEPTION
    await stop_event.wait()

    logger.info("[Agent] Stopping all tasks...")
    for t in tasks:
        t.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
    logger.info("[Agent] Endpoint Agent stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(main())
