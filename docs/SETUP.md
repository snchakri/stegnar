# Platform Setup and Deployment Guide

This guide provides detailed instructions for deploying the Stegnar Central Server Stack and enrolling monitored Remote Endpoint nodes natively on your network.

---

## 1. Central Server Stack Deployment (SOC Hub)

The central server stack contains the core database layers, routing systems, ML inference nodes, and the analyst dashboard. It is fully containerized and easily deployed using Docker Compose.

### 1.1. Prerequisites (Server Node)
*   **OS:** Linux distribution (e.g., Ubuntu 20.04/22.04 LTS) with kernel 5.4+ (required for `stegnar-proxy` transparent iptables/eBPF routing).
*   **Docker Engine:** Version 24.0.0 or newer.
*   **Docker Compose:** Version 2.0 or newer.
*   **GPU Integration (Optional but highly recommended):** For GPU-accelerated steganalysis, the host machine must have an NVIDIA GPU, CUDA 11.0+ drivers, and the [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed. (Fallback to CPU will occur automatically if a GPU is absent).

### 1.2. Deploy the Central Server
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-org/stegnar-prototype.git
    cd stegnar-prototype
    ```
2.  **Start all Central Server Containers:**
    ```bash
    docker-compose up -d --build
    ```
3.  **Verify Services Health:**
    Run `docker-compose ps` to verify that all 9 central containers started and are reported as `healthy`:
    *   `stegnar-redis` (Infrastructure)
    *   `stegnar-postgres` (Database)
    *   `stegnar-minio` & `stegnar-minio-init` (Object Storage)
    *   `stegnar-mitm` (ML Inference Engine)
    *   `stegnar-routing` (gRPC Gateway)
    *   `stegnar-data-layer` (Persistence Stream Consumer)
    *   `stegnar-proxy` (Transparent Interceptor)
    *   `stegnar-install-server` (Dynamic Script and Bundle Server)
    *   `stegnar-soc-api` & `stegnar-soc-frontend` (SOC UI and Backend)

4.  **Access the Dashboard:**
    Open a web browser and navigate to the SOC Frontend at **`http://localhost:3000`**.

---

## 2. Remote Endpoint Agent Deployment (Zero-Touch Native Install)

Monitored client workstations or servers do **not** require Docker. The agent runs as a native background system service, auto-configuring itself to map directly to the central server.

### 2.1. Linux Endpoint Installation (Ubuntu/Debian)
Execute the single-line installer from the target client workstation. This connects to the central server's install server (`8081`), dynamically compiles the server's mapping, and installs the service:
```bash
curl -sSL http://<central-server-ip>:8081/install.sh | sudo bash
```
**What this script does natively:**
1. Installs core packages (`python3-pip`, `python3-venv`, `libpcap-dev`, `tcpdump`, `libcap2-bin`).
2. Downloads and registers the MITM CA certificate into `/usr/local/share/ca-certificates/` for traffic trust validation.
3. Unpacks the lightweight agent source bundle `/opt/stegnar-agent/`.
4. Creates a local isolated Python virtual environment (`venv`) and installs requirements (`scapy`, `grpcio`, `protobuf`).
5. **Security Hardening**: Assigns RAW network capture capabilities directly to the Python interpreter:
   `setcap cap_net_raw,cap_net_admin+eip /opt/stegnar-agent/venv/bin/python3`
6. Registers and starts the agent as a native background `systemd` daemon (`stegnar-agent.service`).

---

### 2.2. Windows Endpoint Installation
Open an **Elevated PowerShell console (Run as Administrator)** on the target Windows node and execute:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('http://<central-server-ip>:8081/install.ps1'))"
```
**What this script does natively:**
1. Installs the central CA certificate into the Trusted Root store (`Cert:\LocalMachine\Root`).
2. Downloads `agent.zip` and extracts it to `C:\Program Files\Stegnar\Agent`.
3. Creates a local Python virtual environment (`venv`) and installs dependencies.
4. Generates a dynamic launcher wrapper (`run-agent.ps1`) pre-configured with the resolved server IP.
5. **Zero SCM Timeout Bypass**: Registers a native Windows Scheduled Task triggered at boot (`AtStartup`) running under `SYSTEM` authority, completely avoiding Windows Service Control Control SCM timeouts.

---

## 3. Operations & Configuration

*   **View Agent Logs (Linux):**
    `sudo journalctl -u stegnar-agent -f`
*   **View Agent Tasks (Windows):**
    `Get-ScheduledTask -TaskName "StegnarAgent"`
*   **Verify Heartbeats:**
    Open the dashboard at `http://localhost:3000` and view the "Agents" registry. Newly enrolled client systems will populate immediately on startup!
