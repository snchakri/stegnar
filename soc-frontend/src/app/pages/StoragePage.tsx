// ─── StoragePage.tsx ──────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { TopBar } from '../components/TopBar';
import { apiUrl, minioUrl } from '../../lib/config';
import { fetchJson, formatApiError } from '../../lib/api';
import { Folder, File, ChevronRight, X, Download } from 'lucide-react';
import { artifactDownloadUrl } from '../../lib/config';

interface StorageFile {
  name: string;
  size: number;
  last_modified: string;
  is_dir: boolean;
  type: string;
}

interface Bucket {
  name: string;
  file_count: number;
  files: StorageFile[];
}

const fmtSize = (b: number) => {
  if (!b) return '—';
  if (b >= 1e6) return (b/1e6).toFixed(1) + ' MB';
  return Math.round(b/1024) + ' KB';
};

export function StoragePage() {
  const navigate = useNavigate();
  const [buckets,     setBuckets]     = useState<Bucket[]>([]);
  const [selected,    setSelected]    = useState<string>('');
  const [selectedFile,setSelectedFile]= useState<StorageFile | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  useEffect(() => {
    fetchJson<Bucket[]>('/storage/buckets', { timeoutMs: 10000 })
      .then((data: Bucket[]) => {
        setBuckets(data);
        if (data.length > 0) setSelected(data[0].name);
        setLoading(false);
        setError('');
      })
      .catch((e) => {
        setError(formatApiError(e));
        setBuckets([
          { name: 'stegnar-artifacts', file_count: 0, files: [] },
          { name: 'stegnar-pcaps',     file_count: 0, files: [] },
        ]);
        setSelected('stegnar-artifacts');
        setLoading(false);
      });
  }, []);

  const currentBucket = buckets.find(b => b.name === selected);
  const currentFiles  = currentBucket?.files ?? [];

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Storage Browser" />
      <div className="flex-1 flex overflow-hidden">

        {/* Bucket sidebar */}
        <div className="w-60 border-r flex flex-col" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>Buckets</h3>
          </div>
          <div className="flex-1 overflow-auto p-2">
            {buckets.map(b => (
              <button key={b.name} onClick={() => { setSelected(b.name); setSelectedFile(null); }}
                className="w-full text-left p-3 rounded-lg mb-1 transition-all"
                style={{ background: selected === b.name ? 'var(--bg-hover)' : 'transparent', borderLeft: `3px solid ${selected === b.name ? 'var(--accent)' : 'transparent'}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Folder className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 'var(--text-sm)', fontFamily: 'monospace', color: selected === b.name ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: selected === b.name ? 500 : 400 }}>
                    {b.name}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.file_count} files</div>
              </button>
            ))}
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{selected}</span>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>/</span>
          </div>
          <div className="flex-1 overflow-auto">
            {error && (
              <div className="p-4">
                <div className="rounded-lg border p-3" style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                  storage unavailable: {error}
                </div>
              </div>
            )}
            {loading ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading MinIO…</div>
            ) : currentFiles.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
                <div>No files yet — waiting for captures</div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                    {['NAME', 'SIZE', 'LAST MODIFIED'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: h==='SIZE'?'right':'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentFiles.map((f, i) => (
                    <tr key={f.name} onClick={() => !f.is_dir && setSelectedFile(f)}
                      className={!f.is_dir ? 'cursor-pointer table-row-hover' : ''}
                      style={{ background: i%2===0?'transparent':'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div className="flex items-center gap-2">
                          {f.is_dir ? <Folder className="w-4 h-4" style={{ color: 'var(--accent)' }} /> : <File className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: f.is_dir ? 'inherit' : 'monospace' }}>{f.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtSize(f.size)}</td>
                      <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{(f.last_modified||'').slice(0,19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* File detail panel */}
        {selectedFile && (
          <div className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-80 border-l flex flex-col drawer-slide-in z-30"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>File Info</h3>
              <button onClick={() => setSelectedFile(null)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {selectedFile.name.match(/\.(jpg|jpeg|png|bmp)$/i) && (
                <div className="rounded-lg border flex items-center justify-center" style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', height: 200 }}>
                  <img
                    src={minioUrl(`${selected}/${selectedFile.name}`)}
                    alt={selectedFile.name}
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                    onError={e => { (e.target as HTMLImageElement).style.display='none'; }}
                  />
                </div>
              )}
              {[
                { label: 'Name',          value: selectedFile.name },
                { label: 'Size',          value: fmtSize(selectedFile.size) },
                { label: 'Last Modified', value: (selectedFile.last_modified||'').slice(0,19) },
                { label: 'Bucket',        value: selected },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: label==='Name'?'monospace':'inherit', marginTop: 2 }}>{value}</div>
                </div>
              ))}
              {/* Download button — always shown for any file */}
              <button
                onClick={() => {
                  const s3Uri = `s3://${selected}/${selectedFile.name}`;
                  const url   = artifactDownloadUrl(s3Uri);
                  const a     = document.createElement('a');
                  a.href      = url;
                  a.download  = selectedFile.name;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }}
                className="w-full p-3 rounded-lg border flex items-center gap-2"
                style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: '#34d399', cursor: 'pointer' }}>
                <Download className="w-4 h-4" />
                <span style={{ fontSize: 'var(--text-sm)' }}>Download {selectedFile.name.split('.').pop()?.toUpperCase() || 'File'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`
        .table-row-hover:hover { background: var(--bg-hover) !important; }
        .drawer-slide-in { animation: slideIn 200ms ease-out; }
        @keyframes slideIn { from{transform:translateX(100%);} to{transform:translateX(0);} }
      `}</style>
    </div>
  );
}