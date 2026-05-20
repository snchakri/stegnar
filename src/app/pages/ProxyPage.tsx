import { useState, useEffect, useRef } from 'react';
import { TopBar } from '../components/TopBar';
import { fetchJson, formatApiError } from '../../lib/api';
import { Activity, Server, Radio, ShieldAlert, Copy, RefreshCw } from 'lucide-react';

interface ProxyMetrics {
  status: string;
  intercepted_connections: number;
  total_log_lines: number;
  uptime_status: string;
}

export function ProxyPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<ProxyMetrics | null>(null);
  const [error, setError] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  const fetchLogsAndMetrics = async () => {
    setError('');
    try {
      const [logData, metricData] = await Promise.all([
        fetchJson<string[]>('/proxy/logs', { timeoutMs: 10000 }),
        fetchJson<ProxyMetrics>('/proxy/metrics', { timeoutMs: 10000 }),
      ]);
      setLogs(Array.isArray(logData) ? logData : []);
      setMetrics(metricData);
    } catch (e) {
      setError(formatApiError(e));
    }
  };

  useEffect(() => {
    fetchLogsAndMetrics();
    const iv = setInterval(fetchLogsAndMetrics, 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Proxy Activity Monitoring" />

      <div className="p-4 lg:p-6 flex-1 flex flex-col overflow-hidden gap-6">
        
        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Activity className="w-4 h-4" /> Status
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: metrics?.status === 'active' ? '#34d399' : '#f87171' }}>
              {metrics?.uptime_status || 'Checking...'}
            </div>
          </div>
          
          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Radio className="w-4 h-4" /> Interceptions
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {metrics?.intercepted_connections ?? '--'}
            </div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <Server className="w-4 h-4" /> Log Volume
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--text-primary)' }}>
              {metrics?.total_log_lines ?? '--'}
            </div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>
              <ShieldAlert className="w-4 h-4" /> MITM Mode
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: '#60a5fa' }}>
              Transparent (eBPF)
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border p-4" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div style={{ fontWeight: 700 }}>Proxy logs unavailable</div>
              <button onClick={async () => await navigator.clipboard.writeText(error)} className="px-3 py-1 rounded border text-xs flex items-center gap-2" style={{ background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(248,113,113,0.35)', color: '#fecaca' }}>
                <Copy className="w-3 h-3" /> Copy diagnostics
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</pre>
          </div>
        )}

        {/* Terminal Window */}
        <div className="flex-1 rounded-lg border flex flex-col overflow-hidden" style={{ background: '#0a0a0a', borderColor: 'var(--border-default)' }}>
          <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: '#1f2937', background: '#111827' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 font-mono text-xs" style={{ color: '#9ca3af' }}>stegnar-proxy logs (tail -n 100)</span>
            </div>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#34d399' }} />
              <span className="font-mono text-xs" style={{ color: '#34d399' }}>Live</span>
            </div>
          </div>
          
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs" style={{ color: '#e5e7eb', lineHeight: '1.6' }}>
            {logs.length === 0 ? (
              <div className="text-gray-500">proxy logs not available: {error || 'waiting for proxy logs'}</div>
            ) : (
              logs.map((line, idx) => {
                let color = '#e5e7eb';
                if (line.includes('ERROR') || line.includes('Exception')) color = '#f87171';
                else if (line.includes('WARN')) color = '#facc15';
                else if (line.includes('INFO')) color = '#60a5fa';
                else if (line.includes('clientconnect') || line.includes('serverconnect')) color = '#34d399';
                
                return (
                  <div key={idx} style={{ color, wordBreak: 'break-all', marginBottom: '4px' }}>
                    {line}
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={fetchLogsAndMetrics} className="px-3 py-2 rounded-lg border flex items-center gap-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

      </div>
    </div>
  );
}
