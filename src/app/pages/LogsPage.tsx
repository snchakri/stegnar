import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Search, X } from 'lucide-react';

interface AuditLog {
  log_id: string;
  timestamp: string;
  component: string;
  action: string;
  details: any;
}

const logs: AuditLog[] = [
  {
    log_id: 'log_001',
    timestamp: '2024-04-28 14:23:45',
    component: 'proxy',
    action: 'image_extracted',
    details: { session_id: 'sess_a7f3e9b2', format: 'JPEG', size_bytes: 245872 }
  },
  {
    log_id: 'log_002',
    timestamp: '2024-04-28 14:23:42',
    component: 'model-service',
    action: 'inference_completed',
    details: { calpa_score: 94.2, confidence: 'HIGH', flagged: true }
  },
  {
    log_id: 'log_003',
    timestamp: '2024-04-28 14:23:38',
    component: 'routing-server',
    action: 'alert_raised',
    details: { endpoint_id: 'ep_192.168.1.45', severity: 'critical', reason: 'high_calpa_score' }
  },
  {
    log_id: 'log_004',
    timestamp: '2024-04-28 14:23:35',
    component: 'data-ledger',
    action: 'event_written',
    details: { event_type: 'AlertEvent', chain_index: 1247, digest: 'blake3_...' }
  },
  {
    log_id: 'log_005',
    timestamp: '2024-04-28 14:23:30',
    component: 'routing-server',
    action: 'container_started',
    details: { slot_id: 'slot-03', job_id: 'job-a7f3e9', profile: 'CALPA-v2' }
  },
  {
    log_id: 'log_006',
    timestamp: '2024-04-28 14:23:25',
    component: 'proxy',
    action: 'stream_opened',
    details: { endpoint_id: 'ep_192.168.1.45', dest_ip: '93.184.216.34', port: 443 }
  },
  {
    log_id: 'log_007',
    timestamp: '2024-04-28 14:23:20',
    component: 'data-ledger',
    action: 'integrity_check',
    details: { verified_up_to: 1246, tampering_detected: false }
  },
];

export function LogsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [componentFilter, setComponentFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [loading, setLoading] = useState(false);

  const components = Array.from(new Set(logs.map(l => l.component)));

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery === '' ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());
    const matchesComponent = componentFilter === 'all' || log.component === componentFilter;
    const matchesDateFrom = !dateFrom || log.timestamp >= dateFrom;
    const matchesDateTo = !dateTo || log.timestamp <= dateTo;
    return matchesSearch && matchesComponent && matchesDateFrom && matchesDateTo;
  });

  return (
    <div className="h-full flex flex-col">
      <TopBar title="System Audit Logs" />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
            <div className="w-full sm:flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <select
              value={componentFilter}
              onChange={(e) => setComponentFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option value="all">All Components</option>
              {components.map(comp => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="From"
              className="w-full sm:w-auto px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />

            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="To"
              className="w-full sm:w-auto px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-6">
            <div
              className="rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              {loading ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  Loading...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  No logs found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          Timestamp
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          Component
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          Action
                        </th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log, index) => (
                        <tr
                          key={index}
                          onClick={() => setSelectedLog(log)}
                          className="cursor-pointer transition-colors table-row-hover"
                          style={{
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)',
                            borderBottom: '1px solid var(--border-subtle)'
                          }}
                        >
                          <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {log.timestamp}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            <span
                              className="px-2 py-1 rounded"
                              style={{
                                background: 'var(--bg-sidebar)',
                                color: 'var(--accent)',
                                fontSize: 'var(--text-xs)',
                                fontFamily: 'monospace'
                              }}
                            >
                              {log.component}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {log.action}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: 'var(--text-xs)',
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-sidebar)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                maxWidth: '400px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'inline-block'
                              }}
                            >
                              {JSON.stringify(log.details).substring(0, 60)}...
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedLog && (
          <div
            className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Log Details
              </h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded hover:bg-opacity-70 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <pre
                style={{
                  fontFamily: 'monospace',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-sidebar)',
                  padding: '16px',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .table-row-hover:hover {
          background: var(--bg-hover) !important;
        }

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
