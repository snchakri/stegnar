# Stegnar Architecture

This document describes the high-performance, asynchronous out-of-band forensics architecture of the Stegnar platform.

---

## 1. Core Principles

The architecture of the Stegnar platform is founded on a set of core principles derived from the unique challenges of performing computationally expensive steganalysis on high-volume network traffic:

*   **Asynchronous Processing:** No component performs blocking operations on the live network path. All analysis is conducted out-of-band, ensuring that the platform's operations do not impact user network performance.
*   **Decoupling:** Services are loosely coupled via Redis Streams and well-defined gRPC APIs. For example, packet sniffing and SSL key-logging on the endpoint are entirely separated from the heavy-lifting decryption and ML steganalysis.
*   **Stateless Inference Workers:** The central model execution daemon (`calpa_worker.py` running inside the `stegnar-mitm` container) is completely stateless. It accepts raw binary payloads and config metrics, executes the convolutional steganalysis (SRNet), and writes the verdict back.
*   **Data Immutability:** The data persistence layer treats information as immutable. Once a media artifact is ingested and analyzed, its record—including its SHA-256 hash, verdict, raw scores, and packet dumps—is committed as a historical ledger.
*   **Horizontal Scalability:** The centralized server stack runs inside Docker, permitting dynamic horizontal scaling of databases and workers as network traffic demands.

---

## 2. High-Level Diagram

```mermaid
graph TD
    subgraph Monitored Endpoint Node
        A[Passive Packet Sniffer]
        B[TLS SSLKEYLOGFILE Watcher]
    end

    subgraph Central Server Stack
        C[Routing System gRPC - 50051]
        D[Redis Streams / Queue]
        E[MITM Gateway & CALPA Worker - 50052]
        F[Data Layer Persistence]
        G[PostgreSQL TimescaleDB]
        H[MinIO Object Storage]
        I[SOC API - 3001]
        J[React SOC Dashboard - 3000]
    end

    A -->|gRPC Raw Packets| C
    B -->|gRPC Symmetric Keys| C
    C -->|Store Metadata| F
    C -->|Push Jobs| D
    D -->|Consume Tasks| E
    E -->|Execute SRNet Steganalysis| E
    E -->|Write Verdicts| D
    F -->|Persist SQL Events| G
    F -->|Upload PCAPs & Images| H
    I -->|Query Telemetry| G
    I -->|Fetch Original Images| H
    J <=>|HTTP / WebSockets| I

    style J fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#ccf,stroke:#333,stroke-width:2px
    style H fill:#ccf,stroke:#333,stroke-width:2px
```

---

## 3. Component Deep Dive

### 3.1. Interception Layer

*   **`endpoint-agent`**:
    *   **Technology:** Python, Scapy packet sniffer, dynamic key watcher.
    *   **Function:** Deployed natively as a background system service (`systemd` on Linux, Scheduled Task on Windows) on monitored remote computer nodes. It passively captures raw packets on the local network interface and monitors browser `SSLKEYLOGFILE` logs, streaming them in real-time to the central routing system.
*   **`stegnar-proxy`**:
    *   **Technology:** Python, `mitmproxy` transparent proxy.
    *   **Function:** Deployed as an active inline interceptor. It transparently redirects TCP streams on ports 80/443, decrypts HTTPS on-the-fly, carves out plain-text image binaries, and dispatches them to the routing system.

### 3.2. Ingestion & Routing Layer

*   **`routing-system`**:
    *   **Technology:** Python, gRPC (`50051`), Redis.
    *   **Function:** The central gateway. Receives real-time packet streams and TLS keys from endpoints, reassembles TCP flows, runs fast-path cache deduplication (preventing re-analysis of identical image hashes), and dispatches analysis tasks to the Redis Stream queue (`stegnar:mitm_queue`).

### 3.3. Analysis & Inference Layer

*   **`mitm-gateway` (`stegnar-mitm`)**:
    *   **Technology:** Python 3.11, legacy Python 3.7 subprocess, TensorFlow, CUDA.
    *   **Function:** The heavy-lifting analysis cluster. Exposes a gRPC analysis interface on port `50052`. It consumes analysis requests, runs `calpa_worker.py` under the TensorFlow 1.15 CUDA environment, processes pruned SRNet model inference (decoding hidden data inside J-UNIWARD/S-UNIWARD/UERD stego channels), and returns structural probability verdicts.

### 3.4. Data Persistence Layer

*   **`data-layer`**:
    *   **Technology:** Python, TimescaleDB, MinIO SDK.
    *   **Function:** Background consumer of the database queue (`stegnar:db_queue`). It manages raw forensic logging, writing metadata and verdicts to TimescaleDB and uploading PCAP logs and captured images to the MinIO object store.

### 3.5. Security Operations Dashboard

*   **`soc-api` & `soc-frontend`**:
    *   **Technology:** Python Flask WebSockets, React TypeScript, Vite, Nginx.
    *   **Function:** The visual threat interface. Displays active agent heartbeats, streams real-time analysis results via WebSockets, and allows security teams to query historical alerts, download raw PCAP files, and dynamically configure pipeline parameters (Alert Threshold, Data Retention).

---

## 4. Communication Protocols

*   **gRPC (HTTP/2):** High-throughput internal routing for packet streams, TLS session key logs, and analysis worker dispatches.
*   **Redis Streams:** Robust, persistent job queuing and data persistence pipelining.
*   **WebSockets:** Real-time event push from the SOC API to the React dashboard interface.
*   **REST/HTTPS:** User actions, configuration updates, and historical telemetry lookups.
