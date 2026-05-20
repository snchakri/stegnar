# Architecture Overview

This document gives a detailed technical overview of the system architecture, component responsibilities, data flows, and integration points. Use this as the canonical reference when onboarding new engineers or writing high-level design artifacts.

## Logical components

1. Inference / Model Layer
   - Location: `CALPA-NET-master/`, `models/`, `generated_cfg_and_model/`
   - Contains model definitions, training/evaluation, and inference scripts for SRNet/XuNet variants.
   - Model artifacts are referenced by path (e.g., `Model_438375.ckpt`) and consumed by probe workers.

2. Probe Workers
   - Location: `calpa-probe/`, `mitm-gateway/`, `endpoint-agent/`
   - Probes perform inference on demand and return structured results. They may restore TensorFlow checkpoints or load PyTorch models depending on the implementation.

3. Ingest & Data Layer
   - Location: `data-layer/`
   - Responsibilities: validating payloads, storing proofs in MinIO, writing analysis results to PostgreSQL, migrations and schema management.

4. Routing & Orchestration
   - Location: `routing-system/`
   - Responsibilities: deciding which probe to dispatch, performing rate-limiting, queuing jobs, and writing to the queue writer.

5. Service API & Frontend
   - Location: `soc-api/` and `src/`
   - `soc-api/server.py` accepts analysis requests, consults caches, and returns verdicts. The frontend provides diagnostic UIs and basic control endpoints.

6. Utilities & Demo
   - `scripts/`, `docker-compose.yml` provide demo orchestration, reset, and smoke tests.

## Data flow (high level)

Client -> `soc-api` (ingest endpoint)
  -> enqueue job in dispatcher/queue
  -> `calpa-probe` (worker) performs inference using model artifact
  -> result written to Postgres; optional proof blob to MinIO
  -> frontend queries Postgres / MinIO for results and diagnostics

## Integration points and protocols

- HTTP/gRPC between services when appropriate.
- MinIO S3-compatible API for object storage.
- PostgreSQL for structured results and caches.
- Docker Compose for local orchestration and quick demos.

## Operational considerations

- Model artifacts must be pinned via immutable URLs or object storage with checksums.
- Workers should support both local filesystem models and remote URLs.
- Rate limiting and queueing should be tuned for expected throughput.
- Provide health checks (HTTP/gRPC) for each service.

## Notes for maintainers

- Keep model-loading code isolated and injectable to facilitate safe open-sourcing without bundling models.
- Provide reproducible Dockerfiles for building inference environments without shipping large binary checkpoints.
