import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { TopBar } from '../components/TopBar';
import { ZoomIn, ZoomOut, Maximize, X, Image, FileText, AlertTriangle, Shield, Activity, Cpu, Server } from 'lucide-react';

// ── Data ──────────────────────────────────────────────────────────────────────

type NodeType = 'service' | 'endpoint';
type TrustState = 'active' | 'restricted' | 'quarantined';
type ThreatLevel = 'none' | 'warning' | 'critical';

interface Node {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  trust_state: TrustState;
  activity_count: number;
  serviceIcon?: 'proxy' | 'routing' | 'model' | 'ledger';
}

interface Edge {
  id: string;
  from: string;
  to: string;
  threat: ThreatLevel;
  active_streams: number;
  dest_ip?: string;
}

const NODES: Node[] = [
  // Core services — center cluster
  { id: 'proxy',   type: 'service',  label: 'mitm-proxy',     sublabel: 'Inline Interceptor', x: 500, y: 220, trust_state: 'active',      activity_count: 412, serviceIcon: 'proxy'   },
  { id: 'routing', type: 'service',  label: 'routing-server', sublabel: 'Control Plane',      x: 500, y: 380, trust_state: 'active',      activity_count: 311, serviceIcon: 'routing' },
  { id: 'model',   type: 'service',  label: 'model-service',  sublabel: 'CALPA Inference',    x: 680, y: 300, trust_state: 'active',      activity_count: 189, serviceIcon: 'model'   },
  { id: 'ledger',  type: 'service',  label: 'data-ledger',    sublabel: 'Immutable Log',      x: 320, y: 300, trust_state: 'active',      activity_count: 247, serviceIcon: 'ledger'  },
  // Enrolled endpoints
  { id: 'ep1', type: 'endpoint', label: '192.168.1.45', sublabel: 'QUARANTINED',  x: 160, y: 140, trust_state: 'quarantined', activity_count: 124 },
  { id: 'ep2', type: 'endpoint', label: '192.168.1.89', sublabel: 'Restricted',   x: 500, y: 80,  trust_state: 'restricted',  activity_count: 67  },
  { id: 'ep3', type: 'endpoint', label: '192.168.1.23', sublabel: 'Trusted',      x: 840, y: 140, trust_state: 'active',      activity_count: 23  },
  { id: 'ep4', type: 'endpoint', label: '192.168.1.67', sublabel: 'Trusted',      x: 160, y: 460, trust_state: 'active',      activity_count: 41  },
  { id: 'ep5', type: 'endpoint', label: '192.168.1.12', sublabel: 'Trusted',      x: 840, y: 460, trust_state: 'active',      activity_count: 18  },
];

const EDGES: Edge[] = [
  { id: 'e1', from: 'ep1',   to: 'proxy',   threat: 'critical', active_streams: 3, dest_ip: '93.184.216.34'  },
  { id: 'e2', from: 'ep2',   to: 'proxy',   threat: 'warning',  active_streams: 1, dest_ip: '151.101.65.69'  },
  { id: 'e3', from: 'ep3',   to: 'proxy',   threat: 'none',     active_streams: 1, dest_ip: '104.16.123.96'  },
  { id: 'e4', from: 'ep4',   to: 'proxy',   threat: 'none',     active_streams: 0, dest_ip: '172.217.14.206' },
  { id: 'e5', from: 'ep5',   to: 'proxy',   threat: 'none',     active_streams: 1, dest_ip: '8.8.8.8'        },
  { id: 'e6', from: 'proxy', to: 'routing', threat: 'none',     active_streams: 6 },
  { id: 'e7', from: 'proxy', to: 'ledger',  threat: 'none',     active_streams: 3 },
  { id: 'e8', from: 'routing', to: 'model', threat: 'none',     active_streams: 2 },
  { id: 'e9', from: 'routing', to: 'ledger',threat: 'none',     active_streams: 4 },
];

// ── Colour helpers ────────────────────────────────────────────────────────────

const TRUST_COLOR: Record<TrustState, { stroke: string; fill: string; glow: string }> = {
  active:      { stroke: '#22c55e', fill: '#052e16', glow: '0 0 14px rgba(34,197,94,0.45)'  },
  restricted:  { stroke: '#f59e0b', fill: '#2d1a0e', glow: '0 0 14px rgba(245,158,11,0.45)' },
  quarantined: { stroke: '#ef4444', fill: '#450a0a', glow: '0 0 18px rgba(239,68,68,0.55)'  },
};

const THREAT_COLOR: Record<ThreatLevel, string> = {
  none:     '#334155',
  warning:  '#f59e0b',
  critical: '#ef4444',
};

const SERVICE_ICON_MAP: Record<string, typeof Shield> = {
  proxy:   Activity,
  routing: Server,
  model:   Cpu,
  ledger:  Shield,
};

// ── Live event ticker data ────────────────────────────────────────────────────

const TICKER_EVENTS = [
  { time: '14:23:45', type: 'IMAGE_EXTRACTED',   endpoint: '192.168.1.45', desc: 'JPEG extracted from TLS stream' },
  { time: '14:23:42', type: 'ALERT_RAISED',      endpoint: '192.168.1.45', desc: 'CALPA score 94.2% — malicious' },
  { time: '14:23:38', type: 'STREAM_OPENED',     endpoint: '192.168.1.89', desc: 'New HTTPS stream → 151.101.65.69' },
  { time: '14:23:35', type: 'INFERENCE_DONE',    endpoint: '192.168.1.23', desc: 'Score 23.1% — benign' },
  { time: '14:23:30', type: 'CONTAINER_STARTED', endpoint: 'routing-server', desc: 'slot-03 assigned job_a7f3e9b2' },
  { time: '14:23:25', type: 'INTEGRITY_CHECK',   endpoint: 'data-ledger',  desc: 'Chain verified to #1247' },
];

const TYPE_BADGE: Record<string, string> = {
  IMAGE_EXTRACTED:   '#3b82f6',
  ALERT_RAISED:      '#ef4444',
  STREAM_OPENED:     '#22c55e',
  INFERENCE_DONE:    '#a855f7',
  CONTAINER_STARTED: '#f59e0b',
  INTEGRITY_CHECK:   '#14b8a6',
};

// ── Main component ────────────────────────────────────────────────────────────

export function TopologyPage() {
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [filter, setFilter] = useState<'all' | 'active' | 'flagged'>('all');
  const [isolateConfirm, setIsolateConfirm] = useState(false);
  const [tick, setTick] = useState(0);

  // Animate pulse rings
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1200);
    return () => clearInterval(id);
  }, []);

  const visibleNodes = NODES.filter(n => {
    if (filter === 'active')  return n.trust_state === 'active';
    if (filter === 'flagged') return n.trust_state !== 'active';
    return true;
  });
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = EDGES.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to));

  const handleViewImages = (n: Node) => navigate(`/images?endpoint=${encodeURIComponent(n.label.startsWith('192') ? `ep_${n.label}` : n.id)}`);
  const handleViewLogs   = (n: Node) => navigate(`/logs?endpoint=${encodeURIComponent(n.label.startsWith('192') ? `ep_${n.label}` : n.id)}`);

  const handleIsolate = () => {
    if (!isolateConfirm) { setIsolateConfirm(true); return; }
    alert(`Isolation command sent for ${selectedNode?.label}`);
    setIsolateConfirm(false);
    setSelectedNode(null);
  };

  // SVG viewBox is fixed; we only scale with CSS transform
  const VW = 1000, VH = 560;

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Network Topology" />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Canvas side ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <span>{visibleNodes.filter(n => n.type === 'endpoint').length} endpoints</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span>{visibleEdges.length} connections</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ color: '#ef4444' }}>{NODES.filter(n => n.trust_state === 'quarantined').length} quarantined</span>
            </div>

            {/* Filter pills */}
            <div className="flex gap-1">
              {(['all', 'active', 'flagged'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12,
                    fontWeight: filter === f ? 600 : 400,
                    background: filter === f ? 'var(--accent)' : 'var(--bg-sidebar)',
                    color: filter === f ? '#fff' : 'var(--text-secondary)',
                    border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'all' ? 'All Nodes' : f === 'active' ? 'Trusted Only' : 'Flagged Only'}
                </button>
              ))}
            </div>

            {/* Zoom controls */}
            <div className="flex gap-1">
              {[
                { icon: ZoomIn,  action: () => setZoom(z => Math.min(z + 0.15, 2.2)) },
                { icon: ZoomOut, action: () => setZoom(z => Math.max(z - 0.15, 0.4)) },
                { icon: Maximize,action: () => setZoom(1) },
              ].map(({ icon: Icon, action }, i) => (
                <button key={i} onClick={action} style={{
                  padding: 7, borderRadius: 6, background: 'var(--bg-sidebar)',
                  border: '1px solid var(--border-default)', cursor: 'pointer',
                }}>
                  <Icon size={15} style={{ color: 'var(--text-secondary)', display: 'block' }} />
                </button>
              ))}
            </div>
          </div>

          {/* SVG Canvas */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#080c12' }}>
            {/* Dot-grid background */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }}>
              <defs>
                <pattern id="dot" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="1.5" cy="1.5" r="1.5" fill="#94a3b8" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#dot)" />
            </svg>

            {/* Main graph */}
            <svg
              viewBox={`0 0 ${VW} ${VH}`}
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s ease',
              }}
            >
              <defs>
                <marker id="arrow-none"     markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#334155" />
                </marker>
                <marker id="arrow-warning"  markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b" />
                </marker>
                <marker id="arrow-critical" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
                </marker>
                <filter id="glow-red">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                <filter id="glow-green">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>

              {/* ── Edges ── */}
              {visibleEdges.map(edge => {
                const from = NODES.find(n => n.id === edge.from);
                const to   = NODES.find(n => n.id === edge.to);
                if (!from || !to) return null;
                const color = THREAT_COLOR[edge.threat];
                const width = edge.threat === 'critical' ? 2.5 : edge.active_streams > 0 ? 1.8 : 1;
                const dash  = edge.threat === 'critical' ? '8 4' : edge.active_streams > 0 ? undefined : '4 4';

                return (
                  <g key={edge.id}>
                    {/* Glow layer for active edges */}
                    {edge.active_streams > 0 && (
                      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={color} strokeWidth={width + 4} opacity={0.12} />
                    )}
                    <line
                      x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                      stroke={color} strokeWidth={width}
                      strokeDasharray={dash}
                      markerEnd={`url(#arrow-${edge.threat})`}
                      opacity={edge.active_streams === 0 && edge.threat === 'none' ? 0.3 : 0.85}
                    />
                    {/* Stream count badge on edge midpoint */}
                    {edge.active_streams > 0 && (
                      <g transform={`translate(${(from.x + to.x) / 2}, ${(from.y + to.y) / 2})`}>
                        <circle r={9} fill="#0f1620" stroke={color} strokeWidth={1} />
                        <text textAnchor="middle" dominantBaseline="central" fill={color}
                          style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 700 }}>
                          {edge.active_streams}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* ── Nodes ── */}
              {visibleNodes.map(node => {
                const tc       = TRUST_COLOR[node.trust_state];
                const isService= node.type === 'service';
                const r        = isService ? 28 : 22;
                const selected = selectedNode?.id === node.id;
                const isQuaran = node.trust_state === 'quarantined';

                return (
                  <g
                    key={node.id}
                    onClick={() => { setSelectedNode(selected ? null : node); setIsolateConfirm(false); }}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Pulse rings for quarantined / selected */}
                    {isQuaran && (
                      <>
                        <circle cx={node.x} cy={node.y} r={r + 12 + (tick % 2) * 4}
                          fill="none" stroke="#ef4444" strokeWidth={1}
                          opacity={0.25 - (tick % 2) * 0.1} />
                        <circle cx={node.x} cy={node.y} r={r + 20 + (tick % 2) * 4}
                          fill="none" stroke="#ef4444" strokeWidth={0.5}
                          opacity={0.1} />
                      </>
                    )}
                    {selected && (
                      <circle cx={node.x} cy={node.y} r={r + 8}
                        fill="none" stroke="#60a5fa" strokeWidth={1.5}
                        strokeDasharray="4 3" opacity={0.7} />
                    )}

                    {/* Node body */}
                    {isService ? (
                      <rect
                        x={node.x - r} y={node.y - r}
                        width={r * 2} height={r * 2}
                        rx={8}
                        fill={tc.fill}
                        stroke={selected ? '#60a5fa' : tc.stroke}
                        strokeWidth={selected ? 2 : 1.5}
                        filter={isQuaran ? 'url(#glow-red)' : isService ? 'url(#glow-green)' : undefined}
                      />
                    ) : (
                      <circle
                        cx={node.x} cy={node.y} r={r}
                        fill={tc.fill}
                        stroke={selected ? '#60a5fa' : tc.stroke}
                        strokeWidth={selected ? 2 : 1.5}
                        filter={isQuaran ? 'url(#glow-red)' : undefined}
                      />
                    )}

                    {/* Service icon text placeholder (lucide can't render in SVG directly) */}
                    {isService && (
                      <text x={node.x} y={node.y - 2} textAnchor="middle" dominantBaseline="middle"
                        fill={tc.stroke} style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
                        {node.serviceIcon === 'proxy'   ? 'PX' :
                         node.serviceIcon === 'routing' ? 'RT' :
                         node.serviceIcon === 'model'   ? 'ML' : 'DB'}
                      </text>
                    )}
                    {!isService && (
                      <text x={node.x} y={node.y} textAnchor="middle" dominantBaseline="middle"
                        fill={tc.stroke} style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>
                        {node.trust_state === 'quarantined' ? '!' :
                         node.trust_state === 'restricted'  ? '~' : '●'}
                      </text>
                    )}

                    {/* Label */}
                    <text x={node.x} y={node.y + r + 14} textAnchor="middle"
                      fill="#cbd5e1" style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}>
                      {node.label}
                    </text>
                    <text x={node.x} y={node.y + r + 25} textAnchor="middle"
                      fill={tc.stroke} style={{ fontSize: 9.5, fontFamily: 'sans-serif' }}>
                      {node.sublabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend overlay */}
            <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 14, padding: '8px 12px', background: 'rgba(8,12,18,0.85)', borderRadius: 8, border: '1px solid #1e2d3d' }}>
              {[
                { color: '#22c55e', label: 'Trusted' },
                { color: '#f59e0b', label: 'Restricted' },
                { color: '#ef4444', label: 'Quarantined' },
                { color: '#334155', label: 'No traffic', dash: true },
                { color: '#f59e0b', label: 'Warning', dash: true },
                { color: '#ef4444', label: 'Critical', dash: true },
              ].map(({ color, label, dash }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {dash
                    ? <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={color} strokeWidth={2} strokeDasharray="4 2" /></svg>
                    : <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                  }
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 14, height: 14, borderRadius: 3, background: '#052e16', border: '1.5px solid #22c55e' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Service</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#052e16', border: '1.5px solid #22c55e' }} />
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Endpoint</span>
              </div>
            </div>

            {/* Zoom level badge */}
            <div style={{ position: 'absolute', top: 12, right: 12, padding: '3px 8px', background: 'rgba(8,12,18,0.85)', border: '1px solid #1e2d3d', borderRadius: 4, fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
              {Math.round(zoom * 100)}%
            </div>
          </div>

          {/* Live event ticker */}
          <div style={{ background: '#080c12', borderTop: '1px solid #1e2d3d', padding: '6px 12px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
              {TICKER_EVENTS.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: '#0f1620', borderRadius: 6, border: '1px solid #1e2d3d', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#475569' }}>{ev.time}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: `${TYPE_BADGE[ev.type]}22`, color: TYPE_BADGE[ev.type], fontFamily: 'monospace' }}>
                    {ev.type}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa' }}>{ev.endpoint}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{ev.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Detail drawer ── */}
        {selectedNode && (
          <div
            className="drawer-slide-in"
            style={{
              width: 300, minWidth: 300, borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-card)', display: 'flex', flexDirection: 'column',
              position: 'relative',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedNode.type === 'service' ? 'Service' : 'Endpoint'}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                  {selectedNode.label}
                </div>
              </div>
              <button onClick={() => { setSelectedNode(null); setIsolateConfirm(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Trust state */}
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Trust State</div>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
                  background: selectedNode.trust_state === 'active' ? 'rgba(34,197,94,0.1)' : selectedNode.trust_state === 'restricted' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                  color: TRUST_COLOR[selectedNode.trust_state].stroke,
                  fontSize: 'var(--text-sm)', fontWeight: 600, textTransform: 'capitalize',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: TRUST_COLOR[selectedNode.trust_state].stroke }} />
                  {selectedNode.trust_state}
                </div>
              </div>

              {/* Activity */}
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Activity</div>
                <div style={{ padding: '10px 14px', background: 'var(--bg-sidebar)', borderRadius: 8, fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                  {selectedNode.activity_count}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4, fontWeight: 400 }}>events</span>
                </div>
              </div>

              {/* Active connections */}
              {(() => {
                const nodeEdges = EDGES.filter(e => e.from === selectedNode.id || e.to === selectedNode.id);
                if (!nodeEdges.length) return null;
                return (
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Connections</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {nodeEdges.map(e => {
                        const other = NODES.find(n => n.id === (e.from === selectedNode.id ? e.to : e.from));
                        return (
                          <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-sidebar)', borderRadius: 6, fontSize: 12 }}>
                            <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{other?.label ?? e.to}</span>
                            <span style={{ color: THREAT_COLOR[e.threat], fontWeight: 600, fontSize: 10, textTransform: 'uppercase' }}>
                              {e.threat === 'none' ? `${e.active_streams} streams` : e.threat}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Action buttons — only for endpoints */}
              {selectedNode.type === 'endpoint' && (
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Actions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={() => handleViewImages(selectedNode)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', textAlign: 'left' }}
                    >
                      <Image size={15} style={{ color: 'var(--accent)' }} />
                      View Images from this Endpoint
                    </button>

                    <button
                      onClick={() => handleViewLogs(selectedNode)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 'var(--text-sm)', textAlign: 'left' }}
                    >
                      <FileText size={15} style={{ color: 'var(--accent)' }} />
                      View Audit Logs
                    </button>

                    <button
                      onClick={handleIsolate}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                        background: isolateConfirm ? 'rgba(239,68,68,0.15)' : 'transparent',
                        border: '1px solid #ef4444',
                        borderRadius: 8, color: '#ef4444', cursor: 'pointer',
                        fontSize: 'var(--text-sm)', textAlign: 'left',
                        transition: 'background 0.2s',
                      }}
                    >
                      <AlertTriangle size={15} />
                      {isolateConfirm ? '⚠ Confirm: Isolate Endpoint' : 'Isolate Endpoint'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .drawer-slide-in { animation: slideIn 180ms ease-out; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
    </div>
  );
}