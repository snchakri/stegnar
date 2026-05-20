#!/bin/sh
set -eu

# Wait for essential services (routing and mitm) to become reachable on their gRPC ports.
# This is a lightweight startup guard for development/demo environments.

python - <<'PY'
import socket, time, sys
hosts = [("routing", 50051), ("mitm", 50052)]
for host, port in hosts:
    tries = 0
    while True:
        try:
            s = socket.create_connection((host, port), timeout=2)
            s.close()
            print(f"{host}:{port} reachable")
            break
        except Exception as e:
            tries += 1
            if tries % 6 == 0:
                print(f"still waiting for {host}:{port} ({e})", file=sys.stderr)
            time.sleep(2)
PY

# Exec the application
exec python /app/server.py
