import { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, Eye } from 'lucide-react';
import { Card } from '../components/Card';

const nodes = [
  { id: 'proxy', type: 'service', x: 400, y: 100, status: 'ActiveTrusted' },
  { id: 'routing', type: 'service', x: 400, y: 300, status: 'ActiveTrusted' },
  { id: 'model', type: 'service', x: 600, y: 200, status: 'ActiveTrusted' },
  { id: '192.168.1.45', type: 'endpoint', x: 200, y: 150, status: 'Quarantined' },
  { id: '192.168.1.89', type: 'endpoint', x: 150, y: 300, status: 'ActiveTrusted' },
  { id: '192.168.1.23', type: 'endpoint', x: 250, y: 450, status: 'ActiveRestricted' },
  { id: '192.168.1.67', type: 'endpoint', x: 600, y: 400, status: 'ActiveTrusted' },
];

const edges = [
  { from: '192.168.1.45', to: 'proxy', threat: 'HIGH', streams: 3 },
  { from: '192.168.1.89', to: 'proxy', threat: 'LOW', streams: 1 },
  { from: '192.168.1.23', to: 'proxy', threat: 'MEDIUM', streams: 2 },
  { from: 'proxy', to: 'routing', threat: 'LOW', streams: 6 },
  { from: 'routing', to: 'model', threat: 'LOW', streams: 4 },
];

const recentEvents = [
  { time: '14:23:45', type: 'IMAGE_EXTRACTED', endpoint: '192.168.1.45', desc: 'JPEG extracted from stream' },
  { time: '14:23:42', type: 'ALERT_RAISED', endpoint: '192.168.1.45', desc: 'High confidence detection' },
  { time: '14:23:38', type: 'STREAM_OPENED', endpoint: '192.168.1.89', desc: 'New HTTP/2 stream' },
  { time: '14:23:35', type: 'ENDPOINT_ENROLLED', endpoint: '192.168.1.67', desc: 'Device enrolled successfully' },
];

export function LanTopology() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const selected = nodes.find(n => n.id === selectedNode);

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1>LAN Topology</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            Live network graph of all endpoints and service mesh
          </p>
        </div>

        <div className="flex gap-2">
          <button className="icon-btn">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button className="icon-btn">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button className="icon-btn">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card title="Network Graph" icon={Eye}>
            <div className="relative" style={{ height: '500px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
              <svg width="100%" height="100%">
                {edges.map((edge, i) => {
                  const from = nodes.find(n => n.id === edge.from);
                  const to = nodes.find(n => n.id === edge.to);
                  if (!from || !to) return null;

                  const strokeColor = edge.threat === 'HIGH' ? 'var(--status-critical)' :
                                    edge.threat === 'MEDIUM' ? 'var(--status-warning)' :
                                    'var(--border-strong)';

                  return (
                    <line
                      key={i}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={strokeColor}
                      strokeWidth={edge.threat === 'HIGH' ? 2 : 1}
                      strokeDasharray={edge.threat === 'HIGH' ? '5,5' : undefined}
                    />
                  );
                })}

                {nodes.map((node) => {
                  const fillColor = node.status === 'Quarantined' ? 'var(--status-critical)' :
                                  node.status === 'ActiveRestricted' ? 'var(--status-warning)' :
                                  node.type === 'service' ? 'var(--accent-primary)' :
                                  'var(--status-success)';

                  return (
                    <g key={node.id} onClick={() => setSelectedNode(node.id)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={node.type === 'service' ? 16 : 12}
                        fill={fillColor}
                        stroke={selectedNode === node.id ? 'var(--accent-secondary)' : 'transparent'}
                        strokeWidth={selectedNode === node.id ? 3 : 0}
                      />
                      {node.status === 'Quarantined' && (
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r={20}
                          fill="none"
                          stroke="var(--status-critical)"
                          strokeWidth={2}
                          opacity={0.6}
                          style={{ animation: 'pulse-subtle 2s infinite' }}
                        />
                      )}
                      <text
                        x={node.x}
                        y={node.y + 25}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        style={{ fontSize: '11px', fontWeight: 500 }}
                      >
                        {node.id}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="absolute top-3 left-3 flex gap-3" style={{ fontSize: 'var(--text-xs)' }}>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'var(--status-success)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Trusted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'var(--status-warning)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Restricted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: 'var(--status-critical)' }} />
                  <span style={{ color: 'var(--text-muted)' }}>Quarantined</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedNode ? (
            <Card title="Node Details">
              <div className="space-y-3">
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Node ID</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace', marginTop: '2px' }}>
                    {selected?.id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Type</div>
                  <div style={{ fontSize: 'var(--text-sm)', marginTop: '2px', textTransform: 'capitalize' }}>
                    {selected?.type}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Trust State</div>
                  <div style={{ fontSize: 'var(--text-sm)', marginTop: '2px' }}>
                    {selected?.status}
                  </div>
                </div>
                {selected?.type === 'endpoint' && (
                  <>
                    <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                      <button
                        className="w-full py-2 px-3 rounded-lg transition-colors"
                        style={{
                          background: 'var(--gradient-primary)',
                          color: 'var(--bg-primary)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500
                        }}
                      >
                        View Image History
                      </button>
                    </div>
                    <button
                      className="w-full py-2 px-3 rounded-lg border transition-colors hover:bg-red-500/10"
                      style={{
                        borderColor: 'var(--status-critical)',
                        color: 'var(--status-critical)',
                        fontSize: 'var(--text-sm)'
                      }}
                    >
                      Isolate Endpoint
                    </button>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <Card title="Node Details">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
                Select a node to view details
              </p>
            </Card>
          )}
        </div>
      </div>

      <Card title="Live Event Ticker">
        <div className="space-y-1">
          {recentEvents.map((event, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-2 rounded hover:bg-opacity-70 transition-colors"
              style={{ background: 'var(--bg-secondary)', fontSize: 'var(--text-sm)' }}
            >
              <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', minWidth: '70px' }}>
                {event.time}
              </span>
              <span
                className="px-2 py-0.5 rounded"
                style={{
                  background: 'var(--border-subtle)',
                  color: 'var(--accent-secondary)',
                  fontSize: 'var(--text-xs)',
                  fontFamily: 'monospace'
                }}
              >
                {event.type}
              </span>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                {event.endpoint}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>
                {event.desc}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <style>{`
        .icon-btn {
          padding: 8px;
          background: var(--card-default);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          color: var(--text-secondary);
          transition: all 150ms ease;
        }
        .icon-btn:hover {
          background: var(--card-hover);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
