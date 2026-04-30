import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { TopBar } from '../components/TopBar';
import { ZoomIn, ZoomOut, Maximize, X, Image, FileText, AlertTriangle } from 'lucide-react';

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

interface NetworkEdge {
  from: string;
  to: string;
  dest_ip: string;
}

// Core services always shown — real endpoints added from API
const SERVICE_NODES = [
  { id: 'routing', label: 'routing-system', x: 420, y: 80,  color: '#22c55e' },
  { id: 'mitm',    label: 'mitm-gateway',   x: 420, y: 220, color: '#3b82f6' },
  { id: 'calpa',   label: 'calpa-model',    x: 620, y: 150, color: '#a855f7' },
];

export function TopologyPage() {
  const navigate = useNavigate();
  const [endpoints,       setEndpoints]       = useState<EndpointNode[]>([]);
  const [selectedNode,    setSelectedNode]    = useState<EndpointNode | null>(null);
  const [zoom,            setZoom]            = useState(1);
  const [isolateConfirm,  setIsolateConfirm]  = useState(false);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/endpoints')
      .then(r => r.json())
      .then((data: any[]) => {
        const nodes: EndpointNode[] = data.map((ep, i) => ({
          id:             ep.endpoint_id,
          endpoint_id:    ep.endpoint_id,
          x:              160 + (i % 3) * 220,
          y:              340 + Math.floor(i / 3) * 120,
          status:         ep.stego_count > 0 ? 'critical' : ep.images_intercepted > 10 ? 'warning' : 'healthy',
          activity_count: parseInt(ep.images_intercepted) || 0,
          ip:             ep.ip || ep.endpoint_id,
          stego_count:    parseInt(ep.stego_count) || 0,
        }));
        setEndpoints(nodes);
        setLoading(false);
      })
      .catch(() => {
        // Fallback mock if server not ready
        setEndpoints([
          { id: 'victim-a', endpoint_id: 'victim-a', x: 160, y: 340, status: 'critical', activity_count: 47, ip: '172.20.0.10', stego_count: 3 },
          { id: 'victim-b', endpoint_id: 'victim-b', x: 380, y: 340, status: 'healthy',  activity_count: 12, ip: '172.20.0.11', stego_count: 0 },
        ]);
        setLoading(false);
      });
  }, []);

  const handleIsolate = () => {
    if (!isolateConfirm) { setIsolateConfirm(true); return; }
    alert(`Isolation command sent for ${selectedNode?.endpoint_id}`);
    setIsolateConfirm(false);
    setSelectedNode(null);
  };

  const nodeColor = (status: string) =>
    status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#22c55e';

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Network Topology" />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {endpoints.length} endpoints • {endpoints.filter(e => e.stego_count > 0).length} with detections
            </div>
            <div className="flex gap-1">
              {[
                { Icon: ZoomIn,   fn: () => setZoom(z => Math.min(z+0.15, 2.2)) },
                { Icon: ZoomOut,  fn: () => setZoom(z => Math.max(z-0.15, 0.4)) },
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

            <svg viewBox="0 0 900 500" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: `scale(${zoom})`, transformOrigin: 'center', transition: 'transform 0.2s' }}>

              {/* Edges from endpoints to mitm */}
              {endpoints.map(ep => (
                <line key={ep.id} x1={ep.x} y1={ep.y} x2={420} y2={220}
                  stroke={ep.stego_count > 0 ? '#ef4444' : '#334155'}
                  strokeWidth={ep.stego_count > 0 ? 2 : 1.2}
                  strokeDasharray={ep.stego_count > 0 ? '6 3' : undefined}
                  opacity={0.7}
                />
              ))}

              {/* Service edges */}
              <line x1={420} y1={220} x2={420} y2={80}   stroke="#3b82f6" strokeWidth={1.5} opacity={0.6} />
              <line x1={420} y1={220} x2={620} y2={150}  stroke="#a855f7" strokeWidth={1.5} opacity={0.6} />

              {/* Service nodes */}
              {SERVICE_NODES.map(svc => (
                <g key={svc.id}>
                  <rect x={svc.x-32} y={svc.y-20} width={64} height={40} rx={8}
                    fill="#0f1620" stroke={svc.color} strokeWidth={1.5} />
                  <text x={svc.x} y={svc.y+4} textAnchor="middle" fill={svc.color}
                    style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>
                    {svc.id.toUpperCase().slice(0,4)}
                  </text>
                  <text x={svc.x} y={svc.y+34} textAnchor="middle" fill="#cbd5e1"
                    style={{ fontSize: 10, fontFamily: 'monospace' }}>
                    {svc.label}
                  </text>
                </g>
              ))}

              {/* Endpoint nodes */}
              {endpoints.map(ep => {
                const color = nodeColor(ep.status);
                const selected = selectedNode?.id === ep.id;
                return (
                  <g key={ep.id} onClick={() => { setSelectedNode(selected ? null : ep); setIsolateConfirm(false); }} style={{ cursor: 'pointer' }}>
                    {ep.status === 'critical' && (
                      <circle cx={ep.x} cy={ep.y} r={28} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.3} />
                    )}
                    {selected && <circle cx={ep.x} cy={ep.y} r={24} fill="none" stroke="#60a5fa" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />}
                    <circle cx={ep.x} cy={ep.y} r={18} fill="#0f1620" stroke={color} strokeWidth={selected ? 2.5 : 1.5} />
                    <text x={ep.x} y={ep.y+4} textAnchor="middle" fill={color}
                      style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 800 }}>
                      {ep.stego_count > 0 ? '!' : '●'}
                    </text>
                    <text x={ep.x} y={ep.y+32} textAnchor="middle" fill="#cbd5e1"
                      style={{ fontSize: 10, fontFamily: 'monospace' }}>
                      {ep.endpoint_id}
                    </text>
                    <text x={ep.x} y={ep.y+43} textAnchor="middle" fill={color}
                      style={{ fontSize: 9 }}>
                      {ep.status}
                    </text>
                  </g>
                );
              })}

              {loading && (
                <text x={450} y={250} textAnchor="middle" fill="#475569" style={{ fontSize: 14 }}>
                  Loading endpoint data…
                </text>
              )}
            </svg>

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 14, padding: '8px 12px', background: 'rgba(8,12,18,0.85)', borderRadius: 8, border: '1px solid #1e2d3d' }}>
              {[['#22c55e','Clean'], ['#f59e0b','Warning'], ['#ef4444','STEGO Detected']].map(([color, label]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Event ticker */}
          <div style={{ background: '#080c12', borderTop: '1px solid #1e2d3d', padding: '6px 12px' }}>
            <div style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
              Live — watching for STEGO events on stegnar-net
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
                { label: 'Status',          value: selectedNode.status,         color: nodeColor(selectedNode.status) },
                { label: 'IP Address',      value: selectedNode.ip,             color: 'var(--text-primary)' },
                { label: 'Images Captured', value: String(selectedNode.activity_count), color: 'var(--accent)' },
                { label: 'STEGO Detected',  value: String(selectedNode.stego_count),    color: selectedNode.stego_count > 0 ? '#ef4444' : '#22c55e' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-sidebar)', borderRadius: 6, fontSize: 14, fontWeight: 600, color, fontFamily: 'monospace' }}>{value}</div>
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.05em' }}>Actions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => navigate(`/images?endpoint=${selectedNode.endpoint_id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                    <Image size={14} style={{ color: 'var(--accent)' }} /> View Images
                  </button>
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