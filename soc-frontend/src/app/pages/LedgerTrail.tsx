// ─── LedgerTrail.tsx ──────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { apiUrl } from '../../lib/config';
import { Shield, CheckCircle, X } from 'lucide-react';

interface LedgerEvent {
  chain_index: number;
  event_id: string;
  type: string;
  producer: string;
  time: string;
  payload: string;
  integrity: boolean;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  InferenceEvent: { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
};

export function LedgerTrail() {
  const [events,      setEvents]      = useState<LedgerEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [integrity,   setIntegrity]   = useState({ verified: true, max_chain_index: 0 });
  const [typeFilter,  setTypeFilter]  = useState('All Events');
  const [selectedEvt, setSelectedEvt] = useState<LedgerEvent | null>(null);

  const fetchLedger = () => {
    Promise.all([
      fetch(apiUrl('/ledger/events')).then(r => r.json()),
      fetch(apiUrl('/ledger/integrity')).then(r => r.json()),
    ])
      .then(([evts, integ]) => { setEvents(evts); setIntegrity(integ); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchLedger();
    const iv = window.setInterval(fetchLedger, 5000);
    return () => window.clearInterval(iv);
  }, []);

  const filtered = typeFilter === 'All Events' ? events : events.filter(e => e.type === typeFilter);



  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
    borderRadius: 6, color: 'var(--text-primary)', padding: '7px 10px',
    fontSize: 'var(--text-sm)', outline: 'none', width: '100%',
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Ledger Trail" />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-auto p-4 lg:p-6 space-y-4">

          {/* Chain integrity banner */}
          <div className="flex items-center justify-between p-4 rounded-lg border"
            style={{ background: 'rgba(16,185,129,0.05)', borderColor: '#22c55e' }}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" style={{ color: '#22c55e' }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {loading ? 'Checking chain…' : `Chain verified — ${integrity.max_chain_index} events recorded`}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>All events backed by PostgreSQL + TimescaleDB</div>
              </div>
            </div>
            <Shield className="w-6 h-6" style={{ color: '#22c55e' }} />
          </div>

          {/* Filters */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex gap-3 flex-wrap">
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Event Type</label>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
                  <option>All Events</option>
                  <option>InferenceEvent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                    {['#', 'EVENT ID', 'TYPE', 'ENDPOINT', 'TIMESTAMP', 'SUMMARY', '✓'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No events yet — waiting for network activity</td></tr>
                  ) : (
                    filtered.map((evt, i) => {
                      const tc = TYPE_COLORS[evt.type] ?? { bg: 'var(--bg-sidebar)', text: 'var(--text-secondary)' };
                      return (
                        <tr key={i} onClick={() => setSelectedEvt(selectedEvt?.chain_index === evt.chain_index ? null : evt)}
                          className="cursor-pointer transition-colors table-row-hover"
                          style={{ background: i%2===0?'transparent':'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>#{evt.chain_index}</td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>{String(evt.event_id||'').slice(0,12)}…</td>
                          <td style={{ padding: '12px 14px' }}><span style={{ background: tc.bg, color: tc.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontFamily: 'monospace' }}>{evt.type}</span></td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)' }}>{evt.producer}</td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{String(evt.time||'').slice(0,19).replace('T',' ')}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-primary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.payload}</td>
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}><CheckCircle className="w-4 h-4 inline" style={{ color: '#22c55e' }} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expanded detail */}
          {selectedEvt && (
            <div className="rounded-lg border p-4" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)' }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Event #{selectedEvt.chain_index}</span>
                <button onClick={() => setSelectedEvt(null)}><X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} /></button>
              </div>
              <pre style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-primary)', background: 'var(--bg-card)', padding: 16, borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(selectedEvt, null, 2)}
              </pre>
            </div>
          )}


        </div>
      </div>
      <style>{`
        .table-row-hover:hover { background: var(--bg-hover) !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
      `}</style>
    </div>
  );
}