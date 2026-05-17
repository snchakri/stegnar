import http.server
import socketserver
import os

PORT = 8080

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        if path == "/mitmproxy-ca-cert.pem":
            return "/app/certs/mitmproxy-ca-cert.pem"
        elif path == "/install.sh":
            return "/app/install.sh"
        elif path == "/install.ps1":
            return "/app/install.ps1"
        return super().translate_path(path)

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Install server running on port {PORT}")
    httpd.serve_forever()
