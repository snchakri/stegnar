STEGNAR SOC — Final Page & Component Specification

How the backend talks to the frontend (critical context)
Your Node.js backend already has:

GET /api/endpoints → queries ledger for EVENT_TYPE_ENDPOINT_ENTITY
GET /api/endpoints/:id/events → QueryEvents RPC filtered by endpoint_id
WebSocket eventStream → real RunReplay stream from ledger
REST routes for Redis/Postgres stats

Your frontend consumes: REST for data, WebSocket for live pushes. Every component maps to one of these.

Page 1 — InfrastructureHealth (your teammate's exact ask)
Route: /infrastructure
Purpose: Real-time view of every running service's health — this is the ops "is everything alive" page.
Components and exactly what each one is:
ServiceStatusRow — A horizontal strip at the top. One pill per core service: proxy, routing-server, model-service, data-ledger, soc-backend. Each pill shows: service name, readiness state (UP/DEGRADED/DOWN), uptime counter. Source: GET /api/health which polls ServiceHealthState.readiness from routing's service registry.
ContainerWarmPoolGrid — A grid of cards, one per container slot. Each card shows: slot_id, state (WarmIdle / Assigned / Running / Sanitizing / Failed — from the spec's 8 lifecycle states), assigned_job_id if running, last_health_check timestamp, profile_id. Source: GET /api/containers/slots. This is exactly Module 04's WarmSlot structure.
ContainerStateDistributionChart — A donut chart showing count of containers in each of the 8 lifecycle states. Gives instant "how many are warm vs busy vs failed" answer. Derived from the same container slots data.
RedisQueuePanel — Maps directly to QueuePanelState from Module 07 spec:

Depth gauge (visual fill bar, 0 to max)
Throughput (msgs/sec)
oldest_age_ms (how long the oldest item has been sitting)
Saturation level badge: HEALTHY / WARNING / CRITICAL (the spec's exact 3 states)
A table of current queue items: job_id, priority class (critical/high/normal/background — from spec's 4 classes), endpoint_id, artifact_digest (truncated), deadline_ms, age. Each row has a delete button.
"Clear All" button (calls DELETE /api/redis/queue)
Source: GET /api/redis/queue

RedisCachePanel — Redis cache stats:

Hit rate percentage (bar)
Memory used / max (from Redis INFO)
Key count
Eviction count
TTL distribution (small bar chart showing buckets: <1min, 1-10min, 10-60min, >60min)
"Clear Cache" button
Source: GET /api/redis/cache

PostgresHealthPanel — Maps to DB operational stats:

Active connections count / max
Query latency p95 (last 5 min sparkline)
DB size on disk
Replication lag if applicable
Last slow query (query text truncated, duration, timestamp)
Source: GET /api/db/stats

LatencyKPIRow — A row of 3 KPI cards directly from Module 10's SLO targets:

Cached-path p95 (target: <250ms — shows green/red against threshold)
Uncached-path p95 (target: <1200ms)
Control-plane action p95 (target: <200ms)
Source: GET /api/metrics/latency

BackpressureSignalBanner — Only visible when active. Shows current BackpressureSignal from routing: service_id, severity, queue_growth_rate, recommended_action. This is Module 03's exact BackpressureSignal structure. Disappears when severity returns to normal.

Page 2 — LanTopology (the God View)
Route: /topology
Purpose: Live interactive graph of all enrolled endpoints and the core service mesh. The analyst's primary monitoring view.
Components:
TopologyCanvas — The main D3-force graph. Nodes are either:

Core services: proxy, routing-server, model-service, data-ledger (always present, square icons)
Enrolled endpoints: laptops/servers/phones (from ledger's EVENT_TYPE_ENDPOINT_ENTITY)

Edges are TopologyEdge objects from the spec: src_node → dst_node, protocol, threat_level, active_streams count. Edges only appear when there's an active stream between nodes. Node visual state maps to TopologyNode.trust_state: ActiveTrusted (green), ActiveRestricted (amber), Quarantined (red pulse), Unenrolled (grey). Source: WebSocket eventStream pushing topology delta events (node/edge state changes).
StreamPulseOverlay — CSS-animated dots that travel along edge lines when active_streams > 0. When an image is extracted from a stream, a distinct pulse fires on that edge. Pure visual layer on top of canvas, driven by WebSocket events.
ThreatEdgeOverlay — When a threat_level on an edge changes to HIGH or CRITICAL, that edge turns crimson and pulses. The source endpoint node also gets a pulsing red ring. Driven by WebSocket.
NodeDetailDrawer — Slides in from the right when you click any endpoint node. Shows:

EndpointIdentity fields: endpoint_id, mac_address, ip_set, trust_state, enrollment_time (from Module 01 spec)
AttestationState: last challenge_issued_at, verification_result, failure_count
Live traffic_rate from TopologyNode.traffic_rate
Recent alert count
"View Image History" button → navigates to Page 3 filtered to this endpoint
"Isolate Endpoint" button → calls POST /api/control/isolate with endpoint_id and reason_code input. This is Flow F004 from Module 11.
Source: GET /api/endpoints/:id

ServiceNodeDrawer — Same concept but for core service nodes (proxy, routing, etc). Shows: ServiceHealthState fields (readiness, cpu_load, mem_load, queue_depth, last_heartbeat). No isolate button — services don't get isolated.
TopologyFilterBar — Three toggle filters: All Nodes / Active Only / Flagged Only. Plus: zoom reset button, fit-to-screen button, legend panel. Local state only.
LiveEventTicker — A narrow scrolling strip at the bottom of the canvas. Shows the last 20 events: timestamp, event_type, endpoint_id, brief description. Driven by WebSocket. Clicking an event item opens the relevant drawer or navigates to the ledger entry.

Page 3 — ImageAnalysisFeed
Route: /images
Purpose: Every artifact the system has ever processed, with all forensic scores. "Fetching from node all historical image analysis."
Components:
FeedFilterBar — Filter controls:

Endpoint selector (dropdown populated from enrolled endpoints)
Time range picker (from/to)
Status filter: All / Clean / Suspicious / Flagged / Pending
CALPA confidence threshold slider (show only results above X%)
Search by SHA-256 hash
All filters are query params → GET /api/artifacts

ArtifactTable — The main data grid. Columns:

Thumbnail (small extracted image if held, else hash icon)
canonical_digest (first 16 chars of BLAKE3 hash, monospace)
Source endpoint IP
first_seen_at timestamp
CALPA score (color-coded: green <30%, amber 30-70%, red >70%)
shannon_entropy value (from forensic pipeline)
lsb_variance value
edge_density_ratio value
byte_density value
Status badge
Actions: "Inspect" button

These columns map directly to ArtifactRecord from Module 06 plus the forensic stats from Module's image analysis pipeline. Source: GET /api/artifacts?endpoint=&from=&to=&status=
ArtifactDetailDrawer — Slides in on row click or Inspect button. Contains:

Full ArtifactRecord fields
InferenceResult: label, confidence, raw_score, model_version, latency_ms (Module 05 spec)
ForensicScorePanel: 5 bars, one per metric (entropy, skewness, kurtosis, lsb_variance, edge_density, byte_density) each with a "normal range" marker and "anomaly threshold" line. This is the visual representation of the forensic telemetry data.
Container that processed it: job_id, profile_id, container state
Routing decision: allow/block, reason_code
Chain index in ledger (link to ledger page)
"Extract Watermark" button → opens watermark extraction modal (Flow F006)

WatermarkExtractionModal — Triggered from drawer. Shows:

Reason code input (required by spec — access control validates reason code)
On submit: calls POST /api/watermark/extract with artifact_digest and reason_code
Result shows WatermarkExtractionRecord fields: extraction_confidence, extracted_payload_ref, success_flag, actor_id, extracted_at (Module 06 spec structure)

LiveToggle — Switch in the top bar. When ON, new rows prepend in real time via WebSocket. When OFF, static snapshot.
ExportButton — Exports current filtered view as forensic_telemetry CSV (the exact format in the image forensics spec doc). Calls GET /api/artifacts/export.

Page 4 — Ingestion (Offline Mode)
Route: /ingest
Purpose: Offline artifact submission — analyst manually uploads a PCAP or image for analysis. Flow F002 from Module 11.
Components:
PcapDropZone — Large drag-and-drop target. Accepts .pcap, .pcapng. On drop: creates upload session via POST /api/ingest/session, then streams chunks via POST /api/ingest/chunk, finalizes via POST /api/ingest/finalize. This maps to Module 07's 3-step ingestion API contract.
ImageDropZone — Same but accepts raw image files .jpg, .png, .bmp. Single-step upload.
KeylogUpload — Secondary upload button specifically for TLS keylog files (keys.log). Shows a grey unchecked state → green verified checkmark once the backend confirms cryptographic match via POST /api/ingest/keylog. The spec explicitly calls out this verification step (Module 07).
PipelineProgressTracker — The animated stage machine. Only visible after upload starts. Shows stages as sequential steps with icons:

Validating integrity (digest check)
Extracting TLS (if keylog attached)
Reassembling TCP streams
Extracting image artifacts (shows count: "Found 47 images")
Dispatching to queue
Analysis running

Each step transitions: pending → in_progress (spinner) → completed (checkmark) → or failed (X with error detail). Driven by WebSocket job status events. Maps to Module 07's offline ingestion stage tracker algorithm.
IngestJobHistoryTable — Past ingestion jobs list. Columns: filename, file type, submitted_at, images_extracted, threats_found, job status, link to results. Source: GET /api/ingest/jobs. Clicking a row navigates to Page 3 filtered by that job's artifacts.

Page 5 — LedgerTrail
Route: /ledger
Purpose: Immutable audit trail — every event ever recorded with BLAKE3 chain integrity.
Components:
ChainIntegrityBanner — Always at the top. Shows:

"Chain verified up to index #N — last checked Xm ago" in green
Turns RED with alert text if chain integrity check fails (a TamperEvent or mismatch — spec calls this out explicitly in Module 06 failure modes)
Source: GET /api/ledger/integrity (polls every 60s)

EventTypeSelector — Dropdown or tab strip to filter by event type. Options map directly to Module 06's canonical primitive entities:

All Events
EndpointEntity / AttestationEvent / TamperEvent
InferenceEvent / ExtractionEvent
AlertEvent / SocActionEvent
QueueEvent / CacheEvent
ContainerLifecycleEvent
RoutingDecisionEvent
RbacEvent / WatermarkExtractionEvent

LedgerTable — The main table. Columns:

chain_index (monospace, sortable)
event_id (truncated UUID)
event_type badge
producer_id (which service emitted this)
produced_at
Payload summary (human-readable description derived from event type)
Integrity badge: ✓ (verified) or ✗ (broken link in chain)
Source: GET /api/ledger/events?type=&from=&chain_from=&chain_to=

EventDetailModal — Click any row. Shows full event envelope from the spec's exact EventEnvelope contract:

event_id, event_type, producer_id, produced_at
payload (formatted by event type)
digest_descriptor: algorithm, mode, context, length_bytes, digest_value, digest_version
previous_event_digest (with a "verify link" button that calls the integrity check for just this node)
chain_index

ReplayPanel — Collapsible section at the bottom. Fields:

From chain_index (number input)
To chain_index (number input)
Event type filter (multi-select)
"Start Replay" button → POST /api/ledger/replay which creates a ReplayCursor (Module 06 spec structure)
Active replay job progress: shows replay_id, current_chain_index, status (running/completed/failed), started_at
On completion: "View Replay Report" link


Page 6 — Settings
Route: /settings
Purpose: All system control knobs. No monitoring here — only configuration that changes system behavior.
Components:
ModelProfileControls — Maps to Module 05's InferenceProfile:

"Confidence Threshold" slider (0–100%) — below this score, result is ambiguous, SOC review is triggered. Calls POST /api/settings/model/threshold
"Speed vs Accuracy" slider — left = max speed (high quantization), right = max accuracy (no quantization). Maps to quantization_mode in InferenceProfile. Calls POST /api/settings/model/profile
"Explainability" toggle — enables/disables explanation_enabled in profile
Current active profile badge: profile_id, latency_budget_ms, accuracy_priority

GlobalThresholdControl — Separate from model confidence. This is the spec's set_global_threshold API — the head governance role's baseline threshold x that lower roles cannot exceed. One number input + save button. Shows currently active threshold with last-updated-by and timestamp.
ProtocolWhitelistPanel — Checkboxes for: HTTP/1.1, HTTP/2, HTTP/3, IPv4, IPv6. Maps to Module 01's ProtocolPolicy.allowed_protocols. "Unchecking = deny for that protocol at endpoint boundary". Calls POST /api/settings/protocols. Shows policy_version and effective_at on current active policy.
QueueManagerPanel — Same data as Page 1's RedisQueuePanel but with full control:

Depth gauge
Full item table with individual delete buttons (each row: job_id, priority, age, endpoint_id, artifact_digest, deadline_ms)
"Clear All" button with confirmation dialog (spec says dual-approval for queue purge when configured)
Source: same as Page 1 but with write operations

CacheSettingsPanel:

TTL slider (minutes)
Max memory size input (MB)
"Clear Cache" button
Current stats (hit rate, current size, key count) — read-only summary
Calls POST /api/settings/cache

ProxyResourcePanel — Maps to Module 02's runtime resource controls:

RAM limit slider for proxy process
CPU thread count input
Max concurrent streams input
Calls POST /api/settings/proxy


Page 7 — DatabaseView
Route: /database
Purpose: Live read access to PostgreSQL. The Wireshark-style streaming data grid.
Components:
TableSidebar — Left column. Lists all PostgreSQL tables from the spec's data model:

endpoints, sessions, streams, artifacts
extraction_events, inference_events, alert_events
soc_action_events, rbac_events
queue_events, cache_events
container_lifecycle_events, routing_decision_events
attestation_events, tamper_events
watermark_extraction_records
ledger_nodes
Each table shows row count and last_write_at. Clicking selects it for the main grid.
Source: GET /api/db/tables

LiveDataGrid — The main table. Streams new rows in real-time via WebSocket when in Live mode. Columns are dynamic based on selected table, derived from the spec's exact field names for each entity. Has column visibility toggles (some sensitive fields masked by default). Source: WebSocket + GET /api/db/tables/:name/rows?limit=100
QueryBar — A WHERE-clause style input. Not full SQL — it's a structured filter: field, operator (=, >, <, LIKE, IN), value. Multiple conditions with AND/OR. Translates to safe parameterized queries. Example: source_endpoint = '192.168.1.5' AND confidence > 0.8. Calls GET /api/db/query
TableStatsPanel — Right sidebar (collapsible). For selected table: row count, table size on disk, index hit rate, last write, oldest record, newest record. Source: GET /api/db/tables/:name/stats
ExportPanel — Export current filtered view as CSV. Requires reason_code input (spec says export operations are fully audited with purpose and actor metadata). Calls GET /api/db/export which logs to ledger.

Global Shell (wraps every page)
Sidebar — Left navigation. Logo + 7 page links with icons. Each page link shows a badge if there are active alerts relevant to that page (e.g., Infrastructure shows red dot if a service is DOWN, Ledger shows red dot if chain integrity failed).
GlobalAlertBanner — Appears at top of screen only when a new AlertEvent with severity HIGH or CRITICAL comes in via WebSocket. Shows: endpoint_id, confidence, brief description. Click navigates to that artifact in Page 3. Auto-dismisses after analyst clicks or after 30s.
ConnectionStatusIndicator — Small icon in top-right corner. Green WiFi icon = WebSocket connected. Amber = reconnecting. Red = disconnected. When disconnected, shows "Reconnecting..." with retry counter. Maps to Module 07's spec requirement: "UI state recovery supports reconnect after transient network loss."
mockData.ts — One file. Contains typed mock objects for every data structure above, matching the exact field names from the spec. Structured so the only change needed to go live is replacing import { mock } from './mockData' with import { fetchFromApi } from './api' per component.

Cross-page navigation (the 4 links that matter)

LanTopology → NodeDetailDrawer → "View Image History" → ImageAnalysisFeed?endpoint_id=X
ImageAnalysisFeed → ArtifactDetailDrawer → chain_index link → LedgerTrail?chain_index=N
InfrastructureHealth → RedisQueuePanel → queue item row → Settings#queue-manager
LedgerTrail → ReplayPanel → completed job → ImageAnalysisFeed?replay_id=X