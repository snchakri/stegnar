import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { ZoomIn, ZoomOut, Maximize, X, Image, FileText } from 'lucide-react';

interface NetworkNode {
  id: string;
  endpoint_id: string;
  x: number;
  y: number;
  status: 'healthy' | 'warning' | 'critical';
  activity_count: number;
}

interface NetworkEdge {
  from: string;
  to: string;
  dest_ip: string;
}

const nodes: NetworkNode[] = [
  { id: '1', endpoint_id: 'ep_192.168.1.45', x: 200, y: 200, status: 'critical', activity_count: 124 },
  { id: '2', endpoint_id: 'ep_192.168.1.89', x: 400, y: 150, status: 'warning', activity_count: 67 },
  { id: '3', endpoint_id: 'ep_192.168.1.23', x: 350, y: 350, status: 'healthy', activity_count: 23 },
  { id: '4', endpoint_id: 'ep_192.168.1.67', x: 550, y: 250, status: 'warning', activity_count: 89 },
];

const edges: NetworkEdge[] = [
  { from: '1', to: '2', dest_ip: '93.184.216.34' },
  { from: '1', to: '3', dest_ip: '151.101.65.69' },
  { from: '2', to: '4', dest_ip: '104.16.123.96' },
  { from: '3', to: '4', dest_ip: '172.217.14.206' },
];

export function TopologyPage() {
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.2, 2));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.2, 0.5));
  const handleResetZoom = () => setZoom(1);

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Network Topology" />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {nodes.length} endpoints • {edges.length} connections
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleZoomIn}
                className="p-2 rounded-lg border transition-colors hover:bg-opacity-80"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)'
                }}
              >
                <ZoomIn className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-2 rounded-lg border transition-colors hover:bg-opacity-80"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)'
                }}
              >
                <ZoomOut className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button
                onClick={handleResetZoom}
                className="p-2 rounded-lg border transition-colors hover:bg-opacity-80"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)'
                }}
              >
                <Maximize className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-6">
            <div
              className="rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                height: '600px',
                position: 'relative'
              }}
            >
              <svg
                width="100%"
                height="100%"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center',
                  transition: 'transform 200ms ease'
                }}
              >
                {edges.map((edge, i) => {
                  const from = nodes.find(n => n.id === edge.from);
                  const to = nodes.find(n => n.id === edge.to);
                  if (!from || !to) return null;

                  return (
                    <line
                      key={i}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="var(--border-strong)"
                      strokeWidth={2}
                    />
                  );
                })}

                {nodes.map((node) => {
                  const nodeColor = node.status === 'healthy'
                    ? 'var(--status-success)'
                    : node.status === 'warning'
                    ? 'var(--status-warning)'
                    : 'var(--status-error)';
                  const nodeRadius = 15 + (node.activity_count / 10);

                  return (
                    <g key={node.id} onClick={() => setSelectedNode(node)} style={{ cursor: 'pointer' }}>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={nodeRadius}
                        fill={nodeColor}
                        opacity={0.8}
                        stroke={selectedNode?.id === node.id ? nodeColor : 'transparent'}
                        strokeWidth={selectedNode?.id === node.id ? 4 : 0}
                      />
                      <text
                        x={node.x}
                        y={node.y + nodeRadius + 18}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        style={{ fontSize: '12px', fontFamily: 'monospace' }}
                      >
                        {node.endpoint_id.split('_')[1]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>

        {selectedNode && (
          <div
            className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-80 border-l flex flex-col drawer-slide-in z-30"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Endpoint Details
              </h3>
              <button onClick={() => setSelectedNode(null)} className="p-1 rounded hover:bg-opacity-70 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Endpoint ID
                </div>
                <div
                  className="p-2 rounded"
                  style={{
                    background: 'var(--bg-sidebar)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace'
                  }}
                >
                  {selectedNode.endpoint_id}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Status
                </div>
                <div
                  className="p-2 rounded inline-flex items-center gap-2"
                  style={{
                    background: selectedNode.status === 'healthy'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : selectedNode.status === 'warning'
                      ? 'rgba(245, 158, 11, 0.1)'
                      : 'rgba(239, 68, 68, 0.1)',
                    color: selectedNode.status === 'healthy'
                      ? 'var(--status-success)'
                      : selectedNode.status === 'warning'
                      ? 'var(--status-warning)'
                      : 'var(--status-error)',
                    fontSize: 'var(--text-sm)',
                    textTransform: 'capitalize'
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: selectedNode.status === 'healthy'
                        ? 'var(--status-success)'
                        : selectedNode.status === 'warning'
                        ? 'var(--status-warning)'
                        : 'var(--status-error)'
                    }}
                  />
                  {selectedNode.status}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Activity Count
                </div>
                <div
                  className="p-2 rounded"
                  style={{
                    background: 'var(--bg-sidebar)',
                    fontSize: 'var(--text-xl)',
                    color: 'var(--accent)',
                    fontWeight: 600
                  }}
                >
                  {selectedNode.activity_count} events
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Recent Connections
                </div>
                <div className="space-y-2">
                  {edges
                    .filter(e => e.from === selectedNode.id)
                    .map((edge, i) => (
                      <div
                        key={i}
                        className="p-2 rounded"
                        style={{
                          background: 'var(--bg-sidebar)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace'
                        }}
                      >
                        → {edge.dest_ip}
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Actions
                </div>
                <div className="space-y-2">
                  <button
                    className="w-full p-3 rounded-lg border transition-colors hover:bg-opacity-80 flex items-center gap-2"
                    style={{
                      background: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <Image className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>View Images from this Endpoint</span>
                  </button>
                  <button
                    className="w-full p-3 rounded-lg border transition-colors hover:bg-opacity-80 flex items-center gap-2"
                    style={{
                      background: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>View Logs</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .drawer-slide-in {
          animation: slideIn 200ms ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
