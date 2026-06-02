# Stegnar 🛡️

**Real-time network steganography detection at the SOC level.**

Stegnar passively monitors network traffic, carves image payloads from HTTPS streams, and runs them through a pruned deep-learning model (CALPA-NET / SRNet) to detect hidden steganographic content — all surfaced in a live SOC dashboard.

---

## Demo

```
Upload a JPEG to Google Drive → Stegnar intercepts → CALPA-NET scores it → SOC Dashboard alerts
                                                            ↑
                                              88.9% confidence: STEGO
```

> **Fastest way to see it in action** — no Google Drive needed:
> ```powershell
> docker-compose up -d
> # wait ~30s, then:
> & "testing\local-node-test\.venv\Scripts\python.exe" testing\local-node-test\send_image_chunk.py
> # open http://localhost:3000
> ```

---

## How It Works

```
[Endpoint Agent]  →  [Routing Server]  →  [CALPA-NET]  →  [SOC Dashboard]
  Scapy/Npcap         stream assembly       SRNet            React + Postgres
  gRPC stream         JPEG carving          steg score       real-time alerts
  SSL key log         MinIO storage         88-99% acc.      topology view
```

1. **Endpoint Agent** captures raw TCP packets on port 80/443 using Scapy + Npcap
2. **Routing Server** reassembles TCP streams and carves JPEG/PNG payloads
3. **CALPA-NET** (pruned SRNet) classifies each image: `STEGO` or `CLEAN`
4. **SOC Dashboard** displays verdicts, confidence scores, and endpoint topology in real time

---

## Quick Start

### Requirements

- Docker Desktop (with Compose v2)
- Python 3.10+
- [Npcap](https://npcap.com) (Windows) or `libpcap` (Linux)
- 8 GB RAM minimum

### 1 — Start the Stack

```powershell
git clone https://github.com/YOUR_USERNAME/stegnar
cd stegnar/stegnar_prototype
docker-compose up -d
```

Open the dashboard: **http://localhost:3000**

### 2 — Set Up SSL Key Logging (Windows, one-time)

```powershell
[Environment]::SetEnvironmentVariable("SSLKEYLOGFILE", "$env:TEMP\ssl_keys.log", "User")
taskkill /F /IM chrome.exe 2>$null   # restart Chrome to pick up the env var
```

### 3 — Start the Endpoint Agent

Open **Administrator PowerShell**:

```powershell
powershell -ExecutionPolicy Bypass -File "testing\local-node-test\run_local_agent.ps1"
```

The `WINDOWS-HOST` node will appear in the SOC topology within ~30 seconds.

### 4 — Run the Demo

**Option A — Instant inject (no browser needed):**
```powershell
& "testing\local-node-test\.venv\Scripts\python.exe" testing\local-node-test\send_image_chunk.py
```

**Option B — Live traffic:**
Upload any JPEG from `test_images/demo_data/stego/` to [Google Drive](https://drive.google.com) with Chrome running.

### 5 — Stop

```powershell
docker-compose down
```

---

## Repository Structure

```
stegnar_prototype/
├── docker-compose.yml          # Full stack definition
├── DEMO_GUIDE.md               # Step-by-step demo instructions
│
├── routing/                    # Routing server (stream assembly + PCAP carving)
├── mitm/                       # CALPA-NET inference gateway (SRNet model)
├── soc-api/                    # REST API for the dashboard
├── soc-frontend/               # React SOC dashboard
├── endpoint-agent/             # Production endpoint agent (Linux/Docker)
├── data-layer/                 # PostgreSQL writer service
│
├── testing/
│   └── local-node-test/        # Windows host endpoint agent (for live testing)
│       ├── run_local_agent.ps1     # One-click launcher
│       ├── main.py                 # Async agent orchestrator
│       ├── sniffer.py              # Scapy packet capture
│       ├── grpc_client.py          # gRPC stream to routing server
│       ├── send_image_chunk.py     # Inject test image into pipeline
│       └── inject_image.py         # Direct CALPA-NET query (bypass routing)
│
└── test_images/
    └── demo_data/
        ├── stego/              # Known steganographic images (JPEG/PNG)
        └── clean/              # Known clean images
```

---

## Services & Ports

| Service | Port | Description |
|---|---|---|
| SOC Dashboard | **3000** | Real-time React UI |
| SOC API | **3001** | REST endpoints |
| Routing gRPC | **50051** | Endpoint agent target |
| MITM/CALPA-NET gRPC | **50052** | Inference gateway |
| Network Proxy | **8080** | Docker-node proxy agents |
| MinIO | **9000/9001** | PCAP + artifact storage |
| PostgreSQL | 5432 | Events database |
| Redis | 6379 | Hash verdict cache |

---

## Detection Model — CALPA-NET

CALPA-NET is a pruned, quantized version of **SRNet** (Spatial Rich-model Network), optimized for CPU inference:

- **Architecture:** SRNet with structured pruning (50% parameter reduction)
- **Training data:** BOSSBase + WOW/S-UNIWARD steganographic payloads
- **Accuracy:** ~88–99% depending on payload rate and image content
- **Latency:** ~4–5 seconds per image on CPU; <500ms on GPU
- **Output:** `STEGO` or `CLEAN` + confidence score ∈ [0, 1]

Results are cached in Redis by SHA-256 hash — identical images are never re-analyzed.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Agent fails to capture packets | Run PowerShell as Administrator; install Npcap |
| `NO_IMAGE` on all streams | Expected for encrypted traffic — use `send_image_chunk.py` |
| Dashboard shows no WINDOWS-HOST node | Check agent is running and `localhost:50051` is reachable |
| `gRPC UNAVAILABLE` | Run `docker-compose up -d` first |
| CALPA-NET `cannot identify image file` | The carved bytes are encrypted ciphertext, not a real image |

See [DEMO_GUIDE.md](./DEMO_GUIDE.md) for the full troubleshooting reference.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Packet capture | Python · Scapy · Npcap |
| Communication | gRPC · Protocol Buffers |
| Inference | TensorFlow · SRNet |
| Storage | TimescaleDB · Redis · MinIO |
| Orchestration | Docker Compose |
| Dashboard | React · Node.js |

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Research project — for educational and authorized network security testing only.*
