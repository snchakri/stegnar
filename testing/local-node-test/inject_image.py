"""
inject_image.py — Direct image injection to CALPA-NET via AnalysisService gRPC.

WHY THIS EXISTS:
  The normal path (Scapy capture → raw bytes → routing → tshark decrypt → JPEG carve)
  fails for WINDOWS-HOST because:
    1. The Windows agent sends encrypted TLS payload bytes.
    2. The synthesized PCAP has no real TLS handshake, so tshark can't use SSL keys.
    3. The regex JPEG carve also fails because the data is ciphertext.

  This script bypasses the broken PCAP pipeline entirely and calls
  AnalysisService.AnalyzeImage directly (port 50052, the mitm/CALPA-NET gateway),
  which is exactly what the routing system does after a successful image carve.

USAGE:
  python inject_image.py [path/to/image.jpg]   (defaults to stego/11.jpg)

  Run this from the stegnar_prototype directory, or anywhere with the .venv active.
"""

import hashlib
import logging
import os
import sys
import time

# ── Path bootstrap (same as grpc_client.py) ──────────────────────────────────
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

import grpc
import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

# ── Config ────────────────────────────────────────────────────────────────────
MITM_ADDR   = os.environ.get("MITM_GRPC_ADDR",    "localhost:50052")
ENDPOINT_ID = os.environ.get("ENDPOINT_ID",        "WINDOWS-HOST")
SRC_IP      = os.environ.get("LOCAL_IP",           "192.168.29.30")
DST_IP      = "drive.google.com"

STEGO_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "test_images", "demo_data", "stego",
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("inject_image")


def pick_image(argv) -> str:
    """Return the image path from argv, or default to stego/11.jpg."""
    if len(argv) > 1:
        path = argv[1]
        if not os.path.isabs(path):
            path = os.path.abspath(path)
        return path

    # Default: the largest JPEG stego image
    default = os.path.join(STEGO_DIR, "11.jpg")
    if os.path.exists(default):
        return default

    # Fallback: any .jpg in stego dir
    for f in os.listdir(STEGO_DIR):
        if f.lower().endswith(".jpg"):
            return os.path.join(STEGO_DIR, f)

    log.error("No image found in %s and none provided on command line.", STEGO_DIR)
    sys.exit(1)


def main():
    image_path = pick_image(sys.argv)

    if not os.path.exists(image_path):
        log.error("Image not found: %s", image_path)
        sys.exit(1)

    with open(image_path, "rb") as f:
        image_bytes = f.read()

    sha256 = hashlib.sha256(image_bytes).hexdigest()
    stream_id = f"{SRC_IP}:443-{DST_IP}:443"
    size_kb = len(image_bytes) / 1024

    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info(" Stegnar Direct Image Injector")
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    log.info(" Image    : %s", os.path.basename(image_path))
    log.info(" Size     : %.1f KB (%d bytes)", size_kb, len(image_bytes))
    log.info(" SHA-256  : %s", sha256[:16] + "...")
    log.info(" Endpoint : %s", ENDPOINT_ID)
    log.info(" Stream   : %s", stream_id)
    log.info(" Target   : AnalysisService @ %s", MITM_ADDR)
    log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    request = pb.AnalysisRequest(
        stream_id   = stream_id,
        image_bytes = image_bytes,
        sha256      = sha256,
        endpoint_id = ENDPOINT_ID,
        src_ip      = SRC_IP,
        dst_ip      = DST_IP,
    )

    log.info("Sending to AnalysisService.AnalyzeImage ...")
    t0 = time.time()

    try:
        with grpc.insecure_channel(MITM_ADDR) as channel:
            stub = pb_grpc.AnalysisServiceStub(channel)
            result: pb.AnalysisResult = stub.AnalyzeImage(request, timeout=60)

        elapsed = (time.time() - t0) * 1000

        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        log.info(" RESULT RECEIVED in %.0f ms", elapsed)
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        log.info(" Verdict    : %s", result.verdict)
        log.info(" Confidence : %.4f", result.confidence)
        log.info(" Raw Score  : %.4f", result.raw_score)
        log.info(" Model      : %s", result.model_type)
        log.info(" Latency    : %d ms", result.latency_ms)
        if result.error:
            log.warning(" Error      : %s", result.error)
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

        if result.verdict in ("STEGO", "STEGO_DETECTED"):
            log.info(" ✓ STEGANOGRAPHY DETECTED — check http://localhost:3000")
        elif result.verdict == "CLEAN":
            log.info(" ✓ Image classified as CLEAN")
        else:
            log.info(" ? Verdict: %s", result.verdict)

        return 0

    except grpc.RpcError as e:
        log.error("gRPC error: [%s] %s", e.code(), e.details())
        log.error("Is the mitm container running? (docker ps | grep mitm)")
        return 1
    except Exception as e:
        log.error("Unexpected error: %s", e, exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
