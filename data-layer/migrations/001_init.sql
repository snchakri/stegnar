-- =============================================================================
-- STEGNAR vTBP — PostgreSQL + TimescaleDB Schema
-- Migration 001: Initial schema
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- network_events — primary forensic ledger (TimescaleDB hypertable)
-- =============================================================================
CREATE TABLE IF NOT EXISTS network_events (
    event_id     UUID        NOT NULL DEFAULT gen_random_uuid(),
    ts           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    endpoint_id  TEXT        NOT NULL,
    stream_id    TEXT        NOT NULL,
    src_ip       TEXT,
    dst_ip       TEXT,
    src_port     INT,
    dst_port     INT,
    sha256       TEXT,
    bytes_total  BIGINT      DEFAULT 0,
    pcap_uri     TEXT,           -- MinIO object path for .pcap file
    image_uri    TEXT,           -- MinIO object path for carved image
    steg_score   FLOAT,          -- CALPA-NET P(stego) 0.0–1.0
    verdict      TEXT,           -- CLEAN | STEGO | AMBIGUOUS | CACHE_HIT | NO_IMAGE | ERROR
    latency_ms   INT,
    model_type   TEXT DEFAULT 'srnet',
    PRIMARY KEY (event_id, ts)
);

SELECT create_hypertable(
    'network_events', 'ts',
    chunk_time_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- Index for per-stream and per-endpoint queries
CREATE INDEX IF NOT EXISTS idx_ne_stream_id    ON network_events (stream_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ne_endpoint_id  ON network_events (endpoint_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ne_verdict      ON network_events (verdict, ts DESC);
CREATE INDEX IF NOT EXISTS idx_ne_sha256       ON network_events (sha256);

-- =============================================================================
-- hash_cache — persistent backing for Redis KV (SHA-256 analysis cache)
-- =============================================================================
CREATE TABLE IF NOT EXISTS hash_cache (
    sha256       TEXT        PRIMARY KEY,
    verdict      TEXT        NOT NULL,
    steg_score   FLOAT,
    model_type   TEXT        DEFAULT 'srnet',
    analyzed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hit_count    INT         NOT NULL DEFAULT 0
);

-- =============================================================================
-- endpoint_registry — known endpoint agents
-- =============================================================================
CREATE TABLE IF NOT EXISTS endpoint_registry (
    endpoint_id  TEXT        PRIMARY KEY,
    first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address   TEXT,
    total_chunks BIGINT      NOT NULL DEFAULT 0,
    total_bytes  BIGINT      NOT NULL DEFAULT 0
);

-- =============================================================================
-- Continuous aggregate: per-minute verdict summary for SOC dashboard
-- =============================================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS verdict_per_minute
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', ts)   AS bucket,
    endpoint_id,
    verdict,
    COUNT(*)                       AS event_count,
    AVG(steg_score)                AS avg_score
FROM network_events
GROUP BY bucket, endpoint_id, verdict
WITH NO DATA;

SELECT add_continuous_aggregate_policy(
    'verdict_per_minute',
    start_offset => INTERVAL '10 minutes',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);
