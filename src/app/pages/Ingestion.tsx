import { Upload, FileArchive, Key, CheckCircle, Loader2, XCircle } from 'lucide-react';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';

const pipelineStages = [
  { name: 'Validating integrity', status: 'completed' },
  { name: 'Extracting TLS', status: 'completed' },
  { name: 'Reassembling TCP streams', status: 'in_progress' },
  { name: 'Extracting image artifacts', status: 'pending', count: null },
  { name: 'Dispatching to queue', status: 'pending' },
  { name: 'Analysis running', status: 'pending' },
];

const recentJobs = [
  {
    filename: 'capture_2026-04-28_14-00.pcap',
    type: 'PCAP',
    submitted: '14:15:42',
    images: 47,
    threats: 3,
    status: 'Completed'
  },
  {
    filename: 'network_traffic.pcapng',
    type: 'PCAP',
    submitted: '13:42:18',
    images: 124,
    threats: 0,
    status: 'Completed'
  },
  {
    filename: 'suspicious_image.jpg',
    type: 'Image',
    submitted: '13:28:05',
    images: 1,
    threats: 1,
    status: 'Completed'
  },
];

export function Ingestion() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1>Offline Ingestion</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          Upload PCAP files or raw images for offline analysis
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div
          className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:border-opacity-100 hover:bg-opacity-50"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--card-default)',
            minHeight: '200px'
          }}
        >
          <FileArchive className="w-12 h-12 mb-4" style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, marginBottom: '4px' }}>
            Upload PCAP File
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center' }}>
            .pcap or .pcapng files
          </div>
          <button
            className="mt-4 px-4 py-2 rounded-lg"
            style={{
              background: 'var(--gradient-primary)',
              color: 'var(--bg-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500
            }}
          >
            Select File
          </button>
        </div>

        <div
          className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all hover:border-opacity-100 hover:bg-opacity-50"
          style={{
            borderColor: 'var(--border-strong)',
            background: 'var(--card-default)',
            minHeight: '200px'
          }}
        >
          <Upload className="w-12 h-12 mb-4" style={{ color: 'var(--text-muted)' }} />
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 500, marginBottom: '4px' }}>
            Upload Raw Image
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', textAlign: 'center' }}>
            .jpg, .png, .bmp files
          </div>
          <button
            className="mt-4 px-4 py-2 rounded-lg"
            style={{
              background: 'var(--gradient-primary)',
              color: 'var(--bg-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500
            }}
          >
            Select Image
          </button>
        </div>
      </div>

      <Card title="TLS Keylog (Optional)" icon={Key}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontSize: 'var(--text-sm)', marginBottom: '4px' }}>
              Upload TLS keylog file to decrypt HTTPS traffic
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              keys.log format - enables extraction from encrypted streams
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
            <button
              className="px-4 py-2 rounded-lg border"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Select Keylog
            </button>
          </div>
        </div>
      </Card>

      <Card title="Pipeline Progress">
        <div className="space-y-3">
          {pipelineStages.map((stage, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div className="flex items-center gap-3">
                {stage.status === 'completed' && (
                  <CheckCircle className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
                )}
                {stage.status === 'in_progress' && (
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent-primary)' }} />
                )}
                {stage.status === 'pending' && (
                  <div className="w-5 h-5 rounded-full border-2" style={{ borderColor: 'var(--border-subtle)' }} />
                )}
                {stage.status === 'failed' && (
                  <XCircle className="w-5 h-5" style={{ color: 'var(--status-critical)' }} />
                )}
                <span style={{ fontSize: 'var(--text-sm)' }}>
                  {stage.name}
                </span>
              </div>
              {stage.count !== null && stage.count !== undefined && (
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  Found {stage.count} images
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Recent Ingestion Jobs">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid var(--border-subtle)` }}>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Filename</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>Submitted</th>
                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Images</th>
                <th style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Threats</th>
                <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job, i) => (
                <tr
                  key={i}
                  className="cursor-pointer hover:bg-opacity-70 transition-colors"
                  style={{ borderBottom: `1px solid var(--border-subtle)` }}
                >
                  <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                    {job.filename}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {job.type}
                  </td>
                  <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                    {job.submitted}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {job.images}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <span style={{ color: job.threats > 0 ? 'var(--status-critical)' : 'var(--status-success)' }}>
                      {job.threats}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div className="flex justify-center">
                      <StatusBadge status={job.status} small />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
