we'll start designing steganographic hunter for apts, and the name of this project/product is STEGNAR

these are the foundations of the target version (the one which we have to submit in our institution) lets call it version tbp, or vTBP;

Here is the comprehensive executive summary and architectural context document for Project Stegnar (vTBP). You can feed this directly to any agentic AI or coding assistant to instantly align its context window with the system's strict design principles, constraints, and operational topology.

***

# Project Stegnar (vTBP): Executive Architecture & Context Document
**System:** Deep Packet Steganography Hunter for Advanced Persistent Threats (APTs)
**Target Iteration:** Version To Be Presented (vTBP) - Academic Demonstration Build

## 1. Executive Intent & System Goals
Project Stegnar is designed to detect and trace steganographic payloads hidden within network traffic by sophisticated APTs. The vTBP iteration is a localized, containerized proof-of-concept. It demonstrates a complete, end-to-end defensive pipeline capable of intercepting encrypted communications, decrypting them out-of-band, carving binary payloads, conducting deep-learning steganalysis, and preserving strict forensic audit trails—all without alerting the communicating nodes.

**Primary Goals:**
* **Zero-Loss Pipeline:** Guarantee that no network packets or telemetry are dropped between the edge and the core, utilizing multiplexed, flow-controlled channels.
* **True Network Transparency:** Intercept and route traffic at the lowest possible level (kernel/driver) to remain invisible to evasive malware.
* **Forensic Immutability:** Maintain an unbroken, chronologically accurate ledger of all network events and a secure vault for raw packet captures and carved binaries.
* **Real-Time Threat Visibility:** Stream operational metrics and detection events to a centralized Security Operations Center (SOC) dashboard.

## 2. Core Architectural Principles & Constraints
To guide the coding and implementation phase, all components must adhere to the following strict principles

* **Asynchronous & Non-Blocking Design:** The system relies heavily on Python's `asyncio`. The network layer must never block waiting for the machine learning layer.
* **Compute Asymmetry:** The Endpoint Agents must remain incredibly lightweight (capturing keys and raw bytes only). All heavy decryption, MIME-filtering, and inference are offloaded to the MITM Gateway.
* **Stateful Deduplication:** The system must aggressively cache SHA-256 hashes of payloads. If a file has been analyzed within the active memory window, the routing system must issue a `skip_check` command to halt transmission and save compute cycles.

## 3. System Components & Engineering Stack

### I. Endpoint Agent (The Edge Sensor)
* **Role:** User-space daemon running on victim nodes to silently capture outbound traffic and cryptographic keys.
* **Tech Stack:** Python 3.11+, `grpcio`, `hashlib`, Scapy/pcapy-ng.
* **Key Logic:** Hooks into `SSLKEYLOGFILE`, packages raw bytes, session keys, and SHA-256 hashes into Protocol Buffers, and streams them via gRPC to the Routing System. Respects flow control and `skip_check` backpressure.

### II. MITM Gateway (The Core Engine)
* **Role:** Privileged node handling transparent interception, out-of-band TLS decryption, and machine learning inference.
* **Tech Stack:** C (eBPF/XDP), Python (BCC, mitmproxy API), PyTorch, `redis-py`.
* **Key Logic:** Uses eBPF to route packets and spoof IP headers. Ingests gRPC keys to decrypt TLS streams dynamically. Carves image binaries, runs them through the CALPA-NET ResNet model, and pushes the resulting steganography probability scores to the Redis cache and stream.

### III. Routing System (The Orchestrator)
* **Role:** The asynchronous middleware managing traffic flow, load balancing, rate limiting, and forensic packaging.
* **Tech Stack:** Python 3.11+ (`asyncio`), `grpcio`, PyShark/Tshark, `redis-py`.
* **Key Logic:** Multiplexes incoming gRPC streams. Queries Redis for hash deduplication. Enforces token-bucket rate limits per endpoint. Runs a background PyShark job to reassemble decrypted streams into compliant `.pcap` files for cold storage.

### IV. Data Model (The State & Storage Layer)
* **Role:** Decoupled storage architecture balancing sub-millisecond cache lookups with immutable, time-series relational auditing.
* **Tech Stack:** Redis, PostgreSQL + TimescaleDB, MinIO, SQLAlchemy + `asyncpg`, `boto3`.
* **Data Structures:**
    * *MinIO:* Flat object storage for carved images and `.pcap` files.
    * *Redis:* Key-Value cache for hash deduplication and rate limiting; Redis Streams for non-blocking database ingestion.
    * *Postgres (TimescaleDB):* Hypertables partitioned by `timestamp` and `endpoint_id` to maintain isolated memory windows for endpoint activity, alongside a strictly append-only `system_audit_log` for complete traceability.

## 4. Deployment Topology
* **Environment:** Docker / Docker Swarm orchestrating a logical subnet structure via user-defined Linux bridge networks.
* **Execution Strategy:** Single `docker-compose.yml` defining the Victim Subnet (lightweight Python endpoints), the MITM Gateway (privileged Ubuntu/Fedora container), the Backend Data Subnet, and the SOC Web Server.
* **Network Isolation:** Endpoint traffic must be forcibly routed through the MITM Gateway container's `veth` interface to simulate a physical inline tap before reaching external destinations.

the system has 4 major components:
1. endpoint agent
2. transparent mitm proxy with calpa net steganalysis ai model
3. database
4. routing system with redis streaming queue & cache


### **1. Endpoint Agent**

The Endpoint Agent serves as the lightweight, frontline sensor of the vTBP architecture. Operating entirely in user space within the simulated victim environments, its sole purpose is to silently observe outbound network traffic, extract cryptographic session keys, and guarantee the lossless delivery of this raw data to the MITM Gateway for heavy-lifting analysis.

#### **Core Features & Responsibilities**

- **Raw Traffic Interception (The Tap):** Constantly monitors the designated virtual ethernet interface (`veth`) for outbound TCP/UDP traffic. It captures raw packets without attempting to reassemble or inspect the application-layer payload, ensuring CPU overhead remains imperceptible to advanced persistent threats (APTs).
    
- **Dynamic TLS Key Extraction:**
    
    Hooks into the operating system's environment to automatically capture the symmetric session keys generated by the browser or application (via the `SSLKEYLOGFILE` variable). It associates these keys with their corresponding TCP streams.
    
- **Guaranteed gRPC Streaming:**
    
    Establishes a persistent, multiplexed HTTP/2 stream with the routing system. It encapsulates the raw packet chunks, the generated SHA-256 hashes of the payloads, and the extracted SSL keys into Protocol Buffer messages and streams them sequentially to the backend.
    
- **Native Flow Control & Backpressure Management:**
    
    Utilizes gRPC's native flow control. If the routing system or the Redis queue begins to choke, the agent buffers the packets locally without dropping a single byte, slowing transmission until the backend signals it is ready for more.
    
- **Fail-Safe "Skip" Signaling:**
    
    If the agent identifies a redundant connection or a stream that has already been verified by the backend cache (via a returned hash lookup), it executes the "skip_check" command to instantly halt the transmission of that specific payload, conserving bandwidth.
    

#### **Technology Stack**

Given the requirement for a native, fast, and unified implementation that runs smoothly across the simulated Docker nodes on your Core Ultra 5 machine, the engineering stack is entirely Python-based:

- **Core Runtime:** **Python 3.11+**
    
    Utilizing Python's native `asyncio` library to handle the non-blocking packet capture and gRPC streaming concurrently.
    
- **Network Capture:** **Scapy** or **pcapy-ng**
    
    Since the heavy Tshark/PyShark decryption and MIME-filtering operations have been offloaded to the MITM proxy, the endpoint agent uses a much lighter wrapper around `libpcap` to simply sniff and forward the raw bytes off the wire.
    
- **Transmission & Serialization:** **`grpcio` & `grpcio-tools`**
    
    Used to define the data structures (raw bytes, SHA-256 hashes, SSL keys) in a `.proto` file and compile them into Python classes for the HTTP/2 transmission channel.
    
- **Hashing Engine:** **`hashlib` (Standard Library)**
    
    For generating the SHA-256 signatures of the network streams prior to transmission.
    
- **Containerization (Deployment):** **Docker**
    
    Packaged as a lightweight daemon running inside a minimal Linux base image (like Alpine or a stripped-down Ubuntu/Fedora) to act as the victim nodes in your local network topology.

---

Here is the full architectural description for the Data & State Management Layer of the vTBP system.
### **2. Data & State Management Layer (Database, Cache, Queue, & Object Storage)**

This component acts as the central nervous system for your deep packet steganography hunter. It decouples the rapid, unpredictable flow of network traffic from the slower, computationally expensive machine learning inference. It guarantees that no forensic evidence is lost, ensures duplicate files aren't re-analyzed, and structures the metadata perfectly for real-time SOC visibility.

#### **Core Features & Responsibilities**

- **High-Throughput Asynchronous Ingestion (The Stream):** Acts as the primary shock absorber for the system. It receives the incoming gRPC payload streams (metadata, hashes, raw bytes) from the Endpoint Agents and buffers them. This ensures that even if the MITM Gateway experiences a spike in traffic, the endpoints are never forced to drop packets.
    
- **Sub-Millisecond Hash Verification (The Cache):**
    
    Maintains a "hot list" of previously analyzed SHA-256 image hashes and their CALPA-NET scores. When a new transfer is triggered, this layer is queried instantly. If the hash exists, it flags the routing system to execute a "skip_check" to the endpoint, bypassing the ML model entirely to save compute cycles.
    
- **Immutable Forensic Vault (Object Storage):**
    
    Responsible for the physical storage of binary data. It ingests the raw `.pcap` files for cryptographic/network auditing and the reconstructed image binaries for visual SOC inspection. It returns a deterministic URI (file path) to be logged in the database.
    
- **Time-Series Metadata Auditing (The Ledger):**
    
    Stores the complete, relational state of the system over time. This includes endpoint connection metadata (IPs, timestamps, bytes transferred), assigned Docker container IDs for the proxy workers, the MinIO URIs for the binaries, and the final steganography probability scores. It is optimized for chronological queries to feed the SOC interface's live topological view.
    
- **Data Lifecycle Management (Cold Storage Window):**
    
    Automatically manages data retention. It partitions active network activity from historical data, allowing the SOC director to query recent events instantly while pushing older logs into long-term cold storage tables to maintain database performance.
    

#### **Technology Stack**

To maintain a streamlined, Docker-native environment suitable for your deployment constraints, the stack utilizes industry-standard open-source data engines:

- **Message Broker & Cache:** **Redis (Redis Streams & Key-Value)**
    
    - _Usage:_ Redis Streams provides the continuous, append-only log required to queue the incoming gRPC payloads reliably. The standard Redis Key-Value store handles the lightning-fast SHA-256 hash lookups.
        
- **Relational Metadata Storage:** **PostgreSQL + TimescaleDB Extension**
    
    - _Usage:_ PostgreSQL is the bedrock. Adding the TimescaleDB extension converts Postgres into a hyper-fast time-series database. It automatically partitions the activity logs by time intervals (chunks), making chronological SOC dashboard queries incredibly efficient without sacrificing SQL relational integrity.
        
- **Binary Object Storage:** **MinIO**
    
    - _Usage:_ Self-hosted, S3-compatible object storage deployed as a lightweight Docker container. It strictly handles the heavy `.pcap` and image files, keeping the PostgreSQL database lean and fast.
        
- **Data Access & ORM (Python Backend):** **SQLAlchemy + `asyncpg` + `boto3`**
    
    - _Usage:_ The Python routing backend will use `asyncpg` (an asynchronous Postgres driver) and SQLAlchemy for fast, non-blocking metadata inserts. `boto3` (the standard AWS SDK for Python) is used to interface directly with the MinIO API to upload the binaries.

---
Here is the full architectural description for the MITM Gateway of the vTBP system.

### **3. MITM Gateway (Transparent Inline Proxy)**

The MITM Gateway is the heavy-lifting computational core of your architecture. Operating within a privileged Docker container, it intercepts network traffic seamlessly at the kernel level, decrypts encrypted streams using the keys provided by the endpoints, extracts images, and executes the CALPA-NET steganography inference—all while maintaining the illusion of an unbroken, direct connection for the communicating nodes.

#### **Core Features & Responsibilities**

- **Kernel-Level Transparent Interception (eBPF Routing):**
    
    Operates below the standard Linux networking stack. It uses eBPF (XDP) programs attached to the Docker bridge to intercept packets bound for the outside world, route them internally to the proxy engine, and rewrite the outgoing packet headers (IP spoofing) so the destination server believes the traffic came directly from the original endpoint.
    
- **Out-of-Band Decryption Ingestion:**
    
    Runs a dedicated gRPC server that listens for the incoming `SSLKEYLOGFILE` streams sent by the Endpoint Agents. It maps these cryptographic keys to the active TCP sessions, allowing the proxy to decrypt the TLS payloads on the fly without having to install custom Root CAs on the victim machines.
    
- **MIME Filtering & Payload Carving:**
    
    Analyzes the decrypted HTTP/2 and TCP streams to identify data types. It acts as a strict filter: non-image traffic is instantly released and forwarded to the destination to minimize latency, while image binaries are carved out of the stream and buffered into memory for ML analysis.
    
- **Inline Steganalysis (CALPA-NET Inference):**
    
    Triggers the PyTorch-based CALPA-NET model. It takes the carved image, processes it through the deep residual network, and outputs a probability score indicating the presence of steganographic morphisms. For this vTBP demo, it will operate on smaller images to guarantee the network connection does not time out during inference.
    
- **Telemetry & Artifact Broadcasting:**
    
    Once an image is processed, the gateway generates a `.pcap` file of the specific transfer. It pushes the carved image binary, the `.pcap`, the calculated SHA-256 hash, the CALPA-NET score, and the original container ID to the Redis streaming queue to be ingested by the database and SOC interface.
    

#### **Technology Stack**

To achieve this mix of low-level networking and high-level machine learning within your hardware constraints, the stack combines specialized C-based kernel programming with a unified Python backend:

- **Transparent Routing Engine:** **eBPF/XDP (via BCC)**
    
    - _Usage:_ The Extended Berkeley Packet Filter (eBPF) code is written in C and compiled/loaded via the BPF Compiler Collection (BCC) Python bindings. This handles the raw packet interception and IP header spoofing at driver-level speeds.
        
- **Proxy & Decryption Framework:** **mitmproxy (Python Scripting API)**
    
    - _Usage:_ `mitmproxy` operates as the inline engine. Instead of using its default CA certificate method, its Python API is customized to ingest the gRPC-delivered session keys, decrypt the TLS streams, and carve out the image payloads.
        
- **Machine Learning Engine:** **PyTorch**
    
    - _Usage:_ Hosts the pre-trained CALPA-NET model. PyTorch is heavily optimized to run the forward pass inference directly within the proxy pipeline using the Core Ultra 5's available compute resources.
        
- **Communication & Streaming:** **`grpcio` & `redis-py`**
    
    - _Usage:_ `grpcio` hosts the server receiving keys from the endpoints. `redis-py` is used to push the final artifacts (scores, hashes, binary URIs) to the Redis message broker asynchronously so the proxy can immediately return to handling network traffic.
        
- **Containerization:** **Privileged Docker Container**
    
    - _Usage:_ Because it requires deep kernel access to load eBPF programs and manipulate network interfaces, this specific container must be run with `--privileged` and `CAP_NET_ADMIN` capabilities within your `docker-compose` topology.

---
Here is the full architectural description for the Routing System of the vTBP architecture.

### **4. Routing System (The Central Orchestrator)**

If the MITM Gateway is the brain of the system, the Routing System is the central nervous system. It is a highly concurrent, asynchronous middleware that sits between the Endpoint Agents, the MITM Gateway, and the Data Layer. It dictates the flow of traffic, enforces security rules, prevents bottlenecks, and ensures that the heavy machine-learning components are never overwhelmed by network floods.

#### **Core Features & Responsibilities**

- **gRPC Ingestion & Multiplexing:**
    
    Acts as the primary gRPC server for the entire architecture. It accepts and multiplexes the persistent HTTP/2 streams from multiple Endpoint Agents, unpacking the Protocol Buffer messages containing raw packet bytes, SSL keys, and SHA-256 hashes.
    
- **Pre-Inference Cache Bypassing:**
    
    Before forwarding any payload to the MITM Proxy for expensive ML inference, it intercepts the incoming SHA-256 hash and queries the Redis cache. If a match is found, it immediately fires a `skip_check` signal back down the gRPC channel to the endpoint, aborting the image transfer and saving immense compute resources.
    
- **Dynamic Rate Limiting & Traffic Shaping:**
    
    Protects the system from Denial of Service (DoS) or accidental flooding. It enforces strict requests per second/minute/hour limits on a per-endpoint basis using token-bucket algorithms. If an endpoint exceeds its limit, the Routing System natively signals the gRPC flow control to throttle the connection.
    
- **Stateful Load Balancing:**
    
    In scenarios where multiple MITM Proxy containers are spun up, this system acts as a load balancer. It tracks the unique IDs of active containers, monitors their current compute load, and dispatches incoming image analysis tasks to the least-burdened proxy worker.
    
- **Asynchronous Queue Dispatch:**
    
    It handles the orchestration of the `db_queue`. Instead of writing directly to the PostgreSQL database (which causes blocking), it takes the telemetry from the endpoints and the inference scores from the MITM Gateway and streams them into Redis.
    
- **Forensic PCAP Generation (The PyShark Mandate):**
    
    To fulfill the strict requirement for Tshark/PyShark integration, the routing system executes an asynchronous background job. It takes the raw packet bytes streamed from the endpoint, wraps them with their corresponding TLS session keys, and utilizes PyShark to generate a strictly compliant, standalone forensic `.pcap` file, which is then shipped to MinIO.
    

#### **Technology Stack**

Because this component must handle thousands of concurrent connections and route data across multiple microservices without blocking, it relies heavily on asynchronous event loops:

- **Core Runtime & Concurrency:** **Python 3.11+ (`asyncio`)**
    
    - _Usage:_ The entire system is built around Python's native async event loop to handle concurrent gRPC streams and non-blocking I/O operations seamlessly.
        
- **Communication Protocol:** **`grpcio` & `grpcio-tools`**
    
    - _Usage:_ Hosts the master gRPC server. It defines the service contracts and message structures that the Endpoint Agents consume.
        
- **Queue & Cache Interfacing:** **`redis-py` (Async mode)**
    
    - _Usage:_ Used for sub-millisecond cache lookups (the hash checks) and for managing the rate-limiting counters. It also pushes the final metadata payloads into the Redis Streams for the database workers to consume.
        
- **Forensic Network Processing:** **PyShark / Tshark**
    
    - _Usage:_ Operating strictly in the background (to avoid stalling the live network traffic), PyShark takes the aggregated network streams and reconstructs them into `.pcap` files for the immutable forensic vault.
        
- **Containerization:** **Docker**
    
    - _Usage:_ Runs as a stateless container. This allows you to easily scale the routing system horizontally if the gRPC connection limits are ever reached.
        

With this component defined, we have the complete pipeline mapped from the edge (Endpoint) through the core (Router/Proxy) and into the memory banks (Data Layer).
