#!/bin/bash
set -e

# Usage: curl -sSL http://<server-ip>:8080/install.sh | sudo bash -s -- --server <server-ip>

SERVER_IP=""
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --server) SERVER_IP="$2"; shift ;;
        *) echo "Unknown parameter passed: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$SERVER_IP" ]; then
    echo "Usage: install.sh --server <server-ip>"
    exit 1
fi

echo "[STEGNAR] Installing Stegnar Agent..."

# 1. Download CA Cert
echo "[STEGNAR] Fetching Server CA Certificate..."
mkdir -p /usr/local/share/ca-certificates
curl -sSL "http://${SERVER_IP}:8081/mitmproxy-ca-cert.pem" -o /usr/local/share/ca-certificates/stegnar-ca.crt
update-ca-certificates

# 2. Pull Agent (For demo, we assume docker is available)
echo "[STEGNAR] Ensuring Agent Docker Image..."
# Normally we would pull from a registry, but for local demo we assume it's built or available.

# 3. Create Systemd Service
echo "[STEGNAR] Creating Systemd Service..."
cat <<EOF > /etc/systemd/system/stegnar-agent.service
[Unit]
Description=Stegnar Forensic Agent
After=network.target docker.service
Requires=docker.service

[Service]
Restart=always
ExecStartPre=-/usr/bin/docker rm -f stegnar-agent
ExecStart=/usr/bin/docker run --name stegnar-agent --network host --privileged \\
    -e ENDPOINT_ID="%H" \\
    -e ROUTER_GRPC_ADDR="${SERVER_IP}:50051" \\
    -e CAPTURE_IFACE="eth0" \\
    stegnar_prototype-node-1
ExecStop=/usr/bin/docker stop -t 2 stegnar-agent

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable stegnar-agent
systemctl restart stegnar-agent

echo "[STEGNAR] Installation Complete! Agent is running as a systemd service."
