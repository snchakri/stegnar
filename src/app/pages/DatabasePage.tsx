import { useState, useEffect, useRef } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, X, Columns, Loader2 } from 'lucide-react';
import { TopBar } from '../components/TopBar';

const tables = [
  { name: 'global_image_ledger', rows: 1247, lastUpdated: '15s ago' },
  { name: 'endpoint_network_activity', rows: 45632, lastUpdated: '5s ago' },
  { name: 'system_audit_log', rows: 234567, lastUpdated: '10s ago' },
];

const tableData: Record<string, any[]> = {
  global_image_ledger: [
    {
      sha256_hash: 'f2d3a8c9b1e4567f8932abcd1234ef56a789b012c345d678e901f234a567b890',
      calpa_score: 94.2,
      classification: 'malicious',
      first_seen_ts: '2024-04-28 14:23:45',
      minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_f2d3a8c9.jpg'
    },
    {
      sha256_hash: 'a7b2c5d8e3f1234g5678h901i234j567k890l123m456n789o012p345q678r901',
      calpa_score: 68.5,
      classification: 'suspicious',
      first_seen_ts: '2024-04-28 14:19:15',
      minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_a7b2c5d8.png'
    },
    {
      sha256_hash: 'c8d9e4f5a1b2678h3456i789j012k345l678m901n234o567p890q123r456s789',
      calpa_score: 23.1,
      classification: 'benign',
      first_seen_ts: '2024-04-28 14:15:03',
      minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_c8d9e4f5.jpg'
    },
    {
      sha256_hash: 'b3c4d5e6f7a8901i2345j678k901l234m567n890o123p456q789r012s345t678',
      calpa_score: 12.7,
      classification: 'benign',
      first_seen_ts: '2024-04-28 14:12:28',
      minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_b3c4d5e6.png'
    },
    {
      sha256_hash: 'd4e5f6a7b8c9012j3456k789l012m345n678o901p234q567r890s123t456u789',
      calpa_score: 76.3,
      classification: 'suspicious',
      first_seen_ts: '2024-04-28 14:08:51',
      minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_d4e5f6a7.jpg'
    },
  ],
  endpoint_network_activity: [
    {
      activity_id: 'act_001',
      timestamp: '2024-04-28 14:23:45',
      endpoint_id: 'ep_192.168.1.45',
      dest_ip: '93.184.216.34',
      session_id: 'sess_a7f3e9b2',
      sha256_hash: 'f2d3a8c9b1e4567f8932abcd1234ef56a789b012c345d678e901f234a567b890',
      minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-23-45.pcap'
    },
    {
      activity_id: 'act_002',
      timestamp: '2024-04-28 14:19:15',
      endpoint_id: 'ep_192.168.1.89',
      dest_ip: '151.101.65.69',
      session_id: 'sess_c8f1a2d3',
      sha256_hash: 'a7b2c5d8e3f1234g5678h901i234j567k890l123m456n789o012p345q678r901',
      minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-19-15.pcap'
    },
    {
      activity_id: 'act_003',
      timestamp: '2024-04-28 14:15:03',
      endpoint_id: 'ep_192.168.1.23',
      dest_ip: '104.16.123.96',
      session_id: 'sess_b2c4d5e6',
      sha256_hash: 'c8d9e4f5a1b2678h3456i789j012k345l678m901n234o567p890q123r456s789',
      minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-15-03.pcap'
    },
    {
      activity_id: 'act_004',
      timestamp: '2024-04-28 14:12:28',
      endpoint_id: 'ep_192.168.1.45',
      dest_ip: '172.217.14.206',
      session_id: 'sess_d3e5f7a8',
      sha256_hash: 'b3c4d5e6f7a8901i2345j678k901l234m567n890o123p456q789r012s345t678',
      minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-12-28.pcap'
    },
  ],
  system_audit_log: [
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
  ],
};

export function DatabasePage() {
  const [selectedTable, setSelectedTable] = useState('global_image_ledger');
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // Filters for global_image_ledger
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [calpaScoreRange, setCalpaScoreRange] = useState<[number, number]>([0, 100]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const rowsPerPage = 10;
  const allData = tableData[selectedTable] || [];

  // Apply filters only for global_image_ledger
  const filteredData = selectedTable === 'global_image_ledger'
    ? allData.filter(row => {
        const matchesClassification = classificationFilter === 'all' || row.classification === classificationFilter;
        const matchesCalpaScore = row.calpa_score >= calpaScoreRange[0] && row.calpa_score <= calpaScoreRange[1];
        const matchesDateFrom = !dateFrom || row.first_seen_ts >= dateFrom;
        const matchesDateTo = !dateTo || row.first_seen_ts <= dateTo;
        return matchesClassification && matchesCalpaScore && matchesDateFrom && matchesDateTo;
      })
    : allData;

  const currentData = filteredData;
  const totalRows = tables.find(t => t.name === selectedTable)?.rows || 0;
  const startRow = (page - 1) * rowsPerPage + 1;
  const endRow = Math.min(page * rowsPerPage, currentData.length);

  const columns = currentData.length > 0 ? Object.keys(currentData[0]) : [];
  const visibleColumns = columns;

  const handleTableChange = (tableName: string) => {
    setLoading(true);
    setSelectedTable(tableName);
    setSelectedRow(null);
    setPage(1);
    setClassificationFilter('all');
    setCalpaScoreRange([0, 100]);
    setDateFrom('');
    setDateTo('');
    setTimeout(() => setLoading(false), 300);
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Database Explorer" />

      <div className="flex-1 flex overflow-hidden">
        <div
          className="hidden lg:flex w-[260px] border-r flex-col"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-default)'
          }}
        >
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Tables
            </h3>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {tables.map((table) => (
              <button
                key={table.name}
                onClick={() => handleTableChange(table.name)}
                className="w-full text-left p-3 rounded-lg mb-1 transition-all hover-table-item"
                style={{
                  background: selectedTable === table.name ? 'var(--bg-hover)' : 'transparent',
                  borderLeft: selectedTable === table.name ? '3px solid var(--accent)' : '3px solid transparent'
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'monospace',
                    color: selectedTable === table.name ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: selectedTable === table.name ? 500 : 400
                  }}
                >
                  {table.name}
                </div>
                <div className="flex justify-between mt-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <span>{table.rows.toLocaleString()} rows</span>
                  <span>{table.lastUpdated}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div
            className="p-4 border-b flex flex-col lg:flex-row lg:items-center gap-3"
            style={{ borderColor: 'var(--border-default)' }}
          >
            <select
              value={selectedTable}
              onChange={(e) => handleTableChange(e.target.value)}
              className="lg:hidden px-3 py-2 rounded-lg border w-full"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'monospace'
              }}
            >
              {tables.map((table) => (
                <option key={table.name} value={table.name}>
                  {table.name} ({table.rows.toLocaleString()} rows)
                </option>
              ))}
            </select>

            {selectedTable === 'global_image_ledger' && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="px-3 py-2 rounded-lg border w-full sm:w-auto"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                >
                  <option value="all">All Classifications</option>
                  <option value="benign">Benign</option>
                  <option value="suspicious">Suspicious</option>
                  <option value="malicious">Malicious</option>
                </select>

                <div className="hidden lg:flex items-center gap-2">
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    CALPA Score:
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={calpaScoreRange[0]}
                    onChange={(e) => setCalpaScoreRange([parseInt(e.target.value), calpaScoreRange[1]])}
                    className="w-24"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                    {calpaScoreRange[0]}% - {calpaScoreRange[1]}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={calpaScoreRange[1]}
                    onChange={(e) => setCalpaScoreRange([calpaScoreRange[0], parseInt(e.target.value)])}
                    className="w-24"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="datetime-local"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-3 py-2 rounded-lg border w-full sm:w-auto"
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
                    className="px-3 py-2 rounded-lg border w-full sm:w-auto"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)',
                      fontSize: 'var(--text-sm)'
                    }}
                  />
                </div>
              </div>
            )}

            {selectedTable !== 'global_image_ledger' && <div className="flex-1" />}

            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border transition-colors hover:bg-opacity-80 self-end lg:self-auto"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            <div
              className="rounded-lg border overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                      {visibleColumns.map((col) => (
                        <th
                          key={col}
                          style={{
                            padding: '12px 16px',
                            textAlign: 'left',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}>
                          {visibleColumns.map((col) => (
                            <td key={col} style={{ padding: '14px 16px' }}>
                              <div
                                className="h-4 rounded animate-pulse"
                                style={{ background: 'var(--bg-hover)', width: '80%' }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : currentData.length === 0 ? (
                      <tr>
                        <td colSpan={visibleColumns.length} style={{ padding: '48px 16px', textAlign: 'center' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            No data available
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentData.map((row, index) => (
                        <tr
                          key={index}
                          onClick={() => setSelectedRow(row)}
                          className="cursor-pointer transition-colors table-row-hover"
                          style={{
                            background: index % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)',
                            borderBottom: '1px solid var(--border-subtle)'
                          }}
                        >
                          {visibleColumns.map((col) => {
                            const value = row[col];

                            // Render calpa_score as percentage with color coding
                            if (col === 'calpa_score') {
                              const score = typeof value === 'number' ? value : 0;
                              const scoreColor = score < 30
                                ? 'var(--status-success)'
                                : score < 70
                                ? 'var(--status-warning)'
                                : 'var(--status-error)';
                              const scoreBg = score < 30
                                ? 'rgba(16, 185, 129, 0.1)'
                                : score < 70
                                ? 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)';

                              return (
                                <td key={col} style={{ padding: '14px 16px' }}>
                                  <span
                                    className="px-2 py-1 rounded"
                                    style={{
                                      background: scoreBg,
                                      color: scoreColor,
                                      fontSize: 'var(--text-sm)',
                                      fontWeight: 600
                                    }}
                                  >
                                    {score.toFixed(1)}%
                                  </span>
                                </td>
                              );
                            }

                            // Render classification with color coding
                            if (col === 'classification') {
                              const classColor = value === 'benign'
                                ? 'var(--status-success)'
                                : value === 'suspicious'
                                ? 'var(--status-warning)'
                                : 'var(--status-error)';
                              const classBg = value === 'benign'
                                ? 'rgba(16, 185, 129, 0.1)'
                                : value === 'suspicious'
                                ? 'rgba(245, 158, 11, 0.1)'
                                : 'rgba(239, 68, 68, 0.1)';

                              return (
                                <td key={col} style={{ padding: '14px 16px' }}>
                                  <span
                                    className="px-2 py-1 rounded"
                                    style={{
                                      background: classBg,
                                      color: classColor,
                                      fontSize: 'var(--text-sm)',
                                      textTransform: 'capitalize'
                                    }}
                                  >
                                    {value}
                                  </span>
                                </td>
                              );
                            }

                            // Render details column as JSON preview
                            if (col === 'details' && typeof value === 'object') {
                              const jsonStr = JSON.stringify(value);
                              const preview = jsonStr.length > 50 ? jsonStr.slice(0, 50) + '...' : jsonStr;

                              return (
                                <td key={col} style={{ padding: '14px 16px' }}>
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--text-secondary)',
                                      background: 'var(--bg-sidebar)',
                                      padding: '4px 8px',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    {preview}
                                  </span>
                                </td>
                              );
                            }

                            // Default rendering
                            return (
                              <td
                                key={col}
                                style={{
                                  padding: '14px 16px',
                                  fontSize: 'var(--text-sm)',
                                  color: 'var(--text-primary)',
                                  fontFamily: col.includes('id') || col.includes('hash') || col.includes('_uri') || col.includes('_ip') || col.includes('_ts') ? 'monospace' : 'inherit',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '300px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {value === null || value === undefined ? (
                                  <span style={{ color: 'var(--text-muted)' }}>-</span>
                                ) : typeof value === 'boolean' ? (
                                  <span
                                    className="px-2 py-1 rounded text-xs"
                                    style={{
                                      background: value ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                      color: value ? 'var(--status-success)' : 'var(--status-error)'
                                    }}
                                  >
                                    {value.toString()}
                                  </span>
                                ) : (
                                  String(value)
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {!loading && currentData.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Showing {startRow}–{endRow} of {totalRows.toLocaleString()} rows
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-opacity-70"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                    Page {page}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={endRow >= totalRows}
                    className="px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-opacity-70"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-secondary)',
                      fontSize: 'var(--text-sm)'
                    }}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedRow && (
          <div
            className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Row Details
              </h3>
              <button onClick={() => setSelectedRow(null)} className="p-1 rounded hover:bg-opacity-70 transition-colors">
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
                {JSON.stringify(selectedRow, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .drawer-slide-in {
          animation: slideIn 200ms ease-out;
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }

        .table-row-hover:hover {
          background: var(--bg-hover) !important;
        }

        .hover-table-item:hover {
          background: var(--bg-hover) !important;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
