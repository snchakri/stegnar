import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { initWebSocket } from '../../lib/websocket';
import { apiUrl, artifactDownloadUrl, artifactRedirectUrl } from '../../lib/config';
import { TopBar } from '../components/TopBar';
import { Search, RefreshCw, X, FileText, Network, Download, ExternalLink } from 'lucide-react';

interface ImageRecord {
  id: string;
  sha256_hash: string;
  calpa_score: number;
  classification: string;
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
  if (cls === 'malicious')  return { bg: 'rgba(239,68,68,0.1)',  text: '#f87171' };
  if (cls === 'suspicious') return { bg: 'rgba(245,158,11,0.1)', text: '#fbbf24' };
  return                           { bg: 'rgba(16,185,129,0.1)', text: '#34d399' };
}

// ── Resolve a s3:// URI into a working HTTP preview URL via API ──────────────
function usePresignedUrl(s3Uri: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!s3Uri || !s3Uri.startsWith('s3://')) { setUrl(null); return; }
    fetch(apiUrl(`/artifact-url?uri=${encodeURIComponent(s3Uri)}`))
      .then(r => r.json())
      .then(d => { if (d.url) setUrl(d.url); })
      .catch(() => setUrl(null));
  }, [s3Uri]);
  return url;
}

// ── Single card with lazy-loaded presigned image preview ─────────────────────
function ImageCard({ img, onClick }: { img: ImageRecord; onClick: () => void }) {
  const previewUrl = usePresignedUrl(img.minio_img_uri);
  const c = classColor(img.classification);

  return (
    <button
      onClick={onClick}
      className="rounded-lg border overflow-hidden transition-all hover:-translate-y-1 text-left w-full"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="h-48 flex items-center justify-center relative" style={{ background: 'var(--bg-sidebar)' }}>
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="intercepted"
            style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>
            {img.minio_img_uri ? '⏳ Loading…' : '🔒 No Preview'}
          </div>
        )}
        {/* Classification badge overlay */}
        <div style={{ position: 'absolute', top: 8, right: 8, background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backdropFilter: 'blur(4px)' }}>
          {img.classification === 'malicious' ? '⚠ STEGO' : img.classification === 'suspicious' ? '~ AMBIGUOUS' : '✓ CLEAN'}
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span style={{ background: c.bg, color: c.text, padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
            {img.classification}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: img.calpa_score > 0.7 ? '#f87171' : 'var(--text-primary)' }}>
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
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function ImageDrawer({ img, onClose, navigate }: { img: ImageRecord; onClose: () => void; navigate: any }) {
  const previewUrl = usePresignedUrl(img.minio_img_uri);
  const c = classColor(img.classification);

  const handleDownloadImage = () => {
    if (!img.minio_img_uri) return;
    const url = artifactDownloadUrl(img.minio_img_uri);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = img.sha256_hash?.slice(0, 12) + '.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPcap = () => {
    if (!img.minio_pcap_uri) return;
    const url = artifactDownloadUrl(img.minio_pcap_uri);
    const a   = document.createElement('a');
    a.href    = url;
    a.download = img.sha256_hash?.slice(0, 12) + '.pcap';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenImage = () => {
    if (previewUrl) window.open(previewUrl, '_blank');
  };

  return (
    <div
      className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}
    >
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
        <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Image Details</h3>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} /></button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Image preview */}
        <div className="rounded-lg border flex items-center justify-center relative overflow-hidden"
          style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', height: 220 }}>
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="intercepted"
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              onError={e => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : img.minio_img_uri ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>⏳</div>
              Loading preview…
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
              No preview available
            </div>
          )}
        </div>

        {/* Classification + score */}
        {[
          { label: 'Classification', value: (img.classification || 'UNKNOWN').toUpperCase(), isVerdict: true },
          { label: 'CALPA Score',    value: img.calpa_score !== null && img.calpa_score !== undefined ? `${(img.calpa_score * 100).toFixed(2)}%` : '—' },
          { label: 'Model Type',     value: (img.model_type || 'srnet').toUpperCase() },
          { label: 'Latency',        value: img.latency_ms ? `${img.latency_ms}ms` : '—' },
          { label: 'Timestamp',      value: (img.first_seen_ts || '').slice(0, 19).replace('T', ' ') },
        ].map(({ label, value, isVerdict }) => {
          const vc = isVerdict ? classColor(img.classification) : null;
          return (
            <div key={label} className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-sidebar)' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</span>
              {vc ? (
                <span style={{ background: vc.bg, color: vc.text, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{value}</span>
              ) : (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
              )}
            </div>
          );
        })}

        {/* Network context */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.05em' }}>Network Context</div>
        {[
          { label: 'Endpoint',    value: img.endpoint_id },
          { label: 'Source IP',   value: img.src_ip },
          { label: 'Destination', value: img.dst_ip },
          { label: 'Session ID',  value: img.stream_id },
        ].map(({ label, value }) => (
          <div key={label} className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2 }}>{value || '—'}</div>
          </div>
        ))}

        {/* SHA256 */}
        <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>SHA-256</div>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: 2, wordBreak: 'break-all' }}>
            {img.sha256_hash}
          </div>
        </div>

        {/* Download / open buttons */}
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Artifacts</div>
        <div className="space-y-2">
          <button
            onClick={handleOpenImage}
            disabled={!previewUrl}
            className="w-full p-3 rounded-lg border flex items-center gap-2"
            style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: previewUrl ? 'var(--text-primary)' : 'var(--text-muted)', cursor: previewUrl ? 'pointer' : 'not-allowed', opacity: previewUrl ? 1 : 0.5 }}
          >
            <ExternalLink className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 'var(--text-sm)' }}>Open Image in New Tab</span>
          </button>

          <button
            onClick={handleDownloadImage}
            disabled={!img.minio_img_uri}
            className="w-full p-3 rounded-lg border flex items-center gap-2"
            style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: img.minio_img_uri ? '#34d399' : 'var(--text-muted)', cursor: img.minio_img_uri ? 'pointer' : 'not-allowed', opacity: img.minio_img_uri ? 1 : 0.5 }}
          >
            <Download className="w-4 h-4" />
            <span style={{ fontSize: 'var(--text-sm)' }}>Download Image (.jpg)</span>
          </button>

          <button
            onClick={handleDownloadPcap}
            disabled={!img.minio_pcap_uri}
            className="w-full p-3 rounded-lg border flex items-center gap-2"
            style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: img.minio_pcap_uri ? '#60a5fa' : 'var(--text-muted)', cursor: img.minio_pcap_uri ? 'pointer' : 'not-allowed', opacity: img.minio_pcap_uri ? 1 : 0.5 }}
          >
            <Download className="w-4 h-4" />
            <span style={{ fontSize: 'var(--text-sm)' }}>Download PCAP (.pcap)</span>
          </button>
        </div>

        {/* Navigation buttons */}
        <div className="space-y-2">
          <button
            onClick={() => navigate(`/logs?component=${img.endpoint_id || ''}`)}
            className="w-full p-3 rounded-lg border flex items-center gap-2"
            style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 'var(--text-sm)' }}>View Endpoint Logs</span>
          </button>
          <button
            onClick={() => navigate('/database')}
            className="w-full p-3 rounded-lg border flex items-center gap-2"
            style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', cursor: 'pointer' }}
          >
            <Network className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 'var(--text-sm)' }}>View Network Activity</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function ImageFeed() {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();

  const [images,      setImages]      = useState<ImageRecord[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState<ImageRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState(searchParams.get('classification') || 'all');

  const fetchImages = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== 'all') params.set('classification', classFilter);
    if (searchQuery)            params.set('hash', searchQuery);

    fetch(apiUrl(`/images?${params}`))
      .then(r => r.json())
      .then((data: ImageRecord[]) => { setImages(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [classFilter, searchQuery]);

  useEffect(() => { fetchImages(); }, [classFilter]);

  useEffect(() => {
    initWebSocket((img: any) => {
      setImages(prev => [img, ...prev]);
    });
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
                  <div>No images captured yet. Waiting for network activity…</div>
                  <div style={{ fontSize: 'var(--text-xs)', marginTop: 4 }}>Endpoints are currently streaming to the routing layer.</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map(img => (
                  <ImageCard
                    key={img.id || img.sha256_hash}
                    img={img}
                    onClick={() => setSelected(img)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail drawer */}
        {selected && (
          <ImageDrawer
            img={selected}
            onClose={() => setSelected(null)}
            navigate={navigate}
          />
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