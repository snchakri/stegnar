"""
proxy_addon.py — mitmproxy addon for transparent MITM interception.

This script hooks into mitmproxy's event loop to intercept HTTP/HTTPS responses.
If a response contains an image, it pauses the flow, extracts the image bytes,
and calls the local CALPA-NET subprocess for steganalysis.

If the image is detected as STEGO, it can block the response, flag it,
or rewrite it (depending on the enforcement policy).
"""

import logging
from mitmproxy import http
from mitmproxy.script import concurrent

# Import our local async wrapper for the TF1 CALPA-NET worker
import asyncio
from calpa_runner import analyze_image

logger = logging.getLogger("stegnar.mitm.proxy")


class StegnarInterceptor:
    def __init__(self):
        self.total_images = 0
        self.stego_detected = 0

    @concurrent
    def response(self, flow: http.HTTPFlow):
        """Hook called when a response is received from the target server."""
        
        # 1. Filter: Only process image responses
        content_type = flow.response.headers.get("Content-Type", "")
        if not content_type.startswith("image/"):
            return

        # Mitmproxy's flow.response.content contains the decrypted payload
        image_bytes = flow.response.content
        if not image_bytes:
            return

        self.total_images += 1
        client_ip = flow.client_conn.peername[0]
        logger.info(f"[PROXY] Intercepted {content_type} ({len(image_bytes)} bytes) to {client_ip}")

        # 2. Steganalysis (synchronous blocking call within the thread pool)
        # We must use asyncio.run to call our async analyze_image function
        # because @concurrent runs this hook in a separate thread.
        try:
            result = asyncio.run(analyze_image(image_bytes))
            verdict = result.get("predicted_label", "ERROR")
            confidence = result.get("confidence", 0.0)
            latency = result.get("latency_ms", 0)

            logger.info(f"[PROXY] CALPA-NET Verdict: {verdict} (score: {confidence:.3f}) in {latency}ms")

            # 3. Enforcement
            if verdict == "STEGO":
                self.stego_detected += 1
                logger.warning(f"[PROXY] STEGO DETECTED! Dropping payload to {client_ip}.")
                # Overwrite the payload with a block message or 403
                flow.response.status_code = 403
                flow.response.content = b"STEGNAR: Malicious Steganographic Payload Blocked"
                flow.response.headers["Content-Type"] = "text/plain"
                flow.response.headers["X-Stegnar-Verdict"] = "STEGO"
            else:
                # Let it pass cleanly
                flow.response.headers["X-Stegnar-Verdict"] = "CLEAN"

        except Exception as e:
            logger.error(f"[PROXY] CALPA inference failed: {e}")
            flow.response.headers["X-Stegnar-Error"] = "Inference Failed"


addons = [
    StegnarInterceptor()
]
