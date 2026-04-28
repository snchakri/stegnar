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
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

STEGO_DIR = Path("/images/stego")
COVER_DIR = Path("/images/cover")

# Pre-load a few images at startup
def _load_images(directory: Path, ext=".png"):
    files = list(directory.glob(f"*{ext}")) if directory.exists() else []
    loaded = []
    for f in files[:10]:  # load up to 10
        loaded.append((f.name, f.read_bytes()))
    return loaded

STEGO_IMAGES = _load_images(STEGO_DIR)
COVER_IMAGES = _load_images(COVER_DIR)

# Fallback: generate a tiny synthetic PNG if no images mounted
def _synthetic_png(stego: bool = False) -> bytes:
    """1x1 pixel PNG — just to have something valid for MIME testing."""
    import struct, zlib
    def make_png(r, g, b):
        def chunk(tag, data):
            c = struct.pack('>I', len(data)) + tag + data
            return c + struct.pack('>I', zlib.crc32(c[4:]) & 0xffffffff)
        raw = b'\x00' + bytes([r, g, b, 255])  # filter byte + RGBA
        idat = zlib.compress(raw)
        return (
            b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', idat)
            + chunk(b'IEND', b'')
        )
    return make_png(200, 50, 50) if stego else make_png(50, 150, 200)


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
        path = self.path.split("?")[0]

        if path == "/health":
            body = b'{"status":"ok","stego_count":' + str(len(STEGO_IMAGES)).encode() + b',"cover_count":' + str(len(COVER_IMAGES)).encode() + b'}'
            self._send(200, "application/json", body)

        elif path == "/stego.png":
            if STEGO_IMAGES:
                name, data = random.choice(STEGO_IMAGES)
            else:
                data = _synthetic_png(stego=True)
            self._send(200, "image/png", data)

        elif path == "/cover.png":
            if COVER_IMAGES:
                name, data = random.choice(COVER_IMAGES)
            else:
                data = _synthetic_png(stego=False)
            self._send(200, "image/png", data)

        elif path == "/random":
            use_stego = random.random() > 0.5
            if use_stego and STEGO_IMAGES:
                name, data = random.choice(STEGO_IMAGES)
            elif COVER_IMAGES:
                name, data = random.choice(COVER_IMAGES)
            else:
                data = _synthetic_png(stego=use_stego)
            header = b"stego" if use_stego else b"cover"
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("X-Image-Type", header.decode())
            self.send_header("X-SHA256", hashlib.sha256(data).hexdigest())
            self.end_headers()
            self.wfile.write(data)

        else:
            self._send(404, "text/plain", b"Not Found")


def main():
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
            "-subj", "/CN=stegnar-target/O=STEGNAR/C=IN",
            "-addext", "subjectAltName=DNS:target-server,DNS:localhost,IP:127.0.0.1"
        ], check=True)
        print("[TARGET] Certificate generated.")

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(str(cert_file), str(key_file))

    port = int(os.environ.get("PORT", "443"))
    server = HTTPServer(("0.0.0.0", port), StegHandler)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)

    print(f"[TARGET] HTTPS server listening on port {port}")
    print(f"[TARGET] Stego images: {len(STEGO_IMAGES)}, Cover images: {len(COVER_IMAGES)}")
    server.serve_forever()


if __name__ == "__main__":
    main()
