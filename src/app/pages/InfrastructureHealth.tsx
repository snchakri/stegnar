import { Activity, Server, Database, Cpu, HardDrive, Trash2 } from 'lucide-react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { ProgressBar } from '../components/ProgressBar';

const services = [
  { name: 'Proxy', status: 'UP', uptime: '12d 4h 23m' },
  { name: 'Routing Server', status: 'UP', uptime: '12d 4h 22m' },
  { name: 'Model Service', status: 'UP', uptime: '8d 11h 15m' },
  { name: 'Data Ledger', status: 'UP', uptime: '12d 4h 23m' },
  { name: 'SOC Backend', status: 'DEGRADED', uptime: '2h 34m' },
];

const containers = [
  { id: 'slot-01', state: 'Running', job: 'job-7f3a', profile: 'CALPA-v2', lastCheck: '2s ago' },
  { id: 'slot-02', state: 'WarmIdle', job: null, profile: 'CALPA-v2', lastCheck: '5s ago' },
  { id: 'slot-03', state: 'Assigned', job: 'job-8c2b', profile: 'CALPA-v2', lastCheck: '1s ago' },
  { id: 'slot-04', state: 'Running', job: 'job-9d4f', profile: 'CALPA-v2', lastCheck: '3s ago' },
  { id: 'slot-05', state: 'WarmIdle', job: null, profile: 'CALPA-v2', lastCheck: '4s ago' },
  { id: 'slot-06', state: 'Sanitizing', job: null, profile: 'CALPA-v2', lastCheck: '7s ago' },
];

const queueItems = [
  { job: 'job-a1f3', priority: 'CRITICAL', endpoint: '192.168.1.45', age: '2m 15s', deadline: '180ms' },
  { job: 'job-b2c4', priority: 'HIGH', endpoint: '192.168.1.89', age: '45s', deadline: '500ms' },
  { job: 'job-c3d5', priority: 'NORMAL', endpoint: '192.168.1.23', age: '1m 30s', deadline: '1200ms' },
];

export function InfrastructureHealth() {
  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1>Infrastructure Health</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          Real-time monitoring of all core services and container infrastructure
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {services.map((service) => (
          <div
            key={service.name}
            className="px-4 py-2.5 rounded-lg border flex items-center gap-3 min-w-fit"
            style={{
              background: 'var(--card-default)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <StatusBadge status={service.status} />
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{service.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {service.uptime}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card title="Cached-path p95" icon={Activity}>
          <div className="flex items-baseline gap-2">
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--status-success)' }}>
              187ms
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              target: &lt;250ms
            </div>
          </div>
        </Card>

        <Card title="Uncached-path p95" icon={Activity}>
          <div className="flex items-baseline gap-2">
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--status-success)' }}>
              943ms
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              target: &lt;1200ms
            </div>
          </div>
        </Card>

        <Card title="Control-plane p95" icon={Activity}>
          <div className="flex items-baseline gap-2">
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--status-warning)' }}>
              215ms
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              target: &lt;200ms
            </div>
          </div>
        </Card>
      </div>

      <Card title="Container Warm Pool" icon={Server}>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {containers.map((container) => (
            <div
              key={container.id}
              className="p-3 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  {container.id}
                </span>
                <StatusBadge status={container.state} small />
              </div>
              {container.job && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {container.job}
                </div>
              )}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                {container.lastCheck}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Redis Queue" icon={Database}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Queue Depth</span>
                <span style={{ color: 'var(--text-primary)' }}>47 / 1000</span>
              </div>
              <ProgressBar value={47} max={1000} color="var(--accent-primary)" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Throughput</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}>23.4 msg/s</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Oldest Age</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}>2m 15s</div>
              </div>
            </div>

            <div className="space-y-2">
              {queueItems.map((item) => (
                <div
                  key={item.job}
                  className="flex items-center justify-between p-2 rounded"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <div className="flex items-center gap-3">
                    <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {item.job}
                    </span>
                    <StatusBadge status={item.priority} small />
                  </div>
                  <button className="p-1 hover:bg-red-500/10 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--status-critical)' }} />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="w-full py-2 px-4 rounded-lg border transition-colors hover:bg-red-500/10"
              style={{
                borderColor: 'var(--status-critical)',
                color: 'var(--status-critical)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Clear All Queue Items
            </button>
          </div>
        </Card>

        <Card title="PostgreSQL Health" icon={HardDrive}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Active Connections</span>
                <span style={{ color: 'var(--text-primary)' }}>47 / 200</span>
              </div>
              <ProgressBar value={47} max={200} color="var(--status-success)" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Query Latency p95</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}>12ms</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>DB Size</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 500 }}>2.3 GB</div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Cache Hit Rate
              </div>
              <ProgressBar value={94.7} max={100} color="var(--status-success)" />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-success)', marginTop: '4px' }}>
                94.7%
              </div>
            </div>

            <div
              className="p-3 rounded-lg"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>
                Last Slow Query (145ms)
              </div>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                SELECT * FROM artifacts WHERE confidence &gt; 0.8...
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
