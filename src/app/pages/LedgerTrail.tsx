import { Shield, CheckCircle, AlertTriangle, Search, Play } from 'lucide-react';
import { Card } from '../components/Card';

const ledgerEvents = [
  { index: 1247, id: 'evt-7f3a2b', type: 'InferenceEvent', producer: 'model-service', time: '14:23:45', payload: 'CALPA score: 94.2%' },
  { index: 1246, id: 'evt-8c4d3e', type: 'AlertEvent', producer: 'routing-server', time: '14:23:42', payload: 'Critical threat detected' },
  { index: 1245, id: 'evt-9d5e4f', type: 'ExtractionEvent', producer: 'proxy', time: '14:23:38', payload: 'JPEG extracted' },
  { index: 1244, id: 'evt-a6f5g7', type: 'EndpointEntity', producer: 'routing-server', time: '14:23:35', payload: 'Endpoint enrolled' },
  { index: 1243, id: 'evt-b7g6h8', type: 'ContainerLifecycleEvent', producer: 'routing-server', time: '14:23:30', payload: 'Container started' },
];

const eventTypes = [
  'All Events',
  'InferenceEvent',
  'AlertEvent',
  'ExtractionEvent',
  'EndpointEntity',
  'ContainerLifecycleEvent',
  'RoutingDecisionEvent',
];

export function LedgerTrail() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1>Ledger Trail</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          Immutable audit trail with BLAKE3 chain integrity
        </p>
      </div>

      <div
        className="flex items-center justify-between p-4 rounded-lg border"
        style={{
          background: 'var(--card-default)',
          borderColor: 'var(--status-success)'
        }}
      >
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
              Chain verified up to index #1247
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              Last checked 2 minutes ago
            </div>
          </div>
        </div>
        <Shield className="w-6 h-6" style={{ color: 'var(--status-success)' }} />
      </div>

      <Card title="Event Filters" icon={Search}>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Event Type</label>
            <select
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              {eventTypes.map(type => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Chain Index From</label>
            <input
              type="number"
              placeholder="0"
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Chain Index To</label>
            <input
              type="number"
              placeholder="Latest"
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div className="flex items-end">
            <button
              className="w-full py-2 px-4 rounded-lg"
              style={{
                background: 'var(--gradient-primary)',
                color: 'var(--bg-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500
              }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </Card>

      <Card title="Event Chain">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Index</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Event ID</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Producer</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Timestamp</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Payload</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Integrity</th>
              </tr>
            </thead>
            <tbody>
              {ledgerEvents.map((event) => (
                <tr
                  key={event.index}
                  className="cursor-pointer hover:bg-opacity-70 transition-colors"
                  style={{ borderBottom: `1px solid var(--border-subtle)` }}
                >
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    #{event.index}
                  </td>
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {event.id}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      className="px-2 py-1 rounded"
                      style={{
                        background: 'var(--border-subtle)',
                        color: 'var(--accent-secondary)',
                        fontSize: 'var(--text-xs)'
                      }}
                    >
                      {event.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {event.producer}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {event.time}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {event.payload}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <CheckCircle className="w-4 h-4 inline" style={{ color: 'var(--status-success)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Replay Panel" icon={Play}>
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>From Index</label>
            <input
              type="number"
              placeholder="0"
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>To Index</label>
            <input
              type="number"
              placeholder="Latest"
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div className="col-span-2">
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Event Type Filter</label>
            <select
              multiple
              className="w-full mt-1 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              {eventTypes.slice(1).map(type => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              className="w-full py-2 px-4 rounded-lg flex items-center justify-center gap-2"
              style={{
                background: 'var(--gradient-primary)',
                color: 'var(--bg-primary)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500
              }}
            >
              <Play className="w-4 h-4" />
              Start Replay
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
