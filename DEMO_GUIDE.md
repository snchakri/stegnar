# 🛡️ Stegnar — Live Demo Guide
> **Network-level steganography detection using passive traffic interception + deep learning.**

---

## What is Stegnar?

Stegnar is a proof-of-concept SOC (Security Operations Center) platform that **passively monitors network traffic**, detects images being transferred over HTTPS, and runs them through **CALPA-NET** — a pruned SRNet deep-learning model — to identify hidden steganographic payloads in real time.

### System at a Glance

```
  [Browser / App]
       │  HTTPS image upload (e.g. Google Drive)
       ▼
  [Endpoint Agent]  ← runs on the monitored host (Windows/Linux)
       │  streams raw packets + SSL keys via gRPC
       ▼
  [Routing Server]  ← assembles TCP streams, carves JPEG/PNG payloads
       │  dispatches carved image via gRPC
       ▼
  [MITM / CALPA-NET]  ← SRNet inference on GPU/CPU
       │  verdict: STEGO | CLEAN + confidence score
       ▼
  [PostgreSQL + Redis]  ← stores events, caches hashes
       │
       ▼
  [SOC Dashboard]  ← real-time alerts at http://localhost:3000
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| **Docker Desktop** | 4.x+ | Must be running |
| **Docker Compose** | v2+ | Included with Docker Desktop |
| **Python** | 3.10+ | For the Windows endpoint agent |
| **Npcap** | Latest | Windows packet capture ([npcap.com](https://npcap.com)) |
| **RAM** | ≥ 8 GB | Model inference needs headroom |
| **OS** | Windows 10/11 or Linux | Agent tested on both |

---

## Part 1 — Start the Core Stack

Open a terminal in the project root (`stegnar_prototype/`):

```powershell
docker-compose up -d
```

Wait ~30 seconds for all services to become healthy:

```powershell
docker ps
```

You should see **10 containers** all `healthy` or `running`:

| Container | Role | Port |
|---|---|---|
| `stegnar-soc-frontend` | SOC Dashboard (React) | **3000** |
| `stegnar-soc-api` | REST API | **3001** |
| `stegnar-routing` | Packet routing + stream assembly | **50051** |
| `stegnar-mitm` | CALPA-NET inference gateway | **50052** |
| `stegnar-proxy` | Network proxy nodes | **8080** |
| `stegnar-postgres` | Events database | 5432 |
| `stegnar-redis` | Hash verdict cache | 6379 |
| `stegnar-minio` | PCAP + artifact object store | **9000** |

**Open the dashboard:** http://localhost:3000

---

## Part 2 — Run the Windows Endpoint Agent

> The endpoint agent passively captures all port 80/443 traffic on your machine and streams it to the routing server for analysis.

### Step 1 — Enable SSL Key Logging (one-time setup)

This tells Chrome and other apps to log TLS session keys so encrypted traffic can be inspected:

```powershell
# Run once — persists across reboots
[Environment]::SetEnvironmentVariable(
    "SSLKEYLOGFILE",
    "$env:TEMP\ssl_keys.log",
    "User"
)
```

### Step 2 — Kill existing Chrome (so it picks up the env var)

```powershell
taskkill /F /IM chrome.exe 2>$null
```

### Step 3 — Start the Agent

Open an **Administrator PowerShell** (required for Npcap packet capture):

```powershell
cd path\to\stegnar_prototype

powershell -ExecutionPolicy Bypass -File "testing\local-node-test\run_local_agent.ps1"
```

Expected output:
```
[STEGNAR] Starting Stegnar Endpoint Agent (ENDPOINT_ID: WINDOWS-HOST, IFACE: Wi-Fi)...
[STEGNAR] To intercept HTTPS, write SSL key logs to: C:\Users\...\AppData\Local\Temp\ssl_keys.log
Starting packet capture on interface 'Wi-Fi' (filter: tcp port 80 or tcp port 443)
[gRPC] Cycle 1 — connecting to localhost:50051 ...
[gRPC] Cycle 1 ACK — ok=True chunks_recv=... msg=processed ... chunks
```

> **The WINDOWS-HOST node will appear in the SOC topology view within ~30 seconds.**

Press `Ctrl+C` to stop the agent cleanly.

---

## Part 3 — Inject a Test Image (Instant Demo)

Without needing to upload anything to Google Drive, you can inject a known steganographic image directly into the pipeline:

```powershell
# From the stegnar_prototype directory:
& "testing\local-node-test\.venv\Scripts\python.exe" `
  "testing\local-node-test\send_image_chunk.py"
```

Or specify any JPEG:
```powershell
& "testing\local-node-test\.venv\Scripts\python.exe" `
  "testing\local-node-test\send_image_chunk.py" `
  "test_images\demo_data\stego\11.jpg"
```

Expected output:
```
[INFO]  Image     : 11.jpg  (35.9 KB)
[INFO]  Stream ID : 192.168.29.30:55443-142.250.77.1:443
[INFO]  Endpoint  : WINDOWS-HOST
[INFO] Streaming 1 chunk (36803 bytes) to RouterService ...
[INFO] ACK received in 265 ms: ok=True chunks_recv=1
[INFO] Stream closed — routing server is now processing...
[INFO] Check http://localhost:3000 in ~10 seconds for the STEGO event.
```

**~10 seconds later**, the dashboard will show a `STEGO` alert with **88.9% confidence** for `WINDOWS-HOST`.

---

## Part 4 — Real Live Traffic (Google Drive Upload)

This is the full end-to-end demo — upload an image from Chrome and watch Stegnar detect it in real time.

### Steps

1. **Start the stack** (Part 1)
2. **Start the agent** (Part 2, Administrator PowerShell)
3. **Open Chrome** (fresh launch after setting `SSLKEYLOGFILE`)
4. **Upload a stego image** to [Google Drive](https://drive.google.com) — use any JPEG from `test_images/demo_data/stego/`
5. **Watch the dashboard** at http://localhost:3000

> **Note:** Modern browsers use HTTP/2 + TLS 1.3 with early-data extensions. The routing server may still see the encrypted stream as `NO_IMAGE` for real Drive uploads (QUIC/HTTP/2 chunked transfer makes image carving hard). Use the **inject method** (Part 3) for a guaranteed demo.

---

## Part 5 — Verify Results in the Database

```powershell
docker exec stegnar-postgres psql -U stegnar -d stegnar -c "
  SELECT endpoint_id, stream_id, verdict, ROUND(steg_score::numeric, 4) as score, model_type, ts
  FROM network_events
  ORDER BY ts DESC
  LIMIT 10;
"
```

Sample output:
```
 endpoint_id  |             stream_id              | verdict   | score  | model_type |          ts
--------------+------------------------------------+-----------+--------+------------+----------------------------
 WINDOWS-HOST | 192.168.29.30:55443-142.250.77.1:443 | CACHE_HIT | 0.8889 | srnet   | 2026-06-02 22:31:03+00
 WINDOWS-HOST | 192.168.29.30:63764-216.239.32.223:443 | NO_IMAGE | 0.0000 | srnet  | 2026-06-02 22:29:55+00
```

---

## Part 6 — Stop Everything

```powershell
# Stop the Docker stack
docker-compose down

# Stop the agent: Ctrl+C in its PowerShell window
```

To also remove stored data (PCAPs, DB, cache):
```powershell
docker-compose down -v
```

---

## Architecture Deep Dive

### Endpoint Agent (`testing/local-node-test/`)

| File | Role |
|---|---|
| `run_local_agent.ps1` | One-click launcher (sets env vars, activates venv) |
| `main.py` | Async orchestrator: sniffer + gRPC client |
| `sniffer.py` | Scapy `AsyncSniffer` on Wi-Fi, BPF filter `tcp port 80 or 443` |
| `grpc_client.py` | Cyclic gRPC stream to `RouterService` (20s cycles) |
| `key_extractor.py` | Tails `ssl_keys.log` and queues new TLS session keys |

### Detection Pipeline

| Stage | Component | What it does |
|---|---|---|
| **Capture** | Scapy / Npcap | Raw IP packets from NIC |
| **Stream** | gRPC `StreamPayload` | Chunks + SSL keys → routing:50051 |
| **Reassemble** | Routing server | Groups chunks by `stream_id` |
| **Carve** | `pcap_builder.py` | Regex scan for `\xff\xd8\xff` (JPEG) / PNG header |
| **Analyze** | CALPA-NET (SRNet) | Spatial-domain steganalysis, output ∈ [0,1] |
| **Cache** | Redis | SHA-256 → verdict (avoids re-analysis of same file) |
| **Store** | PostgreSQL | `network_events` table with verdict, score, image_uri |
| **Display** | SOC Dashboard | Real-time React UI with alerts, topology, event log |

### Why `send_image_chunk.py` Works

The routing server has a two-stage image extraction strategy:
1. **tshark TLS decryption** — works only when the captured PCAP has a real TLS handshake
2. **Regex JPEG carve** — scans `raw_bytes` for `\xff\xd8\xff...\xff\xd9`

`send_image_chunk.py` sends raw JPEG bytes as the `raw_bytes` field of a `PayloadChunk`. Stage 2 finds the magic bytes, carves the image, and the full pipeline runs normally.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Agent says "Not running as Administrator" | Right-click PowerShell → Run as Administrator |
| Scapy can't open interface | Install Npcap from [npcap.com](https://npcap.com) |
| `NO_IMAGE` on all streams | Normal for encrypted traffic. Use `send_image_chunk.py` for demo |
| Dashboard shows no nodes | Wait 30s; check agent is running and connected to `localhost:50051` |
| `gRPC UNAVAILABLE` | Docker stack not running — `docker-compose up -d` first |
| CALPA-NET `cannot identify image file` | The carved bytes weren't a valid JPEG (encrypted payload) |

---

## Quick Reference

```powershell
# ── Start ──────────────────────────────────────────────────────
docker-compose up -d                          # Start all services
Start-Sleep 30; Start-Process "http://localhost:3000"  # Open dashboard

# ── Agent (run as Administrator) ───────────────────────────────
powershell -ExecutionPolicy Bypass -File testing\local-node-test\run_local_agent.ps1

# ── Demo injection ─────────────────────────────────────────────
& "testing\local-node-test\.venv\Scripts\python.exe" testing\local-node-test\send_image_chunk.py

# ── Check results ──────────────────────────────────────────────
docker exec stegnar-postgres psql -U stegnar -d stegnar -c \
  "SELECT endpoint_id, verdict, ROUND(steg_score::numeric,4), ts FROM network_events ORDER BY ts DESC LIMIT 5;"

# ── Stop ───────────────────────────────────────────────────────
docker-compose down          # Stop (keep data)
docker-compose down -v       # Stop + wipe data
```

---

*Built with: Python · Scapy · gRPC · TensorFlow · Docker · TimescaleDB · Redis · MinIO · React*
