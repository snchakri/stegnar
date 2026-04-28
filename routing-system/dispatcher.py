"""
dispatcher.py — Dispatch image bytes to the MITM Gateway for CALPA-NET analysis.

Sends an AnalyzeImage gRPC call to the gateway and returns an AnalysisResult.
Uses a simple round-robin pool (single gateway for vTBP, expandable later).
"""

import logging
import os

import grpc
import grpc.experimental.aio as aio

import sys
sys.path.insert(0, "/app/proto")

import stegnar_pb2 as pb
import stegnar_pb2_grpc as pb_grpc

logger = logging.getLogger("stegnar.routing.dispatcher")

MITM_ADDR = os.environ.get("MITM_GRPC_ADDR", "mitm:50052")


class MITMDispatcher:
    def __init__(self):
        self._channel = None
        self._stub    = None

    async def connect(self):
        self._channel = aio.insecure_channel(
            MITM_ADDR,
            options=[
                ("grpc.max_receive_message_length", 50 * 1024 * 1024),  # 50 MB
                ("grpc.max_send_message_length",    50 * 1024 * 1024),
                ("grpc.keepalive_time_ms",          20_000),
                ("grpc.keepalive_timeout_ms",       10_000),
            ]
        )
        self._stub = pb_grpc.AnalysisServiceStub(self._channel)
        logger.info("MITM dispatcher connected to %s", MITM_ADDR)

    async def analyze(
        self,
        stream_id:   str,
        image_bytes: bytes,
        sha256:      str,
        endpoint_id: str,
        src_ip:      str = "",
        dst_ip:      str = "",
        timeout:     int = 130,
    ) -> pb.AnalysisResult:
        """
        Dispatch an image to the MITM Gateway for CALPA-NET inference.
        Returns AnalysisResult proto.
        """
        req = pb.AnalysisRequest(
            stream_id   = stream_id,
            image_bytes = image_bytes,
            sha256      = sha256,
            endpoint_id = endpoint_id,
            src_ip      = src_ip,
            dst_ip      = dst_ip,
        )
        try:
            result: pb.AnalysisResult = await self._stub.AnalyzeImage(req, timeout=timeout)
            logger.info(
                "Analysis result: stream=%s verdict=%s confidence=%.3f latency=%dms",
                stream_id, result.verdict, result.confidence, result.latency_ms
            )
            return result
        except grpc.aio.AioRpcError as e:
            logger.error("MITM gRPC error: %s", e)
            # Return a synthetic ERROR result rather than crashing
            return pb.AnalysisResult(
                stream_id = stream_id,
                verdict   = "ERROR",
                error     = str(e),
            )

    async def close(self):
        if self._channel:
            await self._channel.close()
