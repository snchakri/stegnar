import http.server
import socketserver
import os

PORT = 8080

class DynamicHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Intercept and dynamically configure installer scripts
        if self.path in ("/install.sh", "/install.ps1"):
            # Resolve server hostname/IP from Host header
            host_header = self.headers.get("Host", "localhost")
            server_ip = host_header.split(":")[0]

            # Read script template
            file_name = "install.sh" if self.path == "/install.sh" else "install.ps1"
            file_path = os.path.join("/app", file_name)

            if not os.path.exists(file_path):
                self.send_error(404, f"Script Template Not Found: {file_name}")
                return

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Dynamic IP/Host injection
            configured_content = content.replace("__SERVER_IP_PLACEHOLDER__", server_ip)

            # Serve dynamic response
            self.send_response(200)
            content_type = "text/x-shellscript" if file_name.endswith(".sh") else "text/plain"
            self.send_header("Content-Type", f"{content_type}; charset=utf-8")
            self.send_header("Content-Length", str(len(configured_content.encode("utf-8"))))
            self.end_headers()
            self.wfile.write(configured_content.encode("utf-8"))
            return

        elif self.path == "/mitmproxy-ca-cert.pem":
            # Handle CA certificate path translation
            target_path = "/app/certs/mitmproxy-ca-cert.pem"
            if not os.path.exists(target_path):
                self.send_error(404, "CA Certificate Not Found")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/x-x509-ca-cert")
            self.send_header("Content-Length", str(os.path.getsize(target_path)))
            self.end_headers()
            with open(target_path, "rb") as f:
                self.wfile.write(f.read())
            return

        # Fallback to standard handler for static files (like agent.tar.gz and agent.zip)
        super().do_GET()

with socketserver.TCPServer(("", PORT), DynamicHandler) as httpd:
    print(f"Dynamic Install Server running on port {PORT}")
    httpd.serve_forever()
