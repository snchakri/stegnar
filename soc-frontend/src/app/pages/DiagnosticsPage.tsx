import { useEffect, useState } from 'react';
import { Copy, RefreshCw, ShieldAlert } from 'lucide-react';
import { TopBar } from '../components/TopBar';
import { fetchJson, formatApiError } from '../../lib/api';

function JsonBlock({ title, value }: { title: string; value: unknown }) {
	const [copied, setCopied] = useState(false);
	const text = JSON.stringify(value, null, 2);
	return (
		<div className="rounded-xl border p-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
			<div className="flex items-center justify-between gap-3 mb-3">
				<div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</div>
				<button
					onClick={async () => {
						await navigator.clipboard.writeText(text);
						setCopied(true);
						window.setTimeout(() => setCopied(false), 1200);
					}}
					className="px-3 py-1 rounded border text-xs flex items-center gap-2"
					style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
				>
					<Copy className="w-3 h-3" /> {copied ? 'Copied' : 'Copy'}
				</button>
			</div>
			<pre className="overflow-auto text-xs p-3 rounded" style={{ background: 'var(--bg-sidebar)', color: 'var(--text-primary)', maxHeight: 320, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
				{text}
			</pre>
		</div>
	);
}

export function DiagnosticsPage() {
	const [data, setData] = useState<any>(null);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const diagnostics = await fetchJson<any>('/admin/diagnostics', { timeoutMs: 20000 });
			const [health, proxyMetrics, pipeline, dbTables, storageBuckets] = await Promise.all([
				fetchJson('/health', { timeoutMs: 10000 }),
				fetchJson('/proxy/metrics', { timeoutMs: 10000 }),
				fetchJson('/metrics/pipeline', { timeoutMs: 10000 }),
				fetchJson('/db/tables', { timeoutMs: 10000 }),
				fetchJson('/storage/buckets', { timeoutMs: 10000 }),
			]);
			setData({ ...diagnostics, health, proxyMetrics, pipeline, dbTables, storageBuckets });
		} catch (e) {
			setError(formatApiError(e));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	return (
		<div className="h-full flex flex-col">
			<TopBar title="Diagnostics & Runtime Health" />
			<div className="p-6 flex-1 overflow-auto space-y-6">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2" style={{ color: 'var(--text-primary)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
							<ShieldAlert className="w-5 h-5" /> Admin diagnostics
						</div>
						<div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Aggregated health, proxy, pipeline, MinIO, DB counts, and raw soc-api logs.</div>
					</div>
					<button onClick={load} className="px-4 py-2 rounded-lg border flex items-center gap-2" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
						<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
					</button>
				</div>

				{error && (
					<div className="rounded-xl border p-4" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
						<div style={{ fontWeight: 700, marginBottom: 8 }}>Diagnostics unavailable</div>
						<pre style={{ whiteSpace: 'pre-wrap' }}>{error}</pre>
					</div>
				)}

				{data && (
					<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
						<JsonBlock title="/api/health" value={data.health} />
						<JsonBlock title="/api/proxy/metrics" value={data.proxyMetrics} />
						<JsonBlock title="/api/metrics/pipeline" value={data.pipeline} />
						<JsonBlock title="docker environment" value={{ docker_available: data.docker_available, docker_version: data.docker_version, ingest_network: data.ingest_network, ingest_mitm_container: data.ingest_mitm_container, docker_networks: data.docker_networks }} />
						<JsonBlock title="DB table counts" value={data.dbTables} />
						<JsonBlock title="MinIO buckets" value={data.storageBuckets} />
						<JsonBlock title="Raw soc-api logs" value={data.soc_api_logs} />
						<JsonBlock title="Raw proxy logs" value={data.proxy_logs} />
					</div>
				)}
			</div>
		</div>
	);
}
