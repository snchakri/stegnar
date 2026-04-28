import { Database, Search, Download, Table } from 'lucide-react';
import { Card } from '../components/Card';
import { useState } from 'react';

const tables = [
  { name: 'endpoints', rows: 147, lastWrite: '2m ago' },
  { name: 'artifacts', rows: 1247, lastWrite: '15s ago' },
  { name: 'inference_events', rows: 1189, lastWrite: '18s ago' },
  { name: 'alert_events', rows: 47, lastWrite: '2m ago' },
  { name: 'soc_action_events', rows: 23, lastWrite: '15m ago' },
  { name: 'container_lifecycle_events', rows: 342, lastWrite: '5m ago' },
  { name: 'ledger_nodes', rows: 1247, lastWrite: '15s ago' },
];

const sampleData = [
  { id: 1, endpoint_id: '192.168.1.45', confidence: 94.2, status: 'flagged', timestamp: '14:23:42' },
  { id: 2, endpoint_id: '192.168.1.89', confidence: 68.5, status: 'suspicious', timestamp: '14:19:15' },
  { id: 3, endpoint_id: '192.168.1.23', confidence: 23.1, status: 'clean', timestamp: '14:15:03' },
  { id: 4, endpoint_id: '192.168.1.67', confidence: 12.7, status: 'clean', timestamp: '14:12:28' },
];

export function DatabaseView() {
  const [selectedTable, setSelectedTable] = useState('artifacts');

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1>Database View</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          Live read access to PostgreSQL tables
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div>
          <Card title="Tables" icon={Table}>
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className="w-full text-left p-2 rounded transition-colors"
                  style={{
                    background: selectedTable === table.name ? 'var(--card-hover)' : 'transparent',
                    border: selectedTable === table.name ? '1px solid var(--border-strong)' : '1px solid transparent'
                  }}
                >
                  <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace' }}>
                    {table.name}
                  </div>
                  <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span>{table.rows} rows</span>
                    <span>{table.lastWrite}</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <Card title="Table Stats" className="mt-4">
            <div className="space-y-2" style={{ fontSize: 'var(--text-sm)' }}>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Rows</span>
                <span>1,247</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Size on disk</span>
                <span>34.2 MB</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Index hit rate</span>
                <span style={{ color: 'var(--status-success)' }}>98.3%</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>Last write</span>
                <span>15s ago</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="col-span-3 space-y-4">
          <Card title="Query Builder" icon={Search}>
            <div className="grid grid-cols-4 gap-3">
              <select
                className="px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                <option>confidence</option>
                <option>endpoint_id</option>
                <option>status</option>
                <option>timestamp</option>
              </select>

              <select
                className="px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              >
                <option>=</option>
                <option>&gt;</option>
                <option>&lt;</option>
                <option>LIKE</option>
                <option>IN</option>
              </select>

              <input
                type="text"
                placeholder="Value"
                className="px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />

              <button
                className="py-2 px-4 rounded-lg"
                style={{
                  background: 'var(--gradient-primary)',
                  color: 'var(--bg-primary)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500
                }}
              >
                Query
              </button>
            </div>
          </Card>

          <Card title={`Table: ${selectedTable}`} icon={Database}>
            <div className="overflow-x-auto">
              <table className="w-full" style={{ fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>ID</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Endpoint ID</th>
                    <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Confidence</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleData.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-opacity-70 transition-colors"
                      style={{ borderBottom: `1px solid var(--border-subtle)` }}
                    >
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {row.id}
                      </td>
                      <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                        {row.endpoint_id}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <span
                          style={{
                            color: row.confidence > 70 ? 'var(--status-critical)' :
                                   row.confidence > 30 ? 'var(--status-warning)' :
                                   'var(--status-success)',
                            fontWeight: 600
                          }}
                        >
                          {row.confidence}%
                        </span>
                      </td>
                      <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                        {row.status}
                      </td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                        {row.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                Showing 4 of 1,247 rows
              </div>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{
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
      </div>
    </div>
  );
}
