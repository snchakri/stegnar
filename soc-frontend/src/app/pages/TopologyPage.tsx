import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { TopBar } from '../components/TopBar';
import { apiUrl } from '../../lib/config';
import { initWebSocket } from '../../lib/websocket';
import { ZoomIn, ZoomOut, Maximize, X, FileText, AlertTriangle, RefreshCw } from 'lucide-react';

interface EndpointNode {
  id: string;
  endpoint_id: string;
  x: number;
  y: number;
  status: 'healthy' | 'warning' | 'critical';
  activity_count: number;
  ip: string;
  stego_count: number;
}

// Core service nodes — always shown
const SERVICE_NODES = [
  { id: 'routing', label: 'routing-system', x: 450, y: 60,  color: '#22c55e' },
  { id: 'mitm',    label: 'mitm-gateway',   x: 450, y: 200, color: '#3b82f6' },
  { id: 'calpa',   label: 'calpa-model',    x: 650, y: 130, color: '#a855f7' },
];

function layoutEndpoints(endpoints: EndpointNode[]): EndpointNode[] {
  const perRow = 6;
  return endpoints.map((ep, i) => ({
    ...ep,
    x: 80 + (i % perRow) * 160,
    y: 360 + Math.floor(i / perRow) * 130,
  }));
}

function computeStatus(stegoCount: number): 'healthy' | 'warning' | 'critical' {
  if (stegoCount > 3) return 'critical';
  if (stegoCount > 0) return 'warning';
  return 'healthy';
}

export function TopologyPage() {
  const navigate = useNavigate();
  const [endpoints,      setEndpoints]      = useState<EndpointNode[]>([]);
  const [selectedNode,   setSelectedNode]   = useState<EndpointNode | null>(null);
  const [zoom,           setZoom]           = useState(1);
  const [isolateConfirm, setIsolateConfirm] = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [lastUpdated,    setLastUpdated]    = useState<Date | null>(null);

  const endpointsRef = useRef(endpoints);
  endpointsRef.current = endpoints;

  const fetchEndpoints = () => {
    fetch(apiUrl('/endpoints'))
      .then(r => r.json())
      .then((data: any[]) => {
        const nodes: EndpointNode[] = data.map((ep, i) => ({
          id:             ep.endpoint_id,
          endpoint_id:    ep.endpoint_id,
          x:              0, // layout applied below
          y:              0,
          status:         computeStatus(parseInt(ep.stego_count) || 0),
          activity_count: parseInt(ep.images_intercepted) || 0,
          ip:             ep.ip || ep.endpoint_id,
          stego_count:    parseInt(ep.stego_count) || 0,
        }));
        setEndpoints(layoutEndpoints(nodes));
        setLastUpdated(new Date());
        setLoading(false);
      })
      .catch(() => {
        // show empty state — no mock data
        setEndpoints([]);
        setLoading(false);
      });
  };

  // Initial fetch + polling
  useEffect(() => {
    fetchEndpoints();
    const iv = setInterval(fetchEndpoints, 5000);
    return () => clearInterval(iv);
  }, []);

  // WebSocket listener — update node color when a new event arrives
  useEffect(() => {
    const unsubscribe = initWebSocket((img: any) => {
      const epId = img.endpoint_id;
      if (!epId) return;
      setEndpoints(prev => prev.map(ep => {
        if (ep.endpoint_id !== epId) return ep;
        const newStego = img.classification === 'malicious' ? ep.stego_count + 1 : ep.stego_count;
        return {
          ...ep,
          stego_count:    newStego,
          activity_count: ep.activity_count + 1,
          status:         computeStatus(newStego),
        };
      }));
    });
    return () => unsubscribe();
  }, []);

  const handleIsolate = () => {
    if (!isolateConfirm) { setIsolateConfirm(true); return; }
    alert(`Isolation command sent for ${selectedNode?.endpoint_id}`);
    setIsolateConfirm(false);
    setSelectedNode(null);
  };

  const nodeColor = (status: string) =>
    status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#22c55e';

  // viewBox height adapts to number of rows of endpoints
  const rows = Math.max(1, Math.ceil(endpoints.length / 6));
  const svgHeight = 300 + rows * 130 + 60;

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Network Topology" />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {endpoints.length} endpoints • {endpoints.filter(e => e.stego_count > 0).length} with detections
              {lastUpdated && (
                <span style={{ marginLeft: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                  updated {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <button onClick={fetchEndpoints} style={{ padding: 7, borderRadius: 6, background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                <RefreshCw size={14} style={{ color: 'var(--text-secondary)', display: 'block' }} />
              </button>
              {[
                { Icon: ZoomIn,   fn: () => setZoom(z => Math.min(z + 0.15, 2.2)) },
                { Icon: ZoomOut,  fn: () => setZoom(z => Math.max(z - 0.15, 0.4)) },
                { Icon: Maximize, fn: () => setZoom(1) },
              ].map(({ Icon, fn }, i) => (
                <button key={i} onClick={fn} style={{ padding: 7, borderRadius: 6, background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)', cursor: 'pointer' }}>
                  <Icon size={15} style={{ color: 'var(--text-secondary)', display: 'block' }} />
                </button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#080c12' }}>
            {/* Dot grid */}
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15 }}>
              <defs><pattern id="dot" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.5" fill="#94a3b8" /></pattern></defs>
              <rect width="100%" height="100%" fill="url(#dot)" />
            </svg>

            <svg
              viewBox={`0 0 1000 ${svgHeight}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: `scale(${zoom})`, transformOrigin: 'center top', transition: 'transform 0.2s' }}
            >
              {/* Edges from endpoints → routing (not MITM, per architecture) */}
              {endpoints.map(ep => (
                <line key={ep.id + '-edge'}
                  x1={ep.x} y1={ep.y}
                  x2={SERVICE_NODES[0].x} y2={SERVICE_NODES[0].y}
                  stroke={ep.stego_count > 0 ? '#ef4444' : ep.status === 'warning' ? '#f59e0b55' : '#334155'}
                  strokeWidth={ep.stego_count > 0 ? 2 : 1}
                  strokeDasharray={ep.stego_count > 0 ? '6 3' : undefined}
                  opacity={0.65}
                />
              ))}

              {/* Internal service edges */}
              {/* routing → mitm */}
              <line x1={SERVICE_NODES[0].x} y1={SERVICE_NODES[0].y} x2={SERVICE_NODES[1].x} y2={SERVICE_NODES[1].y} stroke="#3b82f6" strokeWidth={1.5} opacity={0.6} />
              {/* mitm → calpa */}
              <line x1={SERVICE_NODES[1].x} y1={SERVICE_NODES[1].y} x2={SERVICE_NODES[2].x} y2={SERVICE_NODES[2].y} stroke="#a855f7" strokeWidth={1.5} opacity={0.6} />

              {/* Service nodes */}
              {SERVICE_NODES.map(svc => (
                <g key={svc.id}>
                  <rect x={svc.x - 52} y={svc.y - 22} width={104} height={44} rx={8} fill="#0f1620" stroke={svc.color} strokeWidth={1.5} />
                  <text x={svc.x} y={svc.y + 5} textAnchor="middle" fill={svc.color}
                    style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700 }}>
                    {svc.id.toUpperCase()}
                  </text>
                  <text x={svc.x} y={svc.y + 38} textAnchor="middle" fill="#cbd5e1"
                    style={{ fontSize: 9, fontFamily: 'monospace' }}>
                    {svc.label}
                  </text>
                </g>
              ))}

              {/* Endpoint nodes */}
              {endpoints.map(ep => {
                const color   = nodeColor(ep.status);
                const sel     = selectedNode?.id === ep.id;
                const pulse   = ep.status === 'critical';
                return (
                  <g key={ep.id} onClick={() => { setSelectedNode(sel ? null : ep); setIsolateConfirm(false); }} style={{ cursor: 'pointer' }}>
                    {pulse && <circle cx={ep.x} cy={ep.y} r={30} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.25} />}
                    {sel   && <circle cx={ep.x} cy={ep.y} r={24} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />}
                    <circle cx={ep.x} cy={ep.y} r={18} fill="#0f1620" stroke={color} strokeWidth={sel ? 2.5 : 1.5} />
                    <text x={ep.x} y={ep.y + 5} textAnchor="middle" fill={color}
                      style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 800 }}>
                      {ep.stego_count > 0 ? '!' : '●'}
                    </text>
                    <text x={ep.x} y={ep.y + 34} textAnchor="middle" fill="#cbd5e1"
                      style={{ fontSize: 9, fontFamily: 'monospace' }}>
                      {ep.endpoint_id.replace('node-', 'N')}
                    </text>
                    <text x={ep.x} y={ep.y + 44} textAnchor="middle" fill={color}
                      style={{ fontSize: 8 }}>
                      {ep.status}
                    </text>
                  </g>
                );
              })}

              {/* Empty state */}
              {!loading && endpoints.length === 0 && (
                <text x={500} y={350} textAnchor="middle" fill="#475569" style={{ fontSize: 14 }}>
                  No endpoints connected yet — waiting for agents…
                </text>
              )}
              {loading && (
                <text x={500} y={350} textAnchor="middle" fill="#475569" style={{ fontSize: 14 }}>
                  Loading endpoint data…
                </text>
              )}
            </svg>

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 14, padding: '8px 12px', background: 'rgba(8,12,18,0.85)', borderRadius: 8, border: '1px solid #1e2d3d' }}>
              {[['#22c55e', 'Clean'], ['#f59e0b', 'Warning'], ['#ef4444', 'STEGO Detected']].map(([color, label]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status bar */}
          <div style={{ background: '#080c12', borderTop: '1px solid #1e2d3d', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
              Live · polling every 5s · WebSocket active
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Clean', count: endpoints.filter(e => e.status === 'healthy').length, color: '#22c55e' },
                { label: 'Warning', count: endpoints.filter(e => e.status === 'warning').length, color: '#f59e0b' },
                { label: 'STEGO', count: endpoints.filter(e => e.status === 'critical').length, color: '#ef4444' },
              ].map(s => (
                <span key={s.label} style={{ fontSize: 11, color: s.color, fontFamily: 'monospace' }}>
                  {s.label}: {s.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Drawer */}
        {selectedNode && (
          <div className="drawer-slide-in" style={{ width: 300, minWidth: 300, borderLeft: '1px solid var(--border-default)', background: 'var(--bg-card)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Endpoint</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>{selectedNode.endpoint_id}</div>
              </div>
              <button onClick={() => { setSelectedNode(null); setIsolateConfirm(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Status',          value: selectedNode.status,                  color: nodeColor(selectedNode.status) },
                { label: 'IP Address',      value: selectedNode.ip,                      color: 'var(--text-primary)' },
                { label: 'Events Captured', value: String(selectedNode.activity_count),  color: 'var(--accent)' },
                { label: 'STEGO Detected',  value: String(selectedNode.stego_count),     color: selectedNode.stego_count > 0 ? '#ef4444' : '#22c55e' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-sidebar)', borderRadius: 6, fontSize: 14, fontWeight: 600, color, fontFamily: 'monospace' }}>{value}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => navigate(`/logs?component=${selectedNode.endpoint_id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                    <FileText size={14} style={{ color: 'var(--accent)' }} /> View Logs
                  </button>
                  <button onClick={handleIsolate}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: isolateConfirm ? 'rgba(239,68,68,0.15)' : 'transparent', border: '1px solid #ef4444', borderRadius: 8, color: '#ef4444', cursor: 'pointer', fontSize: 13 }}>
                    <AlertTriangle size={14} /> {isolateConfirm ? 'Confirm Isolate' : 'Isolate Endpoint'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .drawer-slide-in { animation: slideIn 180ms ease-out; }
        @keyframes slideIn { from{transform:translateX(100%);opacity:0;} to{transform:translateX(0);opacity:1;} }
      `}</style>
    </div>
  );
}