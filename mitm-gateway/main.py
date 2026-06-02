"""
main.py — MITM Gateway entry point.

Starts the gRPC server to receive AnalysisRequests from the Routing System.
In this prototype version, we perform analysis *out-of-band* of the live flow,
acting as a specialized gRPC microservice that executes CALPA-NET.
"""

import asyncio
import logging
import os
import signal

import grpc
import grpc.experimental.aio as aio

import sys
sys.path.insert(0, "/app/proto")
import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

from calpa_runner import analyze_image

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger("stegnar.mitm.main")

LISTEN_ADDR = os.environ.get("GRPC_LISTEN_ADDR", "0.0.0.0:50052")


class AnalysisServicer(pb_grpc.AnalysisServiceServicer):
    async def AnalyzeImage(self, request: pb.AnalysisRequest, context):  # noqa: N802
        logger.info(
            "Received analysis request: stream=%s sha=%s bytes=%d",
            request.stream_id, request.sha256[:12], len(request.image_bytes)
        )
        try:
            res = await analyze_image(request.image_bytes)
            logger.info("CALPA-NET success: %s", res)
            return pb.AnalysisResult(
                stream_id  = request.stream_id,
                verdict    = res["predicted_label"],
                confidence = res["confidence"],
                raw_score  = res["raw_score"],
                model_type = "srnet",
                latency_ms = res["latency_ms"],
            )
        except Exception as e:
            logger.error("Analysis failed: %s", e)
            return pb.AnalysisResult(
                stream_id = request.stream_id,
                verdict   = "ERROR",
                error     = str(e),
            )


async def serve():
    server = aio.server(
        options=[
            ("grpc.max_receive_message_length", 50 * 1024 * 1024),
            ("grpc.max_send_message_length",    50 * 1024 * 1024),
        ]
    )
    pb_grpc.add_AnalysisServiceServicer_to_server(AnalysisServicer(), server)

    server.add_insecure_port(LISTEN_ADDR)
    logger.info("MITM Gateway gRPC server starting on %s", LISTEN_ADDR)
    await server.start()

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
    logger.info("MITM Gateway stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(serve())
