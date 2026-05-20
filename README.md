# Stegnar Prototype

This repository runs the full Stegnar demo stack (routing, MITM, CALPA, storage, SOC API, frontend, sender/receiver endpoints) using `docker-compose`.

## Requirements

- Docker Desktop (Linux containers)
- Python 3.11+ (for local smoke tests)

The SOC API uses the Docker Python SDK and requires the host Docker socket:
`/var/run/docker.sock` is mounted in `docker-compose.yml`.

## Runtime-proof storage layout

All runtime-local state is now bind-mounted under a **run-specific directory**:

- Redis data
- PostgreSQL data
- MinIO object store
- Proxy cert/cache state
- SOC API ingest temp files
- Receiver proof files (`node-9` to `node-16`)
- Sender send-once state markers (`sender-state/node-1..node-8`)

Each run is created under:

`runtime/runs/<run-name>/`

This makes demo verification and forensic review easier.

## Deterministic sender profile

Sender/receiver mapping and payload selection are environment-driven through `.env.runtime`:

- `SENDER_<1..8>_TARGET_URL` maps each sender to a receiver upload endpoint.
- `SENDER_<1..8>_IMAGE_FILE` picks clean/stego payload per sender.
- `SENDER_CAPTURE_FILTER` controls capture scope for sender agents.

`scripts/start-demo.ps1` now seeds `.env.runtime` from `.env.runtime.example` and writes a per-run `RUNTIME_DIR`.

## Start demo (PowerShell)

```powershell
./scripts/start-demo.ps1
```

Start with full reset (containers, compose volumes, image/build cache):

```powershell
./scripts/start-demo.ps1 -Reset
```

Start with explicit run name:

```powershell
./scripts/start-demo.ps1 -RunName demo-a
```

## Reset only

```powershell
./scripts/reset-demo.ps1
```

## Manual compose env

You can also set runtime path manually via env file:

```powershell
Copy-Item .env.runtime.example .env.runtime
docker compose --env-file .env.runtime up -d --build
```

## Quick smoke test

Run the ingest test against the local SOC API:

```powershell
python scripts/run_ingest_test.py
```

Override the API origin if needed:

```powershell
$env:API_URL = "http://localhost:3001"
python scripts/run_ingest_test.py
```

## Diagnostics UI

The frontend is served on port 3000 (via `soc-frontend`). Key routes:

- `http://localhost:3000/diagnostics` - aggregated runtime diagnostics
- `http://localhost:3000/ingest` - ingest debug and history
  
