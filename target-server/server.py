"""
target_server.py — Simple HTTPS server serving cover and stego images.

Routes:
  GET /health        — liveness
  GET /stego.png     — steganographic image (used by victim nodes)
  GET /cover.png     — clean cover image
  GET /random        — randomly returns stego or cover (for demo variety)
"""
import os
import ssl
import hashlib
import random
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

TEST_IMAGES_DIR = Path("/test_images")

# Load the specific images
def _load_images():
    images = {}
    if TEST_IMAGES_DIR.exists():
        for f in TEST_IMAGES_DIR.glob("*.*"):
            if f.suffix.lower() in [".jpg", ".jpeg", ".png"]:
                images[f.name] = f.read_bytes()
    return images

IMAGES = _load_images()


class StegHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[TARGET] {self.address_string()} {fmt % args}")

    def _send(self, code: int, content_type: str, body: bytes):
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-SHA256", hashlib.sha256(body).hexdigest())
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        path = self.path.split("?")[0].lstrip("/")

        if path == "health":
            body = b'{"status":"ok","images":' + str(len(IMAGES)).encode() + b'}'
            self._send(200, "application/json", body)
            return

        if path in IMAGES:
            content_type = "image/jpeg" if path.lower().endswith(".jpg") else "image/png"
            self._send(200, content_type, IMAGES[path])
            return

        self._send(404, "text/plain", b"Not Found")


def run_http_server():
    server = HTTPServer(("0.0.0.0", 80), StegHandler)
    print(f"[TARGET] HTTP server listening on port 80")
    server.serve_forever()


def run_https_server():
    cert_file = Path("/certs/server.crt")
    key_file  = Path("/certs/server.key")

    if not cert_file.exists() or not key_file.exists():
        print("[TARGET] Generating self-signed certificate...")
        import subprocess
        cert_file.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048",
            "-keyout", str(key_file),
            "-out", str(cert_file),
            "-days", "365", "-nodes",
            "-subj", "/CN=target-server/O=STEGNAR/C=IN",
            "-addext", "subjectAltName=DNS:target-server,DNS:localhost,IP:127.0.0.1"
        ], check=True)
        print("[TARGET] Certificate generated.")

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert_file), str(key_file))

    server = HTTPServer(("0.0.0.0", 443), StegHandler)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    print(f"[TARGET] HTTPS server listening on port 443")
    server.serve_forever()


def main():
    print(f"[TARGET] Loaded images: {list(IMAGES.keys())}")
    t_http = threading.Thread(target=run_http_server, daemon=True)
    t_https = threading.Thread(target=run_https_server, daemon=True)
    
    t_http.start()
    t_https.start()
    
    t_http.join()
    t_https.join()

if __name__ == "__main__":
    main()
