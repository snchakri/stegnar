# Extensive Platform Setup & Operational Configuration Guide

This document defines the strict, enterprise-grade deployment protocols required to stand up the Stegnar Prototype. Due to the high-throughput, latency-sensitive nature of distributed steganalysis, any deviation from these infrastructural configurations may inherently impact tensor execution capabilities or network interception reliability.

## 1. Prerequisites and Infrastructure Requirements
Operating the full stack requires rigorous baseline infrastructure.

**Hardware Guidelines (Minimum)**
- **CPU:** 8-Core x86_64 architecture (e.g., Intel Xeon / AMD EPYC).
- **RAM:** 32 GB minimum (64 GB heavily recommended for unpooled tensor execution buffering).
- **GPU (Optional but Crucial):** NVIDIA T4, V100, or A100. Must support CUDA 11+. Ensure 
vidia-container-toolkit is natively installed on the host to expose PCIe hardware completely into Docker layers.
- **Disk:** 500GB NVMe SSD (PostgreSQL indexing and MinIO blob culling scales rapidly).

**Software Dependencies**
- **Docker Engine:** Version 24.0.0+ (Must support Docker Compose V2 natively).
- **Runtime:** Linux Kernel 5.4+ (Strictly required for eBPF mitm-gateway execution).
- **Python:** strictly >= 3.10 and <= 3.11 (TensorFlow backward compatibility bindings).
- **Node.js:** v18.x (LTS) for React Frontend compiling.

---
## 2. Environment Configuration
Create a .env at the absolute repository root.

`ash
PGHOST=postgres-core
PGPORT=5432
PGUSER=stegnar_admin
PGPASSWORD=GenerateAStrongCryptographicStringHere123!
PGDATABASE=stegnar_telemetry

MINIO_ENDPOINT=minio-store:9000
MINIO_ACCESS_KEY=admin_stege
MINIO_SECRET_KEY=SuperSecretMinioPassword!

CALPA_MODEL_PATH=/calpa/generated_cfg_and_model/trained_pruned_model/Model_438375.ckpt
CALPA_CFG_PATH=/calpa/generated_cfg_and_model/srnet_juniward_04_threshold05.cfg
`

---
## 3. Deployment Playbooks

### Tier A: Localized execution (Docker Compose)
1. Ensure Docker Desktop configures at least 16GB RAM for the WSL2/Hyper-V hypervisor.
2. Execute Full Orchestration Stack:
   docker compose up --build -d

### Tier B: Production Execution (Kubernetes)
1. **MinIO / PostgreSQL StatefulSets:** Must be executed using PVCs.
2. **GPU Node Labeling:** Tag specific Kubernetes worker nodes: kubectl label nodes node-gpu01 hardware-type=nvidia-ampere

---
## 4. Troubleshooting Operational Latency
- **Symptom:** soc-api dropping frames, returning 503 Service Unavailable.
  - **Resolution:** Your MinIO bucket IOPS are saturated. Use NVMe block storage.
- **Symptom:** calpa-probe triggers OOM_KILLED crashing the process.
  - **Resolution:** Limit inbound tensors strictly to HD parameters before segmentation algorithms partition matrices.
