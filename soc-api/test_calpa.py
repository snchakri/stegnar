
import subprocess, json, sys, os

IMAGE_HOST      = r"C:\Users\AYESHA\Downloads\test_cover.png"
IMAGE_CONTAINER = "/tmp/test_cover.png"
CONTAINER       = "stegnar-mitm"
CALPA_PY        = "/opt/tf1/bin/python3.7"
CALPA_WORKER    = "/app/calpa_worker.py"
MODEL_PATH      = "/calpa/generated_cfg_and_model/trained_pruned_model/Model_438375.ckpt"
LIBS_PATH       = "/tmp/patched_libs"

def run(cmd, stdin=None, timeout=300):
    return subprocess.run(cmd, input=stdin, capture_output=True, timeout=timeout)

print("=" * 60)
print("STEGNAR CALPA Direct Test (with protobuf fix)")
print("=" * 60)

# Copy image
print("\n[1] Copying image into container...")
r = run(["docker", "cp", IMAGE_HOST, f"{CONTAINER}:{IMAGE_CONTAINER}"])
print("    OK" if r.returncode == 0 else f"    FAILED: {r.stderr.decode()}")

# Check model
print("\n[2] Checking model checkpoint files...")
r = run(["docker", "exec", CONTAINER, "ls", "/calpa/generated_cfg_and_model/trained_pruned_model/"])
print(f"    {r.stdout.decode().strip()}")

# Check protobuf in TF1 python
print("\n[3] Checking protobuf in TF1 Python 3.7...")
r = run(["docker", "exec", "-e", "PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python",
         CONTAINER, CALPA_PY, "-c",
         "import google.protobuf; print('protobuf version:', google.protobuf.__version__)"])
print(f"    {r.stdout.decode().strip()}")
if r.returncode != 0:
    print(f"    ERROR: {r.stderr.decode()[:200]}")

# Run CALPA with fix
print(f"\n[4] Running CALPA worker with protobuf fix...")
payload = json.dumps({
    "image_path":  IMAGE_CONTAINER,
    "model_type":  "srnet",
    "model_path":  MODEL_PATH,
    "libs_path":   LIBS_PATH,
    "artifact_id": "test_cover",
})
print(f"    Payload: {payload}")
print(f"    Please wait (1-3 min on CPU)...")

try:
    r = run(
        ["docker", "exec", "-i",
         "-e", "PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION=python",
         CONTAINER, CALPA_PY, CALPA_WORKER],
        stdin=payload.encode("utf-8"),
        timeout=300,
    )
    stdout = r.stdout.decode("utf-8", errors="replace").strip()
    stderr = r.stderr.decode("utf-8", errors="replace").strip()

    print(f"\n    Return code: {r.returncode}")
    print(f"    STDOUT: {stdout[:600]}")
    if stderr: print(f"    STDERR: {stderr[:300]}")

    if r.returncode == 0 and stdout:
        try:
            result = json.loads(stdout)
            label  = result.get("predicted_label", "UNKNOWN")
            score  = result.get("confidence", 0)
            ms     = result.get("latency_ms", 0)
            print(f"\n{'=' * 60}")
            print(f"  Label:    {label}")
            print(f"  Score:    {score*100:.1f}%")
            print(f"  Latency:  {ms}ms")
            print(f"  Decision: {'⚠ STEGANOGRAPHY DETECTED' if label == 'STEGO' else '✓ CLEAN'}")
            print(f"{'=' * 60}")
        except:
            print("    Could not parse JSON output")
    else:
        print("    CALPA failed — check stderr above")

except subprocess.TimeoutExpired:
    print("    TIMEOUT after 5 minutes")
except Exception as e:
    print(f"    ERROR: {e}")