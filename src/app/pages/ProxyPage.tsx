import { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { fetchJson, formatApiError } from '../../lib/api';
import {
  Activity, Server, Radio, ShieldAlert, Copy, RefreshCw,
  CheckCircle2, XCircle, Zap, Eye, AlertTriangle,
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

function colorForLogLine(line: string): string {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('exception') || l.includes('fatal')) return '#f87171';
  if (l.includes('warn'))                                                       return '#facc15';
  if (l.includes('stego'))                                                      return '#f87171';
  if (l.includes('clean') || l.includes('benign'))                             return '#34d399';
  if (l.includes('ambiguous'))                                                  return '#fbbf24';
  if (l.includes('intercepted') || l.includes('image'))                        return '#c084fc';
  if (l.includes('info') || l.includes('clientconnect') || l.includes('serverconnect')) return '#60a5fa';
  return '#e5e7eb';
}

export function ProxyPage() {
  const [logs,    setLogs]    = useState<string[]>([]);
  const [metrics, setMetrics] = useState<MitmMetrics | null>(null);
  const [error,   setError]   = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLogsAndMetrics = async () => {
    setError('');
    try {
      const [logData, metricData] = await Promise.all([
        fetchJson<string[]>('/mitm/logs',    { timeoutMs: 10000 }),
        fetchJson<MitmMetrics>('/mitm/metrics', { timeoutMs: 10000 }),
      ]);
      setLogs(Array.isArray(logData) ? logData : []);
      setMetrics(metricData);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    fetchLogsAndMetrics();
    const iv = setInterval(fetchLogsAndMetrics, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isOnline = metrics?.status === 'active';

  return (
    <div className="h-full flex flex-col">
      <TopBar title="MITM Gateway Monitor" />

      <div className="p-4 lg:p-6 flex-1 flex flex-col overflow-hidden gap-5">

        {/* Telemetry Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">

          {/* Status */}
          <div className="p-4 rounded-lg border col-span-2 md:col-span-1 flex flex-col gap-2"
            style={{ background: 'var(--bg-card)', borderColor: isOnline ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
            <div className="flex items-center gap-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              {isOnline
                ? <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} />
                : <XCircle     className="w-4 h-4" style={{ color: '#f87171' }} />}
              Container Status
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: isOnline ? '#34d399' : '#f87171' }}>
              {metrics?.container_status ?? 'Checking…'}
            </div>
          </div>

          {/* Images intercepted */}
          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Eye className="w-4 h-4" /> Intercepted
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
              {metrics?.images_intercepted ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>last 1 hour</div>
          </div>

          {/* STEGO detected */}
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

          {/* Clean */}
          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <CheckCircle2 className="w-4 h-4" style={{ color: '#34d399' }} /> Clean
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#34d399' }}>
              {metrics?.clean_count ?? '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>verified clean</div>
          </div>

          {/* Avg latency */}
          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Zap className="w-4 h-4" /> Latency
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#60a5fa' }}>
              {metrics?.avg_latency_ms != null ? `${metrics.avg_latency_ms}ms` : '—'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>avg processing</div>
          </div>

          {/* Detection rate */}
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
          <div className="rounded-lg border p-4" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div style={{ fontWeight: 700 }}>MITM logs unavailable</div>
              <button onClick={async () => await navigator.clipboard.writeText(error)}
                className="px-3 py-1 rounded border text-xs flex items-center gap-2"
                style={{ background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(248,113,113,0.35)', color: '#fecaca' }}>
                <Copy className="w-3 h-3" /> Copy diagnostics
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</pre>
          </div>
        )}

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
                stegnar-mitm · {metrics?.total_log_lines ?? 0} lines
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5 items-center">
                <div className="w-2 h-2 rounded-full" style={{ background: isOnline ? '#34d399' : '#f87171' }} />
                <span className="font-mono text-xs" style={{ color: isOnline ? '#34d399' : '#f87171' }}>
                  {isOnline ? 'Live' : 'Offline'}
                </span>
              </div>
              <Radio className="w-3 h-3" style={{ color: '#374151' }} />
              <span className="font-mono text-xs" style={{ color: '#6b7280' }}>MITM Gateway</span>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs" style={{ color: '#e5e7eb', lineHeight: '1.7' }}>
            {logs.length === 0 ? (
              <div className="text-gray-500">
                {error ? `MITM logs unavailable: ${error}` : 'Waiting for MITM gateway logs…'}
              </div>
            ) : (
              logs.map((line, idx) => (
                <div key={idx} style={{ color: colorForLogLine(line), wordBreak: 'break-all', marginBottom: '3px' }}>
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={fetchLogsAndMetrics}
            className="px-3 py-2 rounded-lg border flex items-center gap-2"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

      </div>
    </div>
  );
}
