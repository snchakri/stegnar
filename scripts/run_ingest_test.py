#!/usr/bin/env python3
"""Run a sample ingest test against the local SOC API.

Usage: python scripts/run_ingest_test.py

Posts `test_images/cover_test00001.jpg` to `/api/ingest/image` and polls
`/api/ingest/jobs/<job_id>` until completion (timeout ~3 minutes).
"""
import json
import os
import pathlib
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = os.environ.get("API_URL", "http://localhost:3001")
IMG = ROOT / "test_images" / "cover_test00001.jpg"

if not IMG.exists():
    print("Test image not found:", IMG)
    sys.exit(2)

def post_image():
    boundary = "----WebKitFormBoundarystest"
    data = []
    with open(IMG, "rb") as f:
        img_bytes = f.read()

    filename = IMG.name
    part = (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\n"
        "Content-Type: image/jpeg\r\n\r\n"
    ).encode("utf-8") + img_bytes + b"\r\n"
    ending = (f"--{boundary}--\r\n").encode("utf-8")
    body = part + ending

    req = urllib.request.Request(f"{API}/api/ingest/image", data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")

    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8")
        return json.loads(text)

def poll_job(job_id, timeout=180):
    start = time.time()
    url = f"{API}/api/ingest/jobs/{job_id}"
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(url, timeout=10) as r:
                job = json.loads(r.read().decode())
        except Exception as e:
            print("Polling error:", e)
            time.sleep(1)
            continue

        status = job.get("status")
        print("Job", job_id, "status=", status)
        if status in ("completed", "failed"):
            return job
        time.sleep(1)
    raise TimeoutError("Job did not complete in time")

if __name__ == '__main__':
    print("Posting test image to SOC API...", API)
    res = post_image()
    print("Post response:", res)
    job_id = res.get("job_id")
    if not job_id:
        print("No job_id returned; response:", res)
        sys.exit(3)
    job = poll_job(job_id, timeout=180)
    print("Final job state:")
    print(json.dumps(job, indent=2))
    if job.get("status") == "completed":
        print("Ingest test completed OK")
        sys.exit(0)
    else:
        print("Ingest test failed")
        sys.exit(4)
