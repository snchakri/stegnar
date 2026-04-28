import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Shield, CheckCircle, X, Play, Loader2 } from 'lucide-react';

const ledgerEvents = [
  { index: 1247, id: 'evt-7f3a2b', type: 'InferenceEvent',           producer: 'model-service',   time: '2024-04-28 14:23:45', payload: 'CALPA score: 94.2%, classification: malicious',   integrity: true },
  { index: 1246, id: 'evt-8c4d3e', type: 'AlertEvent',               producer: 'routing-server',  time: '2024-04-28 14:23:42', payload: 'Critical threat on ep_192.168.1.45',              integrity: true },
  { index: 1245, id: 'evt-9d5e4f', type: 'ExtractionEvent',          producer: 'proxy',           time: '2024-04-28 14:23:38', payload: 'JPEG extracted, session sess_a7f3e9b2',           integrity: true },
  { index: 1244, id: 'evt-a6f5g7', type: 'RoutingDecisionEvent',     producer: 'routing-server',  time: '2024-04-28 14:23:35', payload: 'Route: ep_192.168.1.45 → model-service',          integrity: true },
  { index: 1243, id: 'evt-b7g6h8', type: 'ContainerLifecycleEvent',  producer: 'routing-server',  time: '2024-04-28 14:23:30', payload: 'slot-03 assigned job_a7f3e9b2',                   integrity: true },
  { index: 1242, id: 'evt-c8h7i9', type: 'AttestationEvent',         producer: 'routing-server',  time: '2024-04-28 14:23:25', payload: 'ep_192.168.1.45 attestation PASS',                integrity: true },
  { index: 1241, id: 'evt-d9i8j0', type: 'EndpointEntity',           producer: 'routing-server',  time: '2024-04-28 14:23:20', payload: 'ep_192.168.1.45 enrolled',                       integrity: true },
];

const EVENT_TYPES = [
  'All Events', 'InferenceEvent', 'AlertEvent', 'ExtractionEvent',
  'EndpointEntity', 'ContainerLifecycleEvent', 'RoutingDecisionEvent',
  'AttestationEvent', 'TamperEvent', 'SocActionEvent',
];

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  InferenceEvent:          { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  AlertEvent:              { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
  ExtractionEvent:         { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  EndpointEntity:          { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  ContainerLifecycleEvent: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  RoutingDecisionEvent:    { bg: 'rgba(20,184,166,0.15)', text: '#2dd4bf' },
  AttestationEvent:        { bg: 'rgba(99,102,241,0.15)', text: '#818cf8' },
  TamperEvent:             { bg: 'rgba(239,68,68,0.15)',  text: '#f87171' },
  SocActionEvent:          { bg: 'rgba(249,115,22,0.15)', text: '#fb923c' },
};

export function LedgerTrail() {
  const [typeFilter, setTypeFilter] = useState('All Events');
  const [chainFrom, setChainFrom] = useState('');
  const [chainTo, setChainTo] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<typeof ledgerEvents[0] | null>(null);
  const [replayRunning, setReplayRunning] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);

  const filtered = ledgerEvents.filter(e => {
    const matchType = typeFilter === 'All Events' || e.type === typeFilter;
    const matchFrom = !chainFrom || e.index >= parseInt(chainFrom);
    const matchTo   = !chainTo   || e.index <= parseInt(chainTo);
    return matchType && matchFrom && matchTo;
  });

  const handleStartReplay = () => {
    setReplayRunning(true);
    setReplayProgress(0);
    const iv = setInterval(() => {
      setReplayProgress(p => {
        if (p >= 100) { clearInterval(iv); setReplayRunning(false); return 100; }
        return p + 5;
      });
    }, 150);
  };

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

          {/* Chain Integrity Banner */}
          <div className="flex items-center justify-between p-4 rounded-lg border" style={{ background: 'rgba(16,185,129,0.05)', borderColor: 'var(--status-success)' }}>
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Chain verified up to index #1247
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  Last checked 2 minutes ago • No tampering detected
                </div>
              </div>
            </div>
            <Shield className="w-6 h-6" style={{ color: 'var(--status-success)' }} />
          </div>

          {/* Filters */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 160px 160px 120px' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Event Type</label>
                <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={inputStyle}>
                  {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Chain From</label>
                <input type="number" placeholder="0" value={chainFrom} onChange={e => setChainFrom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Chain To</label>
                <input type="number" placeholder="Latest" value={chainTo} onChange={e => setChainTo(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  onClick={() => { setTypeFilter('All Events'); setChainFrom(''); setChainTo(''); }}
                  style={{ ...inputStyle, cursor: 'pointer', width: '100%', textAlign: 'center', background: 'transparent' }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Event Table */}
          <div className="rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                    {['#', 'Event ID', 'Type', 'Producer', 'Timestamp', 'Payload Summary', '✓'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((evt, i) => {
                    const tc = TYPE_COLORS[evt.type] ?? { bg: 'var(--bg-sidebar)', text: 'var(--text-secondary)' };
                    return (
                      <tr
                        key={evt.index}
                        onClick={() => setSelectedEvent(selectedEvent?.index === evt.index ? null : evt)}
                        className="cursor-pointer transition-colors table-row-hover"
                        style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}
                      >
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>#{evt.index}</td>
                        <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{evt.id}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ background: tc.bg, color: tc.text, padding: '2px 8px', borderRadius: 4, fontSize: 'var(--text-xs)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {evt.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{evt.producer}</td>
                        <td style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{evt.time}</td>
                        <td style={{ padding: '12px 14px', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evt.payload}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                          <CheckCircle className="w-4 h-4 inline" style={{ color: 'var(--status-success)' }} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expanded event detail */}
          {selectedEvent && (
            <div className="rounded-lg border p-4" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)' }}>
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Event #{selectedEvent.index} — Full Details</span>
                <button onClick={() => setSelectedEvent(null)}>
                  <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                </button>
              </div>
              <pre style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)', color: 'var(--text-primary)', background: 'var(--bg-card)', padding: 16, borderRadius: 6, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{JSON.stringify({
  chain_index:          selectedEvent.index,
  event_id:             selectedEvent.id,
  event_type:           selectedEvent.type,
  producer_id:          selectedEvent.producer,
  produced_at:          selectedEvent.time,
  payload_summary:      selectedEvent.payload,
  integrity_verified:   selectedEvent.integrity,
  digest_descriptor: {
    algorithm:    'BLAKE3',
    mode:         'unkeyed',
    context:      'stegnar.ledger.v1',
    length_bytes: 64,
    digest_value: '7f3a2b8c4d9e1f6a5b0c2d7e3f8a4b9c...',
    digest_version: 'v1',
  },
  previous_event_digest: '8c4d3e9f5a1b7g6h2c8d4f9a5b1c7e3...',
}, null, 2)}
              </pre>
            </div>
          )}

          {/* Replay Panel */}
          <div className="rounded-lg border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Replay Panel</div>
            <div className="grid gap-3" style={{ gridTemplateColumns: '160px 160px 1fr 140px', alignItems: 'flex-end' }}>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>From Index</label>
                <input type="number" placeholder="0" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>To Index</label>
                <input type="number" placeholder="Latest" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Event Type Filter</label>
                <select style={inputStyle}>
                  {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <button
                onClick={handleStartReplay}
                disabled={replayRunning}
                className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg"
                style={{ background: replayRunning ? 'var(--bg-sidebar)' : 'var(--accent)', color: replayRunning ? 'var(--text-muted)' : '#fff', fontSize: 'var(--text-sm)', fontWeight: 500, cursor: replayRunning ? 'not-allowed' : 'pointer', border: 'none' }}
              >
                {replayRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {replayRunning ? 'Running…' : 'Start Replay'}
              </button>
            </div>

            {replayRunning || replayProgress === 100 ? (
              <div style={{ marginTop: 12 }}>
                <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span>{replayRunning ? 'Replaying events…' : 'Replay complete'}</span>
                  <span>{replayProgress}%</span>
                </div>
                <div style={{ background: 'var(--bg-sidebar)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ background: replayProgress === 100 ? 'var(--status-success)' : 'var(--accent)', width: `${replayProgress}%`, height: '100%', transition: 'width 0.15s ease' }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <style>{`
        .table-row-hover:hover { background: var(--bg-hover) !important; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}