import { TopBar } from '../components/TopBar';
import { Database, Server, Activity, HardDrive, Cpu } from 'lucide-react';

const services = [
  { name: 'PostgreSQL', status: 'online', icon: Database },
  { name: 'Redis', status: 'online', icon: Server },
  { name: 'MinIO', status: 'online', icon: HardDrive },
  { name: 'Model Service', status: 'online', icon: Cpu },
];

const metrics = [
  { label: 'Processing Queue', value: '23', unit: 'jobs', color: 'var(--status-info)' },
  { label: 'Avg Processing Time', value: '1.8', unit: 'seconds', color: 'var(--status-success)' },
  { label: 'Images Analyzed', value: '1,247', unit: 'today', color: 'var(--accent)' },
];

const activityData = [
  { time: '14:15', value: 45 },
  { time: '14:16', value: 52 },
  { time: '14:17', value: 48 },
  { time: '14:18', value: 65 },
  { time: '14:19', value: 58 },
  { time: '14:20', value: 71 },
  { time: '14:21', value: 63 },
  { time: '14:22', value: 55 },
  { time: '14:23', value: 68 },
];

export function PerformancePage() {
  const maxValue = Math.max(...activityData.map(d => d.value));

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Performance" />

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Service Status
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {services.map((service) => (
                <div
                  key={service.name}
                  className="p-4 rounded-lg border"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)'
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <service.icon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {service.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: service.status === 'online' ? 'var(--status-success)' : 'var(--status-error)'
                      }}
                    />
                    <span
                      style={{
                        fontSize: 'var(--text-sm)',
                        color: service.status === 'online' ? 'var(--status-success)' : 'var(--status-error)',
                        textTransform: 'capitalize'
                      }}
                    >
                      {service.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
              Metrics
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="p-4 rounded-lg border"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)'
                  }}
                >
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    {metric.label}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: metric.color }}>
                      {metric.value}
                    </div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      {metric.unit}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-lg border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Images Analyzed Over Time
              </h2>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Last 9 minutes
              </p>
            </div>

            <div className="p-6">
              <div className="flex items-end gap-2 h-64">
                {activityData.map((point, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t transition-all hover:opacity-80"
                      style={{
                        height: `${(point.value / maxValue) * 100}%`,
                        background: 'var(--accent)',
                        minHeight: '8px'
                      }}
                    />
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {point.time}
                    </div>
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
