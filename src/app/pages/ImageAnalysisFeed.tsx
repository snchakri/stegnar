import { useState } from 'react';
import { Search, Download, Eye, Filter } from 'lucide-react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';

const artifacts = [
  {
    hash: 'f2d3a8c9b1e4567f',
    endpoint: '192.168.1.45',
    timestamp: '2026-04-28 14:23:42',
    calpa: 94.2,
    entropy: 7.82,
    lsb: 0.234,
    edge: 0.67,
    byte: 0.892,
    status: 'Flagged'
  },
  {
    hash: 'a7b2c5d8e3f1234g',
    endpoint: '192.168.1.89',
    timestamp: '2026-04-28 14:19:15',
    calpa: 68.5,
    entropy: 7.45,
    lsb: 0.189,
    edge: 0.54,
    byte: 0.712,
    status: 'Suspicious'
  },
  {
    hash: 'c8d9e4f5a1b2678h',
    endpoint: '192.168.1.23',
    timestamp: '2026-04-28 14:15:03',
    calpa: 23.1,
    entropy: 6.92,
    lsb: 0.102,
    edge: 0.38,
    byte: 0.543,
    status: 'Clean'
  },
  {
    hash: 'b3c4d5e6f7a8901i',
    endpoint: '192.168.1.67',
    timestamp: '2026-04-28 14:12:28',
    calpa: 12.7,
    entropy: 6.54,
    lsb: 0.085,
    edge: 0.29,
    byte: 0.467,
    status: 'Clean'
  },
  {
    hash: 'd4e5f6a7b8c9012j',
    endpoint: '192.168.1.45',
    timestamp: '2026-04-28 14:08:51',
    calpa: 76.3,
    entropy: 7.68,
    lsb: 0.215,
    edge: 0.61,
    byte: 0.834,
    status: 'Suspicious'
  },
];

export function ImageAnalysisFeed() {
  const [selectedArtifact, setSelectedArtifact] = useState<typeof artifacts[0] | null>(null);

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1>Image Analysis Feed</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          Every artifact processed with full forensic analysis
        </p>
      </div>

      <Card title="Filters" icon={Filter}>
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Endpoint</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option>All Endpoints</option>
              <option>192.168.1.45</option>
              <option>192.168.1.89</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Status</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option>All</option>
              <option>Flagged</option>
              <option>Suspicious</option>
              <option>Clean</option>
            </select>
          </div>

          <div className="col-span-2">
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Time Range</label>
            <div className="flex gap-2 mt-1">
              <input
                type="datetime-local"
                className="flex-1 px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
              <input
                type="datetime-local"
                className="flex-1 px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>CALPA Threshold</label>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="30"
              className="w-full mt-2"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              &gt; 30%
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card title="Artifacts">
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Hash</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Endpoint</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Timestamp</th>
                    <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>CALPA</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map((artifact, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedArtifact(artifact)}
                      className="cursor-pointer hover:bg-opacity-70 transition-colors"
                      style={{
                        background: selectedArtifact === artifact ? 'var(--card-hover)' : 'transparent',
                        borderBottom: `1px solid var(--border-subtle)`
                      }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {artifact.hash}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                        {artifact.endpoint}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {artifact.timestamp}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <span
                          style={{
                            color: artifact.calpa > 70 ? 'var(--status-critical)' :
                                   artifact.calpa > 30 ? 'var(--status-warning)' :
                                   'var(--status-success)',
                            fontWeight: 600
                          }}
                        >
                          {artifact.calpa}%
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div className="flex justify-center">
                          <StatusBadge status={artifact.status} small />
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div className="flex justify-center gap-2">
                          <button className="p-1 hover:bg-blue-500/10 rounded transition-colors">
                            <Eye className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Showing 5 of 1,247 artifacts
              </div>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors hover:bg-opacity-70"
                style={{
                  background: 'var(--card-default)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </Card>
        </div>

        <div>
          {selectedArtifact ? (
            <Card title="Artifact Details">
              <div className="space-y-4">
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>SHA-256 Hash</div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'monospace',
                      marginTop: '4px',
                      wordBreak: 'break-all',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    {selectedArtifact.hash}
                  </div>
                </div>

                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '12px' }}>
                    Forensic Scores
                  </div>

                  {[
                    { label: 'Shannon Entropy', value: selectedArtifact.entropy, threshold: 7.0 },
                    { label: 'LSB Variance', value: selectedArtifact.lsb, threshold: 0.15 },
                    { label: 'Edge Density', value: selectedArtifact.edge, threshold: 0.5 },
                    { label: 'Byte Density', value: selectedArtifact.byte, threshold: 0.6 },
                  ].map((metric) => (
                    <div key={metric.label} className="mb-3">
                      <div className="flex justify-between mb-1" style={{ fontSize: 'var(--text-xs)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{metric.label}</span>
                        <span
                          style={{
                            color: metric.value > metric.threshold ? 'var(--status-critical)' : 'var(--status-success)',
                            fontWeight: 600
                          }}
                        >
                          {metric.value.toFixed(3)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-secondary)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(metric.value / (metric.label === 'Shannon Entropy' ? 8 : 1)) * 100}%`,
                            background: metric.value > metric.threshold ? 'var(--status-critical)' : 'var(--status-success)'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <button
                    className="w-full py-2 px-3 rounded-lg mb-2"
                    style={{
                      background: 'var(--gradient-primary)',
                      color: 'var(--bg-primary)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 500
                    }}
                  >
                    View in Ledger
                  </button>
                  <button
                    className="w-full py-2 px-3 rounded-lg border"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    Extract Watermark
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Artifact Details">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>
                Select an artifact to view details
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
