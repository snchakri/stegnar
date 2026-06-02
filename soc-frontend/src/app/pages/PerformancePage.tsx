import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { apiUrl } from '../../lib/config';
import { Database, Server, HardDrive, Cpu, Activity } from 'lucide-react';

interface Service {
  name: string;
  status: 'online' | 'offline' | 'checking';
  port: number;
}

interface MetricBucket {
  time: string;
  value: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'PostgreSQL':     Database,
  'Redis':          Server,
  'MinIO':          HardDrive,
  'CALPA Model':    Cpu,
  'MITM Gateway':   Activity,
  'Routing System': Activity,
};

// ── Pure-SVG line + area chart ──────────────────────────────────────────────
function ActivityChart({ buckets }: { buckets: MetricBucket[] }) {
  const W = 800, H = 160, PL = 36, PR = 12, PT = 12, PB = 28;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const maxVal = Math.max(...buckets.map(b => b.value), 1);
  const n      = buckets.length;

  const pts = buckets.map((b, i) => ({
    x: PL + (i / Math.max(n - 1, 1)) * innerW,
    y: PT + innerH - (b.value / maxVal) * innerH,
    ...b,
  }));

  const linePoints = pts.map(p => `${p.x},${p.y}`).join(' ');

  const areaPath = pts.length === 0 ? '' : [
    `M ${pts[0].x} ${pts[0].y}`,
    ...pts.slice(1).map(p => `L ${p.x} ${p.y}`),
    `L ${pts[pts.length - 1].x} ${PT + innerH}`,
    `L ${pts[0].x} ${PT + innerH}`,
    'Z',
  ].join(' ');

  const yLabels = [
    { y: PT + innerH, label: '0' },
    { y: PT + innerH / 2, label: String(Math.round(maxVal / 2)) },
    { y: PT, label: String(maxVal) },
  ];

  const xLabels = pts.filter((_, i) => i % 3 === 0 || i === n - 1);
  const hasActivity = buckets.some(b => b.value > 0);

  return (
    <div style={{ width: '100%', aspectRatio: `${W}/${H}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity={hasActivity ? 0.35 : 0.06} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {yLabels.map(({ y }, i) => (
          <line key={i} x1={PL} y1={y} x2={W - PR} y2={y}
            stroke="var(--border-default)" strokeWidth={0.5} strokeDasharray="3,3" />
        ))}

        {yLabels.map(({ y, label }) => (
          <text key={label} x={PL - 4} y={y + 4} textAnchor="end"
            style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {label}
          </text>
        ))}

        {xLabels.map(({ x, time }) => (
          <text key={time} x={x} y={H - 4} textAnchor="middle"
            style={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {time.slice(-5)}
          </text>
        ))}

        {areaPath && <path d={areaPath} fill="url(#area-grad)" />}

        {pts.length > 1 && (
          <polyline points={linePoints} fill="none"
            stroke="var(--accent)" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
            style={{ filter: hasActivity ? 'drop-shadow(0 0 4px var(--accent))' : 'none' }}
          />
        )}

        {pts.filter(p => p.value > 0).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3.5}
            fill="var(--accent)" stroke="#0a0a0a" strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 0 3px var(--accent))' }}
          />
        ))}

        <line x1={PL} y1={PT + innerH} x2={W - PR} y2={PT + innerH}
          stroke="var(--border-default)" strokeWidth={1} />
      </svg>
    </div>
  );
}

export function PerformancePage() {
  const [services, setServices] = useState<Service[]>([
    { name: 'PostgreSQL',     status: 'checking', port: 5432  },
    { name: 'Redis',          status: 'checking', port: 6379  },
    { name: 'MinIO',          status: 'checking', port: 9000  },
    { name: 'CALPA Model',    status: 'checking', port: 0     },
    { name: 'MITM Gateway',   status: 'checking', port: 50052 },
    { name: 'Routing System', status: 'checking', port: 50051 },
  ]);

  const [eventCount,   setEventCount]   = useState<number | null>(null);
  const [stegCount,    setStegCount]    = useState<number | null>(null);
  const [avgLatency,   setAvgLatency]   = useState<number | null>(null);
  const [buckets,      setBuckets]      = useState<MetricBucket[]>([]);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);

  const fetchHealth = () => {
    fetch(apiUrl('/health'))
      .then(r => r.json())
      .then(data => setServices(data.services))
      .catch(() => setServices(prev => prev.map(s => ({ ...s, status: 'offline' }))));
  };

  const fetchMetrics = () => {
    fetch(apiUrl('/metrics/latency'))
      .then(r => r.json())
      .then(data => {
        setAvgLatency(data.avg_latency_ms);
        setBuckets(Array.isArray(data.buckets) && data.buckets.length > 0 ? data.buckets : []);
        setLastUpdated(new Date());
      })
      .catch(() => {});

    fetch(apiUrl('/db/tables/network_events/rows?limit=500'))
      .then(r => r.json())
      .then((rows: any[]) => {
        setEventCount(rows.length);
        setStegCount(rows.filter(r => r.verdict === 'STEGO').length);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchHealth();
    fetchMetrics();
    const healthIv   = setInterval(fetchHealth,   10_000);
    const metricsIv  = setInterval(fetchMetrics,  10_000);
    return () => { clearInterval(healthIv); clearInterval(metricsIv); };
  }, []);

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Performance" />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Service status cards */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Service Status</h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(svc => {
                const Icon = ICON_MAP[svc.name] ?? Activity;
                return (
                  <div key={svc.name} className="p-4 rounded-lg border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{
                        background: svc.status === 'online' ? 'var(--status-success)' : svc.status === 'offline' ? 'var(--status-error)' : '#f59e0b',
                        boxShadow:  svc.status === 'online' ? '0 0 6px #22c55e' : undefined,
                      }} />
                      <span style={{
                        fontSize: 'var(--text-sm)',
                        color: svc.status === 'online' ? 'var(--status-success)' : svc.status === 'offline' ? 'var(--status-error)' : '#f59e0b',
                        textTransform: 'capitalize',
                      }}>
                        {svc.status}
                      </span>
                      {svc.port > 0 && (
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 'auto', fontFamily: 'monospace' }}>
                          :{svc.port}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Images Analyzed</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{eventCount ?? '—'}</div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>STEGO Detected</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stegCount ? '#ef4444' : '#22c55e' }}>{stegCount ?? '—'}</div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Avg Processing</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--status-success)' }}>
                {avgLatency != null ? `${avgLatency.toFixed(0)}ms` : '—'}
              </div>
            </div>
          </div>

          {/* Activity chart — pure SVG, no library */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <div className="flex items-center justify-between">
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>Images Analyzed Over Time</h2>
                {lastUpdated && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                Last 15 minutes · live from PostgreSQL · refreshes every 10s
              </p>
            </div>
            <div className="p-4">
              {buckets.length === 0 ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', fontSize: 13 }}>
                  Waiting for data from database…
                </div>
              ) : (
                <ActivityChart buckets={buckets} />
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}