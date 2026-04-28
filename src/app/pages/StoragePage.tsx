import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Folder, File, ChevronRight, X, ExternalLink } from 'lucide-react';

interface StorageFile {
  name: string;
  size: string;
  last_modified: string;
  path: string;
  type: 'file' | 'folder';
}

const buckets = [
  { name: 'stegnar-images', files: 1247 },
  { name: 'stegnar-pcaps', files: 894 },
];

const files: Record<string, StorageFile[]> = {
  'stegnar-images': [
    { name: '2024', type: 'folder', size: '-', last_modified: '2024-04-28', path: '2024/' },
    { name: 'img_f2d3a8c9.jpg', type: 'file', size: '2.4 MB', last_modified: '2024-04-28 14:23:45', path: 'img_f2d3a8c9.jpg' },
    { name: 'img_a7b2c5d8.png', type: 'file', size: '1.8 MB', last_modified: '2024-04-28 14:19:15', path: 'img_a7b2c5d8.png' },
    { name: 'img_c8d9e4f5.jpg', type: 'file', size: '3.1 MB', last_modified: '2024-04-28 14:15:03', path: 'img_c8d9e4f5.jpg' },
  ],
  'stegnar-pcaps': [
    { name: '2024', type: 'folder', size: '-', last_modified: '2024-04-28', path: '2024/' },
    { name: 'capture_14-23-45.pcap', type: 'file', size: '45.2 MB', last_modified: '2024-04-28 14:23:45', path: 'capture_14-23-45.pcap' },
    { name: 'capture_14-19-15.pcap', type: 'file', size: '38.7 MB', last_modified: '2024-04-28 14:19:15', path: 'capture_14-19-15.pcap' },
    { name: 'capture_14-15-03.pcap', type: 'file', size: '52.3 MB', last_modified: '2024-04-28 14:15:03', path: 'capture_14-15-03.pcap' },
  ],
};

export function StoragePage() {
  const [selectedBucket, setSelectedBucket] = useState('stegnar-images');
  const [selectedFile, setSelectedFile] = useState<StorageFile | null>(null);
  const [currentPath, setCurrentPath] = useState('/');

  const currentFiles = files[selectedBucket] || [];

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Storage Browser" />

      <div className="flex-1 flex overflow-hidden">
        <div
          className="w-60 border-r flex flex-col"
          style={{
            background: 'var(--bg-card)',
            borderColor: 'var(--border-default)'
          }}
        >
          <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
              Buckets
            </h3>
          </div>

          <div className="flex-1 overflow-auto p-2">
            {buckets.map((bucket) => (
              <button
                key={bucket.name}
                onClick={() => {
                  setSelectedBucket(bucket.name);
                  setCurrentPath('/');
                  setSelectedFile(null);
                }}
                className="w-full text-left p-3 rounded-lg mb-1 transition-all hover:bg-opacity-70"
                style={{
                  background: selectedBucket === bucket.name ? 'var(--bg-hover)' : 'transparent',
                  borderLeft: selectedBucket === bucket.name ? '3px solid var(--accent)' : '3px solid transparent'
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Folder className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      fontFamily: 'monospace',
                      color: selectedBucket === bucket.name ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: selectedBucket === bucket.name ? 500 : 400
                    }}
                  >
                    {bucket.name}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {bucket.files} files
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>{selectedBucket}</span>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {currentPath}
            </span>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Name
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Size
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                    Last Modified
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentFiles.map((file, index) => (
                  <tr
                    key={file.path}
                    onClick={() => file.type === 'file' && setSelectedFile(file)}
                    className="cursor-pointer transition-colors table-row-hover"
                    style={{
                      background: index % 2 === 0 ? 'transparent' : 'var(--bg-sidebar)',
                      borderBottom: '1px solid var(--border-subtle)'
                    }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div className="flex items-center gap-2">
                        {file.type === 'folder' ? (
                          <Folder className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                        ) : (
                          <File className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                        )}
                        <span
                          style={{
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-primary)',
                            fontFamily: file.type === 'file' ? 'monospace' : 'inherit'
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      {file.size}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                      {file.last_modified}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedFile && (
          <div
            className="fixed lg:relative inset-0 lg:inset-auto w-full lg:w-80 border-l flex flex-col drawer-slide-in z-30"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                File Preview
              </h3>
              <button onClick={() => setSelectedFile(null)} className="p-1 rounded hover:bg-opacity-70 transition-colors">
                <X className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              {selectedFile.name.match(/\.(jpg|jpeg|png|gif)$/i) ? (
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
              ) : selectedFile.name.endsWith('.pcap') ? (
                <div
                  className="p-4 rounded-lg"
                  style={{
                    background: 'var(--bg-sidebar)',
                    borderColor: 'var(--border-default)'
                  }}
                >
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    PCAP Metadata
                  </div>
                  <div className="mt-2 space-y-1" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    <div>Format: PCAP</div>
                    <div>Size: {selectedFile.size}</div>
                    <div>Created: {selectedFile.last_modified}</div>
                  </div>
                </div>
              ) : null}

              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  File Info
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Name</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {selectedFile.name}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Size</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedFile.size}
                    </div>
                  </div>
                  <div className="p-2 rounded" style={{ background: 'var(--bg-sidebar)' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Last Modified</div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {selectedFile.last_modified}
                    </div>
                  </div>
                </div>
              </div>

              {selectedFile.name.match(/\.(jpg|jpeg|png|gif)$/i) && (
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Actions
                  </div>
                  <button
                    className="w-full p-3 rounded-lg border transition-colors hover:bg-opacity-80 flex items-center gap-2"
                    style={{
                      background: 'var(--bg-sidebar)',
                      borderColor: 'var(--border-default)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <ExternalLink className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: 'var(--text-sm)' }}>View in Image Feed</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .table-row-hover:hover {
          background: var(--bg-hover) !important;
        }

        .drawer-slide-in {
          animation: slideIn 200ms ease-out;
        }

        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
