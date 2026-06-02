"""
send_image_chunk.py — Sends a stego image directly through the RouterService
StreamPayload gRPC, disguised as a single captured packet containing raw JPEG bytes.

WHY THIS WORKS:
  The routing server's pcap_builder has a fallback path:
    1. Try tshark HTTP object export (fails for encrypted streams)
    2. Fallback: regex scan raw bytes for JPEG magic (\\xff\\xd8\\xff)
       → if found, carve the bytes and dispatch to CALPA-NET

  By sending the raw JPEG bytes as the `raw_bytes` field of a PayloadChunk,
  the routing server will successfully carve the JPEG, run CALPA-NET,
  and write the verdict to network_events / the SOC dashboard.

USAGE:
  python send_image_chunk.py [path/to/image.jpg]
"""

import hashlib
import logging
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import grpc
import grpc.experimental.aio as aio
import asyncio

import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

# ── Config ────────────────────────────────────────────────────────────────────
ROUTER_ADDR = os.environ.get("ROUTER_GRPC_ADDR", "localhost:50051")
ENDPOINT_ID = os.environ.get("ENDPOINT_ID",       "WINDOWS-HOST")
SRC_IP      = "192.168.29.30"
DST_IP      = "142.250.77.1"   # Google IP

STEGO_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "test_images", "demo_data", "stego",
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("send_image_chunk")


def pick_image(argv) -> str:
    if len(argv) > 1:
        p = argv[1]
        return os.path.abspath(p) if not os.path.isabs(p) else p
    default = os.path.join(STEGO_DIR, "11.jpg")
    if os.path.exists(default):
        return default
    for f in os.listdir(STEGO_DIR):
        if f.lower().endswith(".jpg"):
            return os.path.join(STEGO_DIR, f)
    log.error("No image found. Pass path as argument.")
    sys.exit(1)


async def send():
    image_path = pick_image(sys.argv)
    if not os.path.exists(image_path):
        log.error("File not found: %s", image_path)
        return 1

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    # Verify it starts with JPEG magic — routing's regex carve requires this
    if not image_bytes[:3] == b"\xff\xd8\xff":
        log.error("Not a JPEG file (no \\xff\\xd8\\xff header): %s", image_path)
        return 1

    sha256    = hashlib.sha256(image_bytes).hexdigest()
    stream_id = f"{SRC_IP}:55443-{DST_IP}:443"
    ts_ms     = int(time.time() * 1000)

    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info(" Stegnar Image → RouterService (StreamPayload)")
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info(" Image     : %s  (%.1f KB)", os.path.basename(image_path), len(image_bytes)/1024)
    log.info(" SHA-256   : %s...", sha256[:16])
    log.info(" Stream ID : %s", stream_id)
    log.info(" Endpoint  : %s", ENDPOINT_ID)
    log.info(" Router    : %s", ROUTER_ADDR)
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # Build a single PayloadChunk with the raw JPEG as raw_bytes.
    # The routing server's fallback carver will find \xff\xd8\xff and carve it.
    chunk = pb.PayloadChunk(
        endpoint_id = ENDPOINT_ID,
        stream_id   = stream_id,
        raw_bytes   = image_bytes,
        sha256      = sha256,
        ssl_keylog  = "",            # No keys needed — we're sending plaintext JPEG
        src_ip      = SRC_IP,
        dst_ip      = DST_IP,
        src_port    = 55443,
        dst_port    = 443,
        captured_at = ts_ms,
    )

    async def _gen():
        yield chunk

    log.info("Streaming 1 chunk (%d bytes) to RouterService ...", len(image_bytes))
    t0 = time.time()

    try:
        async with aio.insecure_channel(ROUTER_ADDR) as channel:
            stub = pb_grpc.RouterServiceStub(channel)
            ack: pb.StreamAck = await stub.StreamPayload(_gen())

        elapsed = (time.time() - t0) * 1000
        log.info("ACK received in %.0f ms: ok=%s chunks_recv=%d msg=%s",
                 elapsed, ack.ok, ack.chunks_recv, ack.message)

        if ack.ok:
            log.info("")
            log.info("Stream closed — routing server is now processing...")
            log.info("Check http://localhost:3000 in ~10 seconds for the STEGO event.")
            log.info("")
            log.info("Or query the DB directly:")
            log.info("  docker exec stegnar-postgres psql -U stegnar -d stegnar \\")
            log.info("    -c \"SELECT endpoint_id, verdict, steg_score, ts FROM network_events ORDER BY ts DESC LIMIT 3;\"")
        else:
            log.warning("Router returned ok=False: %s", ack.message)

        return 0

    except grpc.aio.AioRpcError as e:
        log.error("gRPC error [%s]: %s", e.code(), e.details())
        return 1
    except Exception as e:
        log.error("Unexpected error: %s", e, exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(send()))
