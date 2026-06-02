import { useState, useEffect } from 'react';
import { Search, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { fetchJson, formatApiError } from '../../lib/api';

// Real tables that exist in your schema
const REAL_TABLES = [
  { name: 'network_events',     description: 'All forensic detections' },
  { name: 'hash_cache',         description: 'SHA-256 analysis cache'  },
  { name: 'endpoint_registry',  description: 'Enrolled endpoint agents'},
  { name: 'system_audit_log',   description: 'Operator and system audit trails'},
];

type TableName = 'network_events' | 'hash_cache' | 'endpoint_registry' | 'system_audit_log';

function timeAgo(ts: string) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function verdictColor(v: string) {
  const upper = String(v).toUpperCase();
  if (upper === 'STEGO' || upper === 'MALICIOUS')     return { bg: 'rgba(239,68,68,0.1)',  text: '#f87171' };
  if (upper === 'AMBIGUOUS' || upper === 'SUSPICIOUS') return { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' };
  return                                               { bg: 'rgba(16,185,129,0.1)', text: '#34d399' };
}

export function DatabasePage() {
  const [selectedTable, setSelectedTable]   = useState<TableName>('network_events');
  const [rows,          setRows]            = useState<any[]>([]);
  const [tableMeta,     setTableMeta]       = useState<Record<string, { row_count: number; last_write: string }>>({});
  const [loading,       setLoading]         = useState(false);
  const [selectedRow,   setSelectedRow]     = useState<any>(null);
  const [page,          setPage]            = useState(1);
  const [search,        setSearch]          = useState('');
  const [error,         setError]          = useState('');

  const fetchTableMeta = () => {
    fetchJson<any[]>('/db/tables', { timeoutMs: 10000 })
      .then((tables: any[]) => {
        const meta: Record<string, any> = {};
        tables.forEach(t => { meta[t.name] = t; });
        setTableMeta(meta);
        setError('');
      })
      .catch((e) => setError(formatApiError(e)));
  };

  const fetchRows = () => {
    setLoading(true);
    fetchJson<any[]>(`/db/tables/${selectedTable}/rows?limit=100`, { timeoutMs: 10000 })
      .then(data => { setRows(data); setLoading(false); setError(''); })
      .catch((e) => { setError(formatApiError(e)); setLoading(false); });
  };

  // Fetch table metadata (row counts)
  useEffect(() => {
    fetchTableMeta();
    const iv = window.setInterval(fetchTableMeta, 5000);
    return () => window.clearInterval(iv);
  }, []);

  // Fetch rows when table changes
  useEffect(() => {
    setPage(1);
    setSelectedRow(null);
    fetchRows();
    const iv = window.setInterval(fetchRows, 5000);
    return () => window.clearInterval(iv);
  }, [selectedTable]);

  const filtered = rows.filter(r =>
    search === '' || JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
  );

  const rowsPerPage = 10;
  const paginated   = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const columns     = rows.length > 0 ? Object.keys(rows[0]) : [];

  const renderCell = (col: string, val: any) => {
    if (val === null || val === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

    if (col === 'verdict') {
      const c = verdictColor(String(val));
      return (
        <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
          {String(val)}
        </span>
      );
    }
    if (col === 'steg_score') {
      const score = parseFloat(val);
      const color = score > 0.7 ? '#f87171' : score > 0.3 ? '#fbbf24' : '#34d399';
      return <span style={{ color, fontWeight: 600, fontFamily: 'monospace' }}>{(score * 100).toFixed(1)}%</span>;
    }
    if (col === 'sha256' || col === 'event_id' || col.includes('uri') || col.includes('id')) {
      const s = String(val);
      return (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }} title={s}>
          {s.length > 24 ? s.slice(0, 24) + '…' : s}
        </span>
      );
    }
    if (typeof val === 'string' && val.includes('T') && val.includes('Z')) {
      return <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>{val.replace('T', ' ').slice(0, 19)}</span>;
    }
    return <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{String(val)}</span>;
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Database Explorer" />
      <div className="flex-1 flex overflow-hidden">

        {/* Table sidebar */}
        <div className="hidden lg:flex w-64 border-r flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Tables</h3>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {REAL_TABLES.map(t => (
              <button
                key={t.name}
                onClick={() => setSelectedTable(t.name as TableName)}
                className="w-full text-left p-3 rounded-lg mb-1 transition-all"
                style={{
                  background:  selectedTable === t.name ? 'var(--bg-hover)' : 'transparent',
                  borderLeft: `3px solid ${selectedTable === t.name ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: selectedTable === t.name ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: selectedTable === t.name ? 500 : 400 }}>
                  {t.name}
                </div>
                <div className="flex justify-between mt-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <span>{(tableMeta[t.name]?.row_count ?? '…').toLocaleString()} rows</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{t.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search rows…"
                className="w-full pl-10 pr-4 py-2 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
              />
            </div>
            <button onClick={fetchRows}
              className="p-2 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {error && (
            <div className="mx-4 mt-4 rounded-lg border p-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                      {columns.map(col => (
                        <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {(columns.length || 5) && Array.from({ length: columns.length || 5 }).map((_, j) => (
                            <td key={j} style={{ padding: '12px 14px' }}>
                              <div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)', width: '80%' }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={columns.length || 1} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                          {rows.length === 0 ? 'No data — is the server running?' : 'No rows match filter'}
                        </td>
                      </tr>
                    ) : (
                      paginated.map((row, i) => (
                        <tr key={i} onClick={() => setSelectedRow(row)} className="cursor-pointer transition-colors table-row-hover"
                          style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}>
                          {columns.map(col => (
                            <td key={col} style={{ padding: '12px 14px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {renderCell(col, row[col])}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between mt-4">
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Showing {(page-1)*rowsPerPage+1}–{Math.min(page*rowsPerPage, filtered.length)} of {filtered.length} rows
                </span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                    className="p-1.5 rounded border disabled:opacity-40" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>Page {page}</span>
                  <button onClick={() => setPage(p => p+1)} disabled={page*rowsPerPage >= filtered.length}
                    className="p-1.5 rounded border disabled:opacity-40" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row detail drawer */}
        {selectedRow && (
          <div className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Row Details</h3>
              <button onClick={() => setSelectedRow(null)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-sidebar)', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(selectedRow, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .table-row-hover:hover { background: var(--bg-hover) !important; }
        .drawer-slide-in { animation: slideIn 200ms ease-out; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .animate-pulse { animation: pulse 1.5s infinite; }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}