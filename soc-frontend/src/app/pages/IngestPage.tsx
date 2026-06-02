import { useEffect, useMemo, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { fetchJson, formatApiError, postForm } from '../../lib/api';
import { FileUp, ShieldAlert, Cpu, Copy, RefreshCw } from 'lucide-react';

export function IngestPage() {
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgResult, setImgResult] = useState<any>(null);
  const [imageLoading,    setImageLoading]    = useState(false);
  const [pcapLoading,     setPcapLoading]     = useState(false);
  const [pcapPlainLoading,setPcapPlainLoading]= useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobsError, setJobsError] = useState('');
  const [jobsLoading, setJobsLoading] = useState(false);

  const [pcapFile, setPcapFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [pcapPlainFile, setPcapPlainFile] = useState<File | null>(null);

  const anyLoading = imageLoading || pcapLoading || pcapPlainLoading;

  const pollJob = async (jobId: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      let job: any;
      try {
        job = await fetchJson<any>(`/ingest/jobs/${jobId}`, { timeoutMs: 10000 });
      } catch (err: any) {
        if (err.name === 'ApiError' && err.status === 404) {
          throw new Error('Ingest job not found (it may have been lost during a server restart).');
        }
        throw err;
      }
      if (job.status === 'completed') {
        const result = job.result || {};
        return {
          classification: result.classification || result.predicted_label || 'UNKNOWN',
          confidence: result.confidence ?? 0,
          inference_time_ms: result.latency_ms ?? 0,
          message: result.message || 'Analysis completed',
        };
      }
      if (job.status === 'failed') throw new Error(job.error || 'Ingest job failed');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Timed out waiting for ingest job completion');
  };

  const loadJobs = async () => {
    setJobsLoading(true);
    setJobsError('');
    try {
      const data = await fetchJson<any[]>(`/ingest/jobs?limit=12`, { timeoutMs: 10000 });
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      setJobsError(formatApiError(e));
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();
    const iv = window.setInterval(loadJobs, 5000);
    return () => window.clearInterval(iv);
  }, []);

  const latestJob = useMemo(() => jobs[0] ?? null, [jobs]);

  const handleImageUpload = async () => {
    if (!imgFile) return;
    setImageLoading(true);
    setError('');
    setImgResult(null);
    try {
      const formData = new FormData();
      formData.append('file', imgFile);
      const data = await postForm<{ job_id?: string; status?: string }>('/ingest/image', formData, 60000);
      if (!data.job_id) throw new Error('No ingest job returned');
      const finalResult = await pollJob(data.job_id);
      setImgResult(finalResult);
      await loadJobs();
    } catch (e: any) {
      setError(formatApiError(e));
    } finally {
      setImageLoading(false);
    }
  };

  const handlePcapUpload = async () => {
    if (!pcapFile || !keyFile) return;
    setPcapLoading(true);
    setError('');
    setImgResult(null);
    try {
      const formData = new FormData();
      formData.append('pcap', pcapFile);
      formData.append('keys', keyFile);
      const data = await postForm<{ job_id?: string; status?: string }>('/ingest/pcap', formData, 60000);
      if (!data.job_id) throw new Error('No ingest job returned');
      const finalResult = await pollJob(data.job_id);
      setImgResult(finalResult);
      await loadJobs();
    } catch (e: any) {
      setError(formatApiError(e));
    } finally {
      setPcapLoading(false);
    }
  };

  const handlePcapPlainUpload = async () => {
    if (!pcapPlainFile) return;
    setPcapPlainLoading(true);
    setError('');
    setImgResult(null);
    try {
      const formData = new FormData();
      formData.append('pcap', pcapPlainFile);
      const data = await postForm<{ job_id?: string; status?: string }>('/ingest/pcap-plain', formData, 60000);
      if (!data.job_id) throw new Error('No ingest job returned');
      const finalResult = await pollJob(data.job_id);
      setImgResult(finalResult);
      await loadJobs();
    } catch (e: any) {
      setError(formatApiError(e));
    } finally {
      setPcapPlainLoading(false);
    }
  };

  const renderLogBlock = (title: string, text?: string) => {
    const value = (text || '').trim();
    if (!value) return null;
    return (
      <div className="rounded-lg border p-3" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)' }}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 700 }}>{title}</div>
          <button
            onClick={async () => await navigator.clipboard.writeText(value)}
            className="px-2 py-1 rounded border text-xs flex items-center gap-1"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
        <pre style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflow: 'auto' }}>{value}</pre>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Ingest Debug & Analysis" />
      
      <div className="p-6 flex-1 overflow-auto flex flex-col items-center">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          
          {/* Direct Image Upload Card */}
          <div className="rounded-xl border p-6 flex flex-col gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border-default)' }}>
              <div className="p-2 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <Cpu style={{ color: 'var(--accent)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Direct Image Analysis</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Spin up a container and query CALPA-NET</p>
              </div>
            </div>

            <div className="flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 gap-3 transition-colors" 
                 style={{ borderColor: 'var(--border-default)', background: 'var(--bg-sidebar)' }}>
              <FileUp size={32} style={{ color: 'var(--text-muted)' }} />
              <input type="file" accept="image/*" id="img-upload" className="hidden" onChange={e => setImgFile(e.target.files?.[0] || null)} />
              <label htmlFor="img-upload" className="cursor-pointer px-4 py-2 rounded font-medium text-sm transition-colors hover:bg-opacity-80"
                     style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                {imgFile ? imgFile.name : 'Select Image File'}
              </label>
            </div>

            <button onClick={handleImageUpload} disabled={!imgFile || imageLoading || anyLoading}
                    className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
              {imageLoading ? 'Analyzing via CALPA-NET...' : 'Run Analysis'}
            </button>
          </div>

          {/* PCAP Upload Card */}
          <div className="rounded-xl border p-6 flex flex-col gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border-default)' }}>
              <div className="p-2 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <ShieldAlert style={{ color: 'var(--accent)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Forensic PCAP Extraction</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Extract image from PCAP using SSL logs</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 flex-1">
              <div className="border-2 border-dashed rounded-lg flex items-center justify-between p-4" style={{ borderColor: 'var(--border-default)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>1. Select .pcap / .pcapng</span>
                <input type="file" id="pcap-upload" className="hidden" onChange={e => setPcapFile(e.target.files?.[0] || null)} />
                <label htmlFor="pcap-upload" className="cursor-pointer px-3 py-1 text-xs rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                  {pcapFile ? pcapFile.name : 'Browse'}
                </label>
              </div>
              
              <div className="border-2 border-dashed rounded-lg flex items-center justify-between p-4" style={{ borderColor: 'var(--border-default)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>2. Select sslkeylogfile</span>
                <input type="file" id="key-upload" className="hidden" onChange={e => setKeyFile(e.target.files?.[0] || null)} />
                <label htmlFor="key-upload" className="cursor-pointer px-3 py-1 text-xs rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                  {keyFile ? keyFile.name : 'Browse'}
                </label>
              </div>
            </div>

            <button onClick={handlePcapUpload} disabled={!pcapFile || !keyFile || pcapLoading || anyLoading}
                    className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
              {pcapLoading ? 'Reconstructing & Analyzing...' : 'Extract & Analyze'}
            </button>
          </div>

          {/* PCAP Upload (No Keys) Card */}
          <div className="rounded-xl border p-6 flex flex-col gap-4" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="flex items-center gap-3 border-b pb-4" style={{ borderColor: 'var(--border-default)' }}>
              <div className="p-2 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <ShieldAlert style={{ color: 'var(--accent)' }} size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>PCAP (No Encryption)</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Upload PCAP/PCAPNG with unencrypted image traffic</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 flex-1">
              <div className="border-2 border-dashed rounded-lg flex items-center justify-between p-4" style={{ borderColor: 'var(--border-default)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>1. Select .pcap / .pcapng</span>
                <input type="file" id="pcap-plain-upload" className="hidden" onChange={e => setPcapPlainFile(e.target.files?.[0] || null)} />
                <label htmlFor="pcap-plain-upload" className="cursor-pointer px-3 py-1 text-xs rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}>
                  {pcapPlainFile ? pcapPlainFile.name : 'Browse'}
                </label>
              </div>
            </div>

            <button onClick={handlePcapPlainUpload} disabled={!pcapPlainFile || pcapPlainLoading || anyLoading}
                    className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
              {pcapPlainLoading ? 'Extracting & Analyzing...' : 'Extract & Analyze'}
            </button>
          </div>
        </div>

        {/* Results Banner */}
        {error && (
          <div className="mt-8 p-4 rounded-lg border w-full max-w-4xl" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div style={{ fontWeight: 700 }}>Friendly error</div>
              <button onClick={async () => await navigator.clipboard.writeText(error)} className="px-3 py-1 rounded border text-xs flex items-center gap-2" style={{ background: 'rgba(17,24,39,0.5)', borderColor: 'rgba(248,113,113,0.35)', color: '#fecaca' }}>
                <Copy className="w-3 h-3" /> Copy diagnostics
              </button>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error}</pre>
          </div>
        )}

        {imgResult && (
          <div className="mt-8 w-full max-w-4xl rounded-xl border p-6 flex flex-col gap-4 animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <h3 className="font-semibold text-lg text-center" style={{ color: 'var(--text-primary)' }}>Analysis Result</h3>
            <div className="flex justify-center gap-12">
              <div className="text-center">
                <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Classification</div>
                <div className={`text-2xl font-bold px-4 py-1 rounded-full ${
                  ['STEGO', 'MALICIOUS'].includes(imgResult.classification?.toUpperCase())
                    ? 'bg-red-900/30 text-red-400'
                    : ['AMBIGUOUS', 'SUSPICIOUS'].includes(imgResult.classification?.toUpperCase())
                      ? 'bg-yellow-900/30 text-yellow-400'
                      : 'bg-green-900/30 text-green-400'
                }`}>
                  {imgResult.classification?.toUpperCase() || 'UNKNOWN'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Confidence</div>
                <div className="text-2xl font-mono text-white">
                  {(imgResult.confidence * 100).toFixed(2)}%
                </div>
              </div>
            </div>
            <div className="text-center text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {imgResult.message} ({(imgResult.inference_time_ms || 0).toFixed(2)} ms)
            </div>
          </div>
        )}

        <div className="mt-10 w-full max-w-6xl rounded-xl border p-6" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Recent ingest jobs</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Latest jobs with raw worker stdout/stderr and failure details.</p>
            </div>
            <button onClick={loadJobs} className="px-3 py-2 rounded-lg border flex items-center gap-2" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}>
              <RefreshCw className={`w-4 h-4 ${jobsLoading ? 'animate-spin' : ''}`} /> Refresh jobs
            </button>
          </div>

          {jobsError && (
            <div className="mb-4 rounded-lg border p-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
              {jobsError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {jobs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>No ingest jobs yet.</div>
            ) : (
              jobs.map((job) => (
                <div key={job.job_id} className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)' }}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{job.filename || job.job_id}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{job.job_id} • {job.status}</div>
                    </div>
                    <div style={{ color: job.status === 'completed' ? '#34d399' : job.status === 'failed' ? '#f87171' : '#fbbf24', fontWeight: 700 }}>
                      {job.status}
                    </div>
                  </div>
                  {job.error && renderLogBlock('Error', String(job.error))}
                  {job.worker_stdout && renderLogBlock('Worker stdout', String(job.worker_stdout))}
                  {job.worker_stderr && renderLogBlock('Worker stderr', String(job.worker_stderr))}
                  {job.result && (
                    <pre className="rounded-lg border p-3 text-xs overflow-auto" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(job.result, null, 2)}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}