import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { apiUrl } from '../../lib/config';
import { Upload, FileUp, ShieldAlert, Cpu } from 'lucide-react';

export function IngestPage() {
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgResult, setImgResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [pcapFile, setPcapFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);

  const handleImageUpload = async () => {
    if (!imgFile) return;
    setLoading(true);
    setError('');
    setImgResult(null);
    try {
      const formData = new FormData();
      formData.append('file', imgFile);
      const res = await fetch(apiUrl('/ingest/image'), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setImgResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePcapUpload = async () => {
    if (!pcapFile || !keyFile) return;
    setLoading(true);
    setError('');
    setImgResult(null);
    try {
      const formData = new FormData();
      formData.append('pcap', pcapFile);
      formData.append('keys', keyFile);
      const res = await fetch(apiUrl('/ingest/pcap'), {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setImgResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Manual Ingestion & Analysis" />
      
      <div className="p-6 flex-1 overflow-auto flex flex-col items-center">
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
          
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

            <button onClick={handleImageUpload} disabled={!imgFile || loading}
                    className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}>
              {loading ? 'Analyzing via CALPA-NET...' : 'Run Analysis'}
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

            <button onClick={handlePcapUpload} disabled={!pcapFile || !keyFile || loading}
                    className="w-full py-3 rounded-lg font-semibold transition-all disabled:opacity-50"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
              {loading ? 'Reconstructing & Analyzing...' : 'Extract & Analyze'}
            </button>
          </div>
        </div>

        {/* Results Banner */}
        {error && (
          <div className="mt-8 p-4 rounded-lg bg-red-900/20 text-red-400 border border-red-900/50 w-full max-w-4xl text-center">
            {error}
          </div>
        )}

        {imgResult && (
          <div className="mt-8 w-full max-w-4xl rounded-xl border p-6 flex flex-col gap-4 animate-fade-in" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <h3 className="font-semibold text-lg text-center" style={{ color: 'var(--text-primary)' }}>Analysis Result</h3>
            <div className="flex justify-center gap-12">
              <div className="text-center">
                <div className="text-sm uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Classification</div>
                <div className={`text-2xl font-bold px-4 py-1 rounded-full ${imgResult.classification?.toUpperCase() === 'MALICIOUS' ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
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
      </div>
    </div>
  );
}