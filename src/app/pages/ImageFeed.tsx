import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Search, RefreshCw, X, FileText, Network } from 'lucide-react';

interface ImageRecord {
  sha256_hash: string;
  calpa_score: number;
  classification: 'benign' | 'suspicious' | 'malicious';
  first_seen_ts: string;
  minio_img_uri: string;
  endpoint_id: string;
  dest_ip: string;
  session_id: string;
  minio_pcap_uri: string;
}

const images: ImageRecord[] = [
  {
    sha256_hash: 'f2d3a8c9b1e4567f8932abcd1234ef56a789b012c345d678e901f234a567b890',
    calpa_score: 94.2,
    classification: 'malicious',
    first_seen_ts: '2024-04-28 14:23:45',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_f2d3a8c9.jpg',
    endpoint_id: 'ep_192.168.1.45',
    dest_ip: '93.184.216.34',
    session_id: 'sess_a7f3e9b2',
    minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-23-45.pcap'
  },
  {
    sha256_hash: 'a7b2c5d8e3f1234g5678h901i234j567k890l123m456n789o012p345q678r901',
    calpa_score: 68.5,
    classification: 'suspicious',
    first_seen_ts: '2024-04-28 14:19:15',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_a7b2c5d8.png',
    endpoint_id: 'ep_192.168.1.89',
    dest_ip: '151.101.65.69',
    session_id: 'sess_c8f1a2d3',
    minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-19-15.pcap'
  },
  {
    sha256_hash: 'c8d9e4f5a1b2678h3456i789j012k345l678m901n234o567p890q123r456s789',
    calpa_score: 23.1,
    classification: 'benign',
    first_seen_ts: '2024-04-28 14:15:03',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_c8d9e4f5.jpg',
    endpoint_id: 'ep_192.168.1.23',
    dest_ip: '104.16.123.96',
    session_id: 'sess_b2c4d5e6',
    minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-15-03.pcap'
  },
  {
    sha256_hash: 'b3c4d5e6f7a8901i2345j678k901l234m567n890o123p456q789r012s345t678',
    calpa_score: 12.7,
    classification: 'benign',
    first_seen_ts: '2024-04-28 14:12:28',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_b3c4d5e6.png',
    endpoint_id: 'ep_192.168.1.45',
    dest_ip: '172.217.14.206',
    session_id: 'sess_d3e5f7a8',
    minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-12-28.pcap'
  },
  {
    sha256_hash: 'd4e5f6a7b8c9012j3456k789l012m345n678o901p234q567r890s123t456u789',
    calpa_score: 76.3,
    classification: 'suspicious',
    first_seen_ts: '2024-04-28 14:08:51',
    minio_img_uri: 's3://stegnar-artifacts/2024/04/28/img_d4e5f6a7.jpg',
    endpoint_id: 'ep_192.168.1.67',
    dest_ip: '8.8.8.8',
    session_id: 'sess_e4f6g8h9',
    minio_pcap_uri: 's3://stegnar-pcaps/2024/04/28/capture_14-08-51.pcap'
  },
];

export function ImageFeed() {
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('all');
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredImages = images.filter(img => {
    const matchesSearch = searchQuery === '' || img.sha256_hash.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClassification = classificationFilter === 'all' || img.classification === classificationFilter;
    return matchesSearch && matchesClassification;
  });

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Image Feed" />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: 'var(--border-default)' }}>
            <div className="w-full sm:flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by SHA-256 hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              <option value="all">All Classifications</option>
              <option value="benign">Benign</option>
              <option value="suspicious">Suspicious</option>
              <option value="malicious">Malicious</option>
            </select>

            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border transition-colors hover:bg-opacity-80"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)'
              }}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 lg:p-6">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-lg border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
                    <div className="h-48 animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                    <div className="p-4 space-y-2">
                      <div className="h-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
                      <div className="h-3 rounded animate-pulse w-2/3" style={{ background: 'var(--bg-hover)' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredImages.length === 0 ? (
              <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
                No images found
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl">
                {filteredImages.map((img) => (
                  <button
                    key={img.sha256_hash}
                    onClick={() => setSelectedImage(img)}
                    className="rounded-lg border overflow-hidden transition-all hover:-translate-y-1 text-left"
                    style={{
                      background: 'var(--bg-card)',
                      borderColor: 'var(--border-default)'
                    }}
                  >
                    <div
                      className="h-48 flex items-center justify-center"
                      style={{ background: 'var(--bg-sidebar)' }}
                    >
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        Image Preview
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className="px-2 py-1 rounded text-xs"
                          style={{
                            background: img.classification === 'malicious' ? 'rgba(239, 68, 68, 0.1)' :
                                       img.classification === 'suspicious' ? 'rgba(245, 158, 11, 0.1)' :
                                       'rgba(16, 185, 129, 0.1)',
                            color: img.classification === 'malicious' ? 'var(--status-error)' :
                                   img.classification === 'suspicious' ? 'var(--status-warning)' :
                                   'var(--status-success)'
                          }}
                        >
                          {img.classification}
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: img.calpa_score > 70 ? 'var(--status-error)' : 'var(--text-primary)' }}>
                          {img.calpa_score}%
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'monospace',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {img.sha256_hash.substring(0, 16)}...
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {img.first_seen_ts}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedImage && (
          <div
            className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-96 border-l flex flex-col drawer-slide-in z-30"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Image Details
              </h3>
              <button onClick={() => setSelectedImage(null)} className="p-1 rounded hover:bg-opacity-70 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div
                className="rounded-lg border flex items-center justify-center"
                style={{
                  background: 'var(--bg-sidebar)',
                  borderColor: 'var(--border-default)',
                  height: '200px'
                }}
              >
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Image Preview
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Analysis
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-sidebar)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Classification</span>
                    <span
                      className="px-2 py-1 rounded"
                      style={{
                        background: selectedImage.classification === 'malicious' ? 'rgba(239, 68, 68, 0.1)' :
                                   selectedImage.classification === 'suspicious' ? 'rgba(245, 158, 11, 0.1)' :
                                   'rgba(16, 185, 129, 0.1)',
                        color: selectedImage.classification === 'malicious' ? 'var(--status-error)' :
                               selectedImage.classification === 'suspicious' ? 'var(--status-warning)' :
                               'var(--status-success)',
                        fontSize: 'var(--text-sm)',
                        textTransform: 'capitalize'
                      }}
                    >
                      {selectedImage.classification}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-sidebar)' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>CALPA Score</span>
                    <span
                      className="px-2 py-1 rounded"
                      style={{
                        background: selectedImage.calpa_score < 30 ? 'rgba(16, 185, 129, 0.1)' :
                                   selectedImage.calpa_score < 70 ? 'rgba(245, 158, 11, 0.1)' :
                                   'rgba(239, 68, 68, 0.1)',
                        color: selectedImage.calpa_score < 30 ? 'var(--status-success)' :
                               selectedImage.calpa_score < 70 ? 'var(--status-warning)' :
                               'var(--status-error)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600
                      }}
                    >
                      {selectedImage.calpa_score.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Network Context
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Endpoint</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedImage.endpoint_id}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Destination IP</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedImage.dest_ip}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Session ID</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedImage.session_id}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Storage
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>SHA-256 Hash</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {selectedImage.sha256_hash}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Image URI</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {selectedImage.minio_img_uri}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>PCAP URI</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px', wordBreak: 'break-all' }}>
                      {selectedImage.minio_pcap_uri}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>First Seen</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedImage.first_seen_ts}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Actions
                </div>
                <div className="space-y-2">
                  <button
                    className="w-full p-3 rounded-lg border transition-colors hover:bg-opacity-80 flex items-center gap-2"
                    style={{
                      background: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <FileText className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>View in Logs</span>
                  </button>
                  <button
                    className="w-full p-3 rounded-lg border transition-colors hover:bg-opacity-80 flex items-center gap-2"
                    style={{
                      background: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <Network className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>View Network Activity</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .drawer-slide-in {
          animation: slideIn 200ms ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-pulse {
          animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}
