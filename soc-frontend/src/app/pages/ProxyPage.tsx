import { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { fetchJson, formatApiError } from '../../lib/api';
import {
  Activity, Server, Radio, ShieldAlert, Copy, RefreshCw,
  CheckCircle2, XCircle, Zap, Eye, AlertTriangle, Terminal,
} from 'lucide-react';

interface MitmMetrics {
  status: string;
  container_status: string;
  total_log_lines: number;
  images_intercepted: number;
  stego_detected: number;
  clean_count: number;
  ambiguous_count: number;
  avg_latency_ms: number;
  detection_rate: number;
}

interface ContainerLogResponse {
  service: string;
  container: string;
  status: string;
  line_count: number;
  lines: string[];
}

const SERVICES = [
  { id: 'mitm',       label: 'MITM',        icon: '🔬', color: '#fb923c' },
  { id: 'proxy',      label: 'Proxy',       icon: '🔀', color: '#38bdf8' },
  { id: 'routing',    label: 'Routing',     icon: '🗺️', color: '#4ade80' },
  { id: 'data-layer', label: 'Data Layer',  icon: '💾', color: '#a78bfa' },
  { id: 'soc-api',    label: 'SOC API',     icon: '⚙️', color: '#f9a8d4' },
];

function colorForLogLine(line: string): string {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('exception') || l.includes('fatal') || l.includes('critical')) return '#f87171';
  if (l.includes('warn'))                                                        return '#facc15';
  if (l.includes('stego'))                                                       return '#f87171';
  if (l.includes('clean') || l.includes('benign'))                              return '#34d399';
  if (l.includes('ambiguous'))                                                   return '#fbbf24';
  if (l.includes('intercepted') || l.includes('image'))                         return '#c084fc';
  if (l.includes('dispatching') || l.includes('calpa') || l.includes('analysis')) return '#fb923c';
  if (l.includes('info') || l.includes('clientconnect') || l.includes('serverconnect')) return '#60a5fa';
  if (l.includes('debug'))                                                       return '#6b7280';
  return '#e5e7eb';
}

export function ProxyPage() {
  const [activeService, setActiveService] = useState('mitm');
  const [logs,    setLogs]    = useState<Record<string, string[]>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [metrics, setMetrics] = useState<MitmMetrics | null>(null);
  const [error,   setError]   = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchContainerLogs = async (service: string) => {
    try {
      const data = await fetchJson<ContainerLogResponse | string[]>(`/container-logs?service=${service}&tail=300`, { timeoutMs: 12000 });
      // API returns object {lines, status, ...} or fallback array
      if (Array.isArray(data)) {
        setLogs(prev => ({ ...prev, [service]: data }));
      } else if (data && typeof data === 'object' && 'lines' in data) {
        const resp = data as ContainerLogResponse;
        setLogs(prev => ({ ...prev, [service]: resp.lines }));
        setStatuses(prev => ({ ...prev, [service]: resp.status }));
      }
    } catch {
      // silently keep previous logs on fetch error
    }
  };

  const fetchMitmMetrics = async () => {
    setError('');
    try {
      const metricData = await fetchJson<MitmMetrics>('/mitm/metrics', { timeoutMs: 10000 });
      setMetrics(metricData);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  // On tab switch, immediately fetch that service's logs
  useEffect(() => {
    fetchContainerLogs(activeService);
  }, [activeService]);

  // Auto-refresh active tab every 5s, metrics every 10s
  useEffect(() => {
    fetchMitmMetrics();
    const logIv    = setInterval(() => fetchContainerLogs(activeService), 5000);
    const metricIv = setInterval(fetchMitmMetrics, 10000);
    return () => { clearInterval(logIv); clearInterval(metricIv); };
  }, [activeService]);

  // Auto-scroll when new logs arrive
  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs[activeService]]);

  const currentLines = logs[activeService] ?? [];
  const isOnline = metrics?.status === 'active';
  const containerStatus = statuses[activeService];

  const copyLogs = async () => {
    await navigator.clipboard.writeText(currentLines.join('\n'));
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Container Log Monitor" />

      <div className="p-4 lg:p-6 flex-1 flex flex-col overflow-hidden gap-5">

        {/* Telemetry Cards (MITM-specific, from DB) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-lg border col-span-2 md:col-span-1 flex flex-col gap-2"
            style={{ background: 'var(--bg-card)', borderColor: isOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              {isOnline
                ? <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
                : <XCircle     className="w-4 h-4" style={{ color: '#f87171' }} />}
              MITM Status
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: isOnline ? '#34d399' : '#f87171' }}>
              {metrics?.container_status ?? 'Checking…'}
            </div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Eye className="w-4 h-4" /> Intercepted
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {metrics?.images_intercepted ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>last 1 hour</div>
          </div>

          <div className="p-4 rounded-lg border" style={{
            background: 'var(--bg-card)',
            borderColor: (metrics?.stego_detected ?? 0) > 0 ? 'rgba(239,68,68,0.35)' : 'var(--border-default)',
          }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <AlertTriangle className="w-4 h-4" style={{ color: (metrics?.stego_detected ?? 0) > 0 ? '#f87171' : 'var(--text-muted)' }} />
              STEGO
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (metrics?.stego_detected ?? 0) > 0 ? '#f87171' : '#34d399' }}>
              {metrics?.stego_detected ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>detections</div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} /> Clean
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>
              {metrics?.clean_count ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>verified clean</div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Zap className="w-4 h-4" /> Latency
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa' }}>
              {metrics?.avg_latency_ms != null ? `${metrics.avg_latency_ms}ms` : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>avg processing</div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <ShieldAlert className="w-4 h-4" /> Detection Rate
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: (metrics?.detection_rate ?? 0) > 20 ? '#f87171' : '#fbbf24' }}>
              {metrics?.detection_rate != null ? `${metrics.detection_rate}%` : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>stego / total</div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border p-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5', fontSize: 12 }}>
            ⚠ Metrics unavailable: {error}
          </div>
        )}

        {/* Service tab bar */}
        <div className="flex items-center gap-1 flex-wrap">
          {SERVICES.map(svc => {
            const isActive = activeService === svc.id;
            const svcLines = logs[svc.id];
            return (
              <button
                key={svc.id}
                onClick={() => setActiveService(svc.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
                style={{
                  background:   isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color:        isActive ? svc.color : 'var(--text-muted)',
                  border:       `1px solid ${isActive ? svc.color + '50' : 'var(--border-default)'}`,
                  boxShadow:    isActive ? `0 0 8px ${svc.color}30` : undefined,
                }}
              >
                <span>{svc.icon}</span>
                <span>{svc.label}</span>
                {svcLines && svcLines.length > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: '0 5px', fontSize: 10 }}>
                    {svcLines.length}
                  </span>
                )}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
        </div>

        {/* Terminal Window */}
        <div className="flex-1 rounded-lg border flex flex-col overflow-hidden min-h-0"
          style={{ background: '#0a0a0a', borderColor: 'var(--border-default)' }}>
          <div className="p-3 border-b flex items-center justify-between"
            style={{ borderColor: '#1f2937', background: '#111827' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 font-mono text-xs" style={{ color: '#9ca3af' }}>
                {SERVICES.find(s => s.id === activeService)?.label ?? activeService}
                {' · '}
                {currentLines.length} lines
                {containerStatus && ` · ${containerStatus}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full"
                  style={{ background: containerStatus === 'running' ? '#34d399' : containerStatus ? '#f87171' : '#6b7280' }} />
                <span className="font-mono text-xs"
                  style={{ color: containerStatus === 'running' ? '#34d399' : containerStatus ? '#f87171' : '#6b7280' }}>
                  {containerStatus ?? 'unknown'}
                </span>
              </div>
              <button onClick={copyLogs} className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}>
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button onClick={() => fetchContainerLogs(activeService)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs"
                style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}>
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              <Radio className="w-3 h-3" style={{ color: '#374151' }} />
              <span className="font-mono text-xs" style={{ color: '#6b7280' }}>Live · 5s</span>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs" style={{ color: '#e5e7eb', lineHeight: '1.7' }}>
            {currentLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: '#4b5563' }}>
                <Terminal className="w-8 h-8" />
                <span>Waiting for {SERVICES.find(s => s.id === activeService)?.label ?? activeService} logs…</span>
              </div>
            ) : (
              currentLines.map((line, idx) => (
                <div key={idx} style={{ color: colorForLogLine(line), wordBreak: 'break-all', marginBottom: '2px' }}>
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
