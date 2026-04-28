"""
calpa_runner.py — Python 3.11 wrapper that calls the TF1 subprocess.

Provides an async function to submit an image to the TF1 worker and parse the result.
"""

import asyncio
import json
import logging
import os
import tempfile

logger = logging.getLogger("stegnar.mitm.calpa")

PYTHON_CMD   = os.environ.get("CALPA_PYTHON_PATH", "/opt/tf1/bin/python3.7")
MODEL_PATH   = os.environ.get("CALPA_MODEL_PATH", "/calpa/generated_cfg_and_model/trained_pruned_model/Model_438375.ckpt")
MODEL_TYPE   = os.environ.get("CALPA_MODEL_TYPE", "srnet")
LIBS_PATH    = os.environ.get("CALPA_LIBS_PATH",  "/calpa/libs")
TIMEOUT_SEC  = int(os.environ.get("CALPA_TIMEOUT_SEC", "120"))

WORKER_SCRIPT = "/app/calpa_worker.py"


async def analyze_image(image_bytes: bytes) -> dict:
    """
    Writes image to a temp file, calls the TF1 subprocess, and returns the result dict.
    Returns: {"predicted_label": str, "confidence": float, "raw_score": float, "latency_ms": int}
    Raises Exception on worker failure.
    """
    import time
    start_time = time.time()

    # Write bytes to temp file (worker expects a file path)
    fd, tmp_path = tempfile.mkstemp(suffix=".png")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(image_bytes)

        payload = json.dumps({
            "image_path": tmp_path,
            "model_type": MODEL_TYPE,
            "model_path": MODEL_PATH,
            "libs_path":  LIBS_PATH,
        })

        # Run subprocess asynchronously
        proc = await asyncio.create_subprocess_exec(
            PYTHON_CMD, WORKER_SCRIPT,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await asyncio.wait_for(
            proc.communicate(input=payload.encode()),
            timeout=TIMEOUT_SEC
        )

        if proc.returncode != 0:
            err_msg = stderr.decode().strip()
            logger.error("TF1 Worker failed (exit %d): %s", proc.returncode, err_msg)
            raise RuntimeError(f"worker exit {proc.returncode}: {err_msg}")

        # Parse JSON from stdout
        out_str = stdout.decode().strip()
        # Find the last valid JSON line (in case worker printed other things)
        last_line = out_str.split("\n")[-1]
        try:
            result = json.loads(last_line)
        except json.JSONDecodeError as e:
            logger.error("Failed to parse worker JSON: %s (output: %s)", e, last_line)
            raise RuntimeError(f"invalid JSON from worker: {last_line}")

        if "error" in result:
            raise RuntimeError(result["error"])

        latency_ms = int((time.time() - start_time) * 1000)
        result["latency_ms"] = latency_ms
        return result

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
