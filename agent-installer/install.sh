#!/bin/bash
set -e

# ==============================================================================
# Stegnar Forensic Agent — Native Linux Installation Script
# ==============================================================================
# This script executes a low-footprint, native background service install.
# Usage: curl -sSL http://<server-ip>:8081/install.sh | sudo bash
# ==============================================================================

SERVER_IP="__SERVER_IP_PLACEHOLDER__"

if [ "$EUID" -ne 0 ]; then
    echo "[STEGNAR] Error: Please run this installation script as root (sudo)."
    exit 1
fi

echo "[STEGNAR] Initiating native Stegnar Agent installation..."

# 1. Install System Dependencies
echo "[STEGNAR] Installing system package dependencies..."
if [ -x "$(command -v apt-get)" ]; then
    apt-get update -y
    apt-get install -y python3-pip python3-venv libpcap-dev tcpdump curl tar libcap2-bin
else
    echo "[STEGNAR] Warning: Standard apt-get not found. Please ensure python3, venv, libpcap-dev, tcpdump, and tar are installed."
fi

# 2. Download and Register MITM CA Certificate
echo "[STEGNAR] Fetching Server CA Certificate from central hub..."
mkdir -p /usr/local/share/ca-certificates
curl -sSL "http://${SERVER_IP}:8081/mitmproxy-ca-cert.pem" -o /usr/local/share/ca-certificates/stegnar-ca.crt
update-ca-certificates

# 3. Download and Unpack Agent Source Bundle
echo "[STEGNAR] Extracting lightweight agent source..."
mkdir -p /opt/stegnar-agent
curl -sSL "http://${SERVER_IP}:8081/agent.tar.gz" -o /tmp/agent.tar.gz
tar -xzf /tmp/agent.tar.gz -C /opt/stegnar-agent
rm -f /tmp/agent.tar.gz

# 4. Create Virtual Environment and Install Dependencies
echo "[STEGNAR] Building local Python isolated environment..."
python3 -m venv /opt/stegnar-agent/venv
/opt/stegnar-agent/venv/bin/pip install --upgrade pip
/opt/stegnar-agent/venv/bin/pip install -r /opt/stegnar-agent/endpoint-agent/requirements.txt

# 5. Grant Low-Level Socket Capabilities (Security Hardening)
echo "[STEGNAR] Granting RAW socket capability to the agent python binary..."
setcap cap_net_raw,cap_net_admin+eip /opt/stegnar-agent/venv/bin/python3

# 6. Create Native Systemd Service
echo "[STEGNAR] Registering native background systemd service..."
cat <<EOF > /etc/systemd/system/stegnar-agent.service
[Unit]
Description=Stegnar Forensic Agent Sensor
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/stegnar-agent/endpoint-agent
Environment=PYTHONPATH=/opt/stegnar-agent
Environment=ROUTER_GRPC_ADDR=${SERVER_IP}:50051
Environment=CAPTURE_IFACE=eth0
Environment=SSLKEYLOGFILE=/tmp/ssl_keys.log
Environment=ENDPOINT_ID=%H
ExecStart=/opt/stegnar-agent/venv/bin/python3 main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 7. Reload and Start Service
echo "[STEGNAR] Starting Stegnar Forensic daemon..."
systemctl daemon-reload
systemctl enable stegnar-agent
systemctl restart stegnar-agent

echo "[STEGNAR] Native installation completed successfully! Stegnar agent is running actively as a systemd service."
