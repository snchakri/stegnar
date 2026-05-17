"""
probe_server.py  —  Flask HTTP server (Python 3.11) wrapping the TF1 worker subprocess.

Endpoints:
  GET  /health              — liveness check
  POST /infer               — JSON body: {"image_path": "/images/foo.png"}
  POST /infer-upload        — multipart form-data: file=<image>
  GET  /scan-all            — scans every file in /images/ and returns results

The Flask server calls /opt/tf1/bin/python calpa_worker.py via subprocess,
passing a JSON request over stdin and reading the JSON result from stdout.
"""

import json
import os
import subprocess
import tempfile
import time
from pathlib import Path

from flask import Flask, jsonify, request

app = Flask(__name__)

# ── Runtime configuration ─────────────────────────────────────────────────────
CALPA_PYTHON   = os.environ.get("CALPA_PYTHON_PATH", "/opt/tf1/bin/python")
CALPA_MODEL    = os.environ.get("CALPA_MODEL_PATH",  "/models/Model_438375.ckpt")
CALPA_TYPE     = os.environ.get("CALPA_MODEL_TYPE",  "srnet")
CALPA_LIBS     = os.environ.get("CALPA_LIBS_PATH",   "/calpa/libs")
WORKER_SCRIPT  = Path(__file__).parent / "calpa_worker.py"
IMAGES_DIR     = Path("/images")
TIMEOUT_SEC    = int(os.environ.get("CALPA_TIMEOUT_SEC", "120"))

# Supported image extensions
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff"}


def run_calpa(image_path: str, artifact_id: str = "") -> dict:
    """Invoke the TF1 worker in a subprocess; return parsed JSON result."""
    payload = json.dumps({
        "image_path": image_path,
        "model_type": CALPA_TYPE,
        "model_path": CALPA_MODEL,
        "libs_path":  CALPA_LIBS,
        "artifact_id": artifact_id,
    })

    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            [CALPA_PYTHON, str(WORKER_SCRIPT)],
            input=payload.encode(),
            capture_output=True,
            timeout=TIMEOUT_SEC,
        )
    except subprocess.TimeoutExpired:
        return {"error": f"inference timed out after {TIMEOUT_SEC}s", "image": image_path}

    latency_ms = int((time.monotonic() - t0) * 1000)
    stdout = proc.stdout.decode(errors="replace").strip()
    stderr = proc.stderr.decode(errors="replace").strip()

    if proc.returncode != 0:
        return {
            "error": f"worker exit {proc.returncode}: {stderr[:400]}",
            "image": image_path,
        }

    if not stdout:
        return {"error": "worker returned empty stdout", "image": image_path}

    try:
        result = json.loads(stdout)
    except json.JSONDecodeError as e:
        return {"error": f"invalid JSON from worker: {e} — {stdout[:200]}", "image": image_path}

    result["latency_ms"] = latency_ms
    result["image"]      = image_path
    if stderr:
        # TF1 spews deprecation warnings to stderr — keep them for debug
        result["stderr_preview"] = stderr[:500]
    return result


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_type": CALPA_TYPE,
        "model_path": CALPA_MODEL,
        "calpa_python": CALPA_PYTHON,
        "libs_path": CALPA_LIBS,
    })


@app.post("/infer")
def infer():
    """
    JSON body:
      { "image_path": "/images/test.png", "artifact_id": "optional-id" }
    Returns:
      { "predicted_label": "CLEAN"|"STEGO", "confidence": 0.73, "latency_ms": 1200, ... }
    """
    body = request.get_json(force=True, silent=True) or {}
    img_path = body.get("image_path", "")
    if not img_path:
        return jsonify({"error": "image_path is required"}), 400
    if not Path(img_path).exists():
        return jsonify({"error": f"file not found: {img_path}"}), 404

    result = run_calpa(img_path, artifact_id=body.get("artifact_id", ""))
    status = 500 if "error" in result else 200
    return jsonify(result), status


@app.post("/infer-upload")
def infer_upload():
    """
    Multipart upload — field name: 'file'
    Saves the uploaded image to a tempfile, runs CALPA, returns result.
    """
    if "file" not in request.files:
        return jsonify({"error": "no file field in request"}), 400

    f = request.files["file"]
    suffix = Path(f.filename).suffix or ".png"

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir="/tmp") as tmp:
        tmp_path = tmp.name
        f.save(tmp_path)

    try:
        result = run_calpa(tmp_path, artifact_id=f.filename)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    status = 500 if "error" in result else 200
    return jsonify(result), status


@app.get("/scan-all")
def scan_all():
    """
    Scans every image in /images/ and returns a list of results.
    Query params:
      ?recursive=1   — also descend into subdirectories
    """
    recursive = request.args.get("recursive", "0") == "1"

    if not IMAGES_DIR.exists():
        return jsonify({"error": "/images directory not found in container"}), 500

    pattern = "**/*" if recursive else "*"
    files = [
        p for p in IMAGES_DIR.glob(pattern)
        if p.is_file() and p.suffix.lower() in IMAGE_EXTS
    ]

    if not files:
        return jsonify({"warning": "no image files found in /images/", "results": []})

    results = []
    for fp in sorted(files):
        r = run_calpa(str(fp), artifact_id=fp.name)
        results.append(r)

    summary = {
        "total": len(results),
        "stego": sum(1 for r in results if r.get("predicted_label") == "STEGO"),
        "clean": sum(1 for r in results if r.get("predicted_label") == "CLEAN"),
        "errors": sum(1 for r in results if "error" in r),
    }

    return jsonify({"summary": summary, "results": results})


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"[PROBE] CALPA-NET probe server starting")
    print(f"[PROBE]   python  : {CALPA_PYTHON}")
    print(f"[PROBE]   model   : {CALPA_MODEL}")
    print(f"[PROBE]   type    : {CALPA_TYPE}")
    print(f"[PROBE]   libs    : {CALPA_LIBS}")
    print(f"[PROBE]   images  : {IMAGES_DIR}")
    app.run(host="0.0.0.0", port=8080, debug=False)
