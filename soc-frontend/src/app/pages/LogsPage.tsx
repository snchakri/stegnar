// ─── LogsPage.tsx ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { TopBar } from '../components/TopBar';
import { apiUrl } from '../../lib/config';
import { Search, X } from 'lucide-react';

interface LogRow {
  log_id: string;
  timestamp: string;
  component: string;
  action: string;
  details: any;
  _source?: 'network' | 'audit';
  event_type?: string;
  actor?: string;
  job_id?: string;
}

export function LogsPage() {
  const [searchParams]  = useSearchParams();
  const [logs,          setLogs]          = useState<LogRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [compFilter,    setCompFilter]    = useState(searchParams.get('component') || 'all');
  const [selectedLog,   setSelectedLog]   = useState<LogRow | null>(null);
  const [components,    setComponents]    = useState<string[]>([]);

  const fetchLogs = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (compFilter !== 'all') params.set('component', compFilter);
    if (search)               params.set('search', search);

    // Fetch network events + audit log in parallel then merge into one timeline.
    Promise.all([
      fetch(apiUrl(`/logs?${params}`)).then(r => {
        if (!r.ok) throw new Error(`/api/logs ${r.status}`);
        return r.json() as Promise<any[]>;
      }).catch(() => [] as any[]),          // ← swallow transient DB errors
      fetch(apiUrl('/audit/events?limit=200')).then(r => {
        if (!r.ok) return [] as any[];
        return r.json() as Promise<any[]>;
      }).catch(() => [] as any[]),
    ])
      .then(([netEvents, auditEvents]) => {
        const net: LogRow[] = (netEvents || []).map((l: any) => ({
          ...l,
          _source: 'network' as const,
        }));
        const audit: LogRow[] = (auditEvents || []).map((e: any) => ({
          log_id:     e.audit_id || '',
          timestamp:  e.timestamp || '',
          component:  e.actor     || 'soc-ingest',
          action:     e.verdict   || e.event_type || 'INGEST',
          details:    e.details   ?? {},
          _source:    'audit' as const,
          event_type: e.event_type,
          actor:      e.actor,
          job_id:     e.job_id,
        }));

        // Merge and sort descending by timestamp.
        const merged = [...net, ...audit].sort(
          (a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')
        );
        // Only update displayed rows when we got something back
        if (merged.length > 0) {
          setLogs(merged);
          setError(null);
          const comps = Array.from(new Set(merged.map(l => l.component).filter(Boolean)));
          setComponents(comps);
        }
        setLoading(false);
      })
      .catch(err => {
        // Keep old rows visible, just show a non-blocking warning
        setError(String(err?.message || err));
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLogs();
    const iv = window.setInterval(fetchLogs, 5000);
    return () => window.clearInterval(iv);
  }, [compFilter, search]);

  const COMPONENT_COLORS: Record<string, { bg: string; text: string }> = {
    'victim-a':  { bg: '#1e3a5f', text: '#60a5fa' },
    'victim-b':  { bg: '#1e3a5f', text: '#93c5fd' },
    'proxy':     { bg: '#1e2d40', text: '#38bdf8' },
    'routing':   { bg: '#1a2e1a', text: '#4ade80' },
    'mitm':      { bg: '#2d1a0e', text: '#fb923c' },
  };

  const actionColor = (action: string) => {
    if (action === 'STEGO')     return '#f87171';
    if (action === 'AMBIGUOUS') return '#fbbf24';
    if (action === 'CLEAN')     return '#4ade80';
    return 'var(--text-secondary)';
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="System Audit Logs" />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchLogs()}
                placeholder="Search logs…" className="w-full pl-10 pr-4 py-2 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }} />
            </div>
            <select value={compFilter} onChange={e => setCompFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
              <option value="all">All Sources</option>
              {components.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Error banner */}
          {error && (
            <div style={{ margin: '8px 16px', padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: 13 }}>
              ⚠ Failed to load logs: {error}
            </div>
          )}

          <div className="flex-1 overflow-auto p-4">
            <div className="rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              {loading ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
              ) : logs.length === 0 ? (
                <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No logs yet. Waiting for network activity…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                        {['TIMESTAMP', 'SOURCE', 'ENDPOINT', 'VERDICT', 'DETAILS'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log, i) => {
                        const cc = COMPONENT_COLORS[log.component] ?? { bg: '#1e2130', text: '#94a3b8' };
                        const isAudit = log._source === 'audit';
                        return (
                          <tr key={i} onClick={() => setSelectedLog(log)} className="cursor-pointer transition-colors table-row-hover"
                            style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              {(log.timestamp || '').slice(0, 19).replace('T', ' ')}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{
                                background: isAudit ? 'rgba(168,85,247,0.15)' : 'rgba(34,197,94,0.12)',
                                color:      isAudit ? '#c084fc' : '#4ade80',
                                padding: '2px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
                              }}>
                                {isAudit ? 'AUDIT' : 'NETWORK'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ background: cc.bg, color: cc.text, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }}>
                                {log.component}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px', fontSize: 13, color: actionColor(log.action), fontFamily: 'monospace', fontWeight: 600 }}>
                              {log.action}
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-sidebar)', padding: '3px 7px', borderRadius: 4, display: 'inline-block', maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {log.details == null
                                  ? '—'
                                  : typeof log.details === 'object'
                                    ? JSON.stringify(log.details).slice(0, 80)
                                    : String(log.details).slice(0, 80)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedLog && (
          <div className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Log Details</h3>
              <button onClick={() => setSelectedLog(null)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', background: 'var(--bg-sidebar)', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .table-row-hover:hover { background: var(--bg-hover) !important; }
        .drawer-slide-in { animation: slideIn 200ms ease-out; }
        @keyframes slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
      `}</style>
    </div>
  );
}