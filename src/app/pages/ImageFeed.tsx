import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { initWebSocket } from '../../lib/websocket';
import { apiUrl, minioUrl } from '../../lib/config';
import { TopBar } from '../components/TopBar';
import { Search, RefreshCw, X, FileText, Network, Download } from 'lucide-react';

interface ImageRecord {
  id: string;
  sha256_hash: string;
  calpa_score: number;          // 0.0–1.0 from server
  classification: string;       // 'malicious'|'benign'|'suspicious'
  first_seen_ts: string;
  minio_img_uri: string | null;
  minio_pcap_uri: string | null;
  endpoint_id: string | null;
  src_ip: string | null;
  dst_ip: string | null;
  stream_id: string | null;
  latency_ms: number | null;
  model_type: string | null;
}

function classColor(cls: string) {
  const upper = String(cls).toUpperCase();
  if (upper === 'STEGO' || upper === 'MALICIOUS')      return { bg: 'rgba(239,68,68,0.1)',  text: '#f87171' };
  if (upper === 'AMBIGUOUS' || upper === 'SUSPICIOUS') return { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' };
  return                                               { bg: 'rgba(16,185,129,0.1)', text: '#34d399' };
}

export function ImageFeed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [images,      setImages]      = useState<ImageRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<ImageRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState(searchParams.get('classification') || 'all');

  const fetchImages = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('classification', classFilter);
    if (searchQuery)           params.set('hash', searchQuery);

    fetch(apiUrl(`/images?${params}`))
      .then(r => r.json())
      .then((data: ImageRecord[]) => { setImages(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchImages();
    const iv = window.setInterval(fetchImages, 5000);
    return () => window.clearInterval(iv);
  }, [classFilter, searchQuery]);
  useEffect(() => {
    const unsubscribe = initWebSocket((img: any) => {
      setImages(prev => [img, ...prev]);
    });
    return () => unsubscribe();
  }, []);
  return (
    <div className="h-full flex flex-col">
      <TopBar title="Image Feed" />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">

          {/* Filter bar */}
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && fetchImages()}
                placeholder="Search by SHA-256 hash…"
                className="w-full pl-10 pr-4 py-2 rounded-lg border"
                style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
              />
            </div>
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
              <option value="all">All Classifications</option>
              <option value="malicious">Malicious (STEGO)</option>
              <option value="suspicious">Suspicious</option>
              <option value="benign">Benign (CLEAN)</option>
            </select>
            <button onClick={fetchImages} className="p-2 rounded-lg border"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto p-4 lg:p-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <div className="h-48 animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                    <div className="p-4 space-y-2">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                  <div>No images found. Is the server running?</div>
                  <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>curl {apiUrl('/health')}</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map(img => {
                  const c = classColor(img.classification);
                  return (
                    <button key={img.id || img.sha256_hash} onClick={() => setSelected(img)}
                      className="rounded-lg border overflow-hidden transition-all hover:-translate-y-1 text-left"
                      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                      <div className="h-48 flex items-center justify-center" style={{ background: 'var(--bg-sidebar)' }}>
                        {img.minio_img_uri ? (
                          <img src={minioUrl(img.minio_img_uri)} alt="intercepted"
                            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No Preview</div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                            {img.classification}
                          </span>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: img.calpa_score > 0.7 ? '#f87171' : 'var(--text-primary)' }}>
                            {(img.calpa_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(img.sha256_hash || '').slice(0, 20)}…
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                          {img.endpoint_id || 'unknown endpoint'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Detail drawer */}
        {selected && (
          <div className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
            style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Image Details</h3>
              <button onClick={() => setSelected(null)}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Image preview */}
              <div className="rounded-lg border flex items-center justify-center"
                style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', height: 200 }}>
                {selected.minio_img_uri ? (
                  <img src={minioUrl(selected.minio_img_uri)} alt="intercepted"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>No image preview</div>
                )}
              </div>

              {/* Classification + score */}
              {[
                { label: 'Classification', value: selected.classification, isVerdict: true },
                { label: 'CALPA Score',    value: `${(selected.calpa_score * 100).toFixed(2)}%` },
                { label: 'Model Type',     value: selected.model_type || 'srnet' },
                { label: 'Latency',        value: selected.latency_ms ? `${selected.latency_ms}ms` : '—' },
              ].map(({ label, value, isVerdict }) => {
                const c = isVerdict ? classColor(selected.classification) : null;
                return (
                  <div key={label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-sidebar)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</span>
                    {c ? (
                      <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{value}</span>
                    ) : (
                      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
                    )}
                  </div>
                );
              })}

              {/* Network context */}
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Network Context</div>
              {[
                { label: 'Endpoint',    value: selected.endpoint_id },
                { label: 'Source IP',   value: selected.src_ip },
                { label: 'Destination', value: selected.dst_ip },
                { label: 'Session',     value: selected.stream_id },
              ].map(({ label, value }) => (
                <div key={label} className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2 }}>
                    {value || '—'}
                  </div>
                </div>
              ))}

              {/* SHA256 */}
              <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SHA-256</div>
                <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
                  {selected.sha256_hash}
                </div>
              </div>

              {/* Download buttons */}
              <div className="space-y-2">
                {selected.minio_img_uri && (
                  <button
                    onClick={() => {
                      const url = minioUrl(selected.minio_img_uri!);
                      const a   = document.createElement('a');
                      a.href     = url;
                      a.download = `${selected.sha256_hash?.slice(0, 12) ?? 'image'}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="w-full p-3 rounded-lg border flex items-center gap-2"
                    style={{ background: 'var(--bg-sidebar)', borderColor: 'rgba(52,211,153,0.35)', color: '#34d399', cursor: 'pointer' }}>
                    <Download className="w-4 h-4" />
                    <span style={{ fontSize: 'var(--text-sm)' }}>Download Image</span>
                  </button>
                )}
                {selected.minio_pcap_uri && (
                  <button
                    onClick={() => {
                      const url = minioUrl(selected.minio_pcap_uri!);
                      const a   = document.createElement('a');
                      a.href     = url;
                      a.download = `${selected.sha256_hash?.slice(0, 12) ?? 'capture'}.pcap`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                    }}
                    className="w-full p-3 rounded-lg border flex items-center gap-2"
                    style={{ background: 'var(--bg-sidebar)', borderColor: 'rgba(96,165,250,0.35)', color: '#60a5fa', cursor: 'pointer' }}>
                    <Download className="w-4 h-4" />
                    <span style={{ fontSize: 'var(--text-sm)' }}>Download PCAP</span>
                  </button>
                )}
              </div>

              {/* Navigation buttons */}
              <div className="space-y-2">
                <button onClick={() => navigate(`/logs?component=${selected.endpoint_id || ''}`)}
                  className="w-full p-3 rounded-lg border flex items-center gap-2"
                  style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>View in Logs</span>
                </button>
                <button onClick={() => navigate('/database')}
                  className="w-full p-3 rounded-lg border flex items-center gap-2"
                  style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer' }}>
                  <Network className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 'var(--text-sm)' }}>View Network Activity</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .drawer-slide-in { animation: slideIn 200ms ease-out; }
        @keyframes slideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.5;} }
        .animate-pulse { animation: pulse 1.5s infinite; }
      `}</style>
    </div>
  );
}