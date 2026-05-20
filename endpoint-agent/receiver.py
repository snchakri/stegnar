"""
receiver.py — Simple HTTP server for RECEIVER nodes in the Throw-and-Catch demo.
Listens on port 80 and accepts POST /upload to save images as physical proofs.
"""
import os
import cgi
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

SAVE_DIR = Path("/received_images")

class ReceiverHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[RECEIVER] {self.address_string()} - {format % args}", flush=True)

    def do_POST(self):
        if self.path == "/upload":
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length == 0:
                self.send_error(400, "Missing Content-Length")
                return

            import uuid
            filename = f"received_{uuid.uuid4().hex[:8]}.jpg"
            SAVE_DIR.mkdir(parents=True, exist_ok=True)
            save_path = SAVE_DIR / filename
            
            with open(save_path, "wb") as f:
                f.write(self.rfile.read(content_length))
            
            print(f"[RECEIVER] Successfully saved {filename} to {save_path} ({content_length} bytes)", flush=True)
            
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Upload successful")
            return
            
        self.send_error(404, "Not Found")

    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Receiver is active")

def main():
    print("[RECEIVER] Starting HTTP server on port 80...", flush=True)
    server = HTTPServer(("0.0.0.0", 80), ReceiverHandler)
    server.serve_forever()

if __name__ == "__main__":
    main()
