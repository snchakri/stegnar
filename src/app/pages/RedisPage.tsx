import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { fetchJson } from '../../lib/api';
import { Database, Server, Activity, RefreshCw, Copy, Trash2 } from 'lucide-react';

interface RedisKey {
  name: string;
  type: string;
  ttl: number | null;
  group: string;
  value: any;
}

interface RedisStats {
  total_keys: number;
  memory_used: number;
  memory_max: number;
  connections: number;
}

const fmtTTL = (ttl: number | null) => {
  if (ttl === null) return 'No expiry';
  if (ttl < 60)     return `${ttl}s`;
  if (ttl < 3600)   return `${Math.floor(ttl/60)}m ${ttl%60}s`;
  return `${Math.floor(ttl/3600)}h ${Math.floor((ttl%3600)/60)}m`;
};

const fmtBytes = (b: number) => {
  if (b >= 1e9) return (b/1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b/1e6).toFixed(1) + ' MB';
  return Math.round(b/1024) + ' KB';
};

export function RedisPage() {
  const [stats,       setStats]       = useState<RedisStats | null>(null);
  const [keys,        setKeys]        = useState<RedisKey[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [loading,     setLoading]     = useState(true);

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetchJson('/redis/stats'),
      fetchJson('/redis/keys'),
    ])
      .then(([s, k]) => { setStats(s as RedisStats); setKeys(k as RedisKey[]); if ((k as RedisKey[]).length > 0) setSelectedKey((k as RedisKey[])[0].name); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
    const iv = window.setInterval(fetchAll, 5000);
    return () => window.clearInterval(iv);
  }, []);

  const selectedKeyData = keys.find(k => k.name === selectedKey);

  const renderValue = (kd: RedisKey) => {
    if (!kd) return null;
    if (kd.type === 'hash' && typeof kd.value === 'object' && kd.value) {
      return (
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)' }}>Field</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(kd.value).map(([f, v], i) => (
              <tr key={f} style={{ background: i%2===0?'transparent':'var(--bg-sidebar)' }}>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{f}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)' }}>{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    if (kd.type === 'string') {
      return (
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-sidebar)', fontFamily: 'monospace', fontSize: 13, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
          {String(kd.value)}
        </div>
      );
    }
    if (kd.type === 'stream' && Array.isArray(kd.value)) {
      return (
        <div className="space-y-2">
          {kd.value.map((msg: any, i: number) => (
            <div key={i} className="p-3 rounded-lg" style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border-default)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 6 }}>ID: {msg.id}</div>
              <pre style={{ fontSize: 11, color: 'var(--text-primary)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(msg.fields, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      );
    }
    return <div style={{ color: 'var(--text-muted)' }}>No value</div>;
  };

  const groups = Array.from(new Set(keys.map(k => k.group)));

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Redis Monitor" />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Database, label: 'Total Keys',    value: loading ? '…' : String(stats?.total_keys ?? 0) },
              { icon: Server,   label: 'Memory Usage',  value: loading ? '…' : `${fmtBytes(stats?.memory_used ?? 0)} / ${fmtBytes(stats?.memory_max ?? 536870912)}` },
              { icon: Activity, label: 'Connections',   value: loading ? '…' : String(stats?.connections ?? 0) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Keys panel */}
            <div className="rounded-lg border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', height: 520 }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Keys ({keys.length})</h3>
                <button onClick={fetchAll} className="p-1.5 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {loading ? (
                  <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>
                ) : keys.length === 0 ? (
                  <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>No Redis keys found</div>
                ) : (
                  groups.map(group => (
                    <div key={group} className="mb-4">
                      <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em' }}>{group}</div>
                      {keys.filter(k => k.group === group).map(key => (
                        <button key={key.name} onClick={() => setSelectedKey(key.name)}
                          className="w-full text-left p-3 rounded-lg mb-1 transition-all"
                          style={{ background: selectedKey === key.name ? 'var(--bg-hover)' : 'transparent', border: `1px solid ${selectedKey === key.name ? 'var(--accent)' : 'transparent'}` }}>
                          <div className="flex items-center justify-between mb-1">
                            <span style={{ fontSize: 13, fontFamily: 'monospace', color: selectedKey === key.name ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                              {key.name}
                            </span>
                            <span style={{ background: 'var(--bg-sidebar)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 3, fontSize: 11, fontFamily: 'monospace' }}>
                              {key.type}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TTL: {fmtTTL(key.ttl)}</div>
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Value viewer */}
            <div className="rounded-lg border flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', height: 520 }}>
              <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Value Viewer</h3>
                <div className="flex gap-2">
                  <button onClick={() => selectedKeyData && navigator.clipboard.writeText(JSON.stringify(selectedKeyData.value, null, 2))}
                    className="p-1.5 rounded" style={{ background: 'var(--bg-sidebar)' }} title="Copy value">
                    <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {!selectedKeyData ? (
                  <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: 40 }}>Select a key</div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { label: 'KEY',  content: <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{selectedKeyData.name}</div> },
                      { label: 'TYPE', content: <div className="p-2 rounded inline-block" style={{ background: 'var(--bg-sidebar)', fontSize: 13, color: 'var(--accent)', fontFamily: 'monospace' }}>{selectedKeyData.type}</div> },
                      { label: 'TTL',  content: <div className="p-2 rounded inline-block" style={{ background: 'var(--bg-sidebar)', fontSize: 13, color: 'var(--text-primary)' }}>{fmtTTL(selectedKeyData.ttl)}</div> },
                      { label: 'VALUE', content: renderValue(selectedKeyData) },
                    ].map(({ label, content }) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.06em' }}>{label}</div>
                        {content}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg);}to{transform:rotate(360deg);} }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}