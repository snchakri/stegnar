import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { Database, Server, HardDrive, Cpu, Activity } from 'lucide-react';

interface Service {
  name: string;
  status: 'online' | 'offline' | 'checking';
  port: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'PostgreSQL':     Database,
  'Redis':          Server,
  'MinIO':          HardDrive,
  'CALPA Model':    Cpu,
  'MITM Gateway':   Activity,
  'Routing System': Activity,
};

const activityData = Array.from({ length: 9 }, (_, i) => ({
  time: `14:${String(i + 15).padStart(2, '0')}`,
  value: Math.floor(Math.random() * 60 + 10),
}));

export function PerformancePage() {
  const [services, setServices] = useState<Service[]>([
    { name: 'PostgreSQL',     status: 'checking', port: 5432  },
    { name: 'Redis',          status: 'checking', port: 6379  },
    { name: 'MinIO',          status: 'checking', port: 9000  },
    { name: 'CALPA Model',    status: 'checking', port: 0     },
    { name: 'MITM Gateway',   status: 'checking', port: 50052 },
    { name: 'Routing System', status: 'checking', port: 50051 },
  ]);

  const [eventCount, setEventCount]   = useState<number | null>(null);
  const [stegCount,  setStegCount]    = useState<number | null>(null);

  const fetchHealth = () => {
    fetch('http://localhost:3001/api/health')
      .then(r => r.json())
      .then(data => setServices(data.services))
      .catch(() => {
        // server not ready — keep checking status
        setServices(prev => prev.map(s => ({ ...s, status: 'offline' })));
      });
  };

  useEffect(() => {
    fetchHealth();
    const iv = setInterval(fetchHealth, 10_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    // Pull quick stats from network_events
    fetch('http://localhost:3001/api/images')
      .then(r => r.json())
      .then((rows: any[]) => {
        setEventCount(rows.length);
        setStegCount(rows.filter(r => r.classification === 'malicious').length);
      })
      .catch(() => {});
  }, []);

  const maxVal = Math.max(...activityData.map(d => d.value));

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Performance" />
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Service status cards */}
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>
              Service Status
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map(svc => {
                const Icon = ICON_MAP[svc.name] ?? Activity;
                return (
                  <div key={svc.name} className="p-4 rounded-lg border"
                    style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Icon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {svc.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{
                        background: svc.status === 'online' ? 'var(--status-success)'
                                  : svc.status === 'offline' ? 'var(--status-error)'
                                  : '#f59e0b',
                        boxShadow: svc.status === 'online' ? '0 0 6px #22c55e' : undefined,
                      }} />
                      <span style={{
                        fontSize: 'var(--text-sm)',
                        color: svc.status === 'online' ? 'var(--status-success)'
                             : svc.status === 'offline' ? 'var(--status-error)'
                             : '#f59e0b',
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
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Images Analyzed
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>
                {eventCount ?? '—'}
              </div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                STEGO Detected
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: stegCount ? '#ef4444' : '#22c55e' }}>
                {stegCount ?? '—'}
              </div>
            </div>
            <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Avg Processing
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--status-success)' }}>
                1.8s
              </div>
            </div>
          </div>

          {/* Activity chart */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Images Analyzed Over Time
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>Last 9 minutes</p>
            </div>
            <div className="p-6">
              <div className="flex items-end gap-2" style={{ height: 200 }}>
                {activityData.map((pt, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full rounded-t" style={{
                      height: `${(pt.value / maxVal) * 100}%`,
                      background: 'var(--accent)',
                      minHeight: 8,
                      opacity: 0.85,
                    }} />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{pt.time}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}