import { useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Upload, Check, Loader2, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface PipelineStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  detail?: string;
}

export function IngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const [steps, setSteps] = useState<PipelineStep[]>([
    { id: '1', label: 'Validating file', status: 'pending' },
    { id: '2', label: 'Extracting images', status: 'pending' },
    { id: '3', label: 'Images found', status: 'pending', detail: '' },
    { id: '4', label: 'Dispatching for analysis', status: 'pending' },
    { id: '5', label: 'Analysis running', status: 'pending' },
  ]);

  const [summary, setSummary] = useState({
    imagesProcessed: 0,
    suspiciousDetected: 0,
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setCompleted(false);
    startUpload(selectedFile);
  };

  const startUpload = (selectedFile: File) => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => startProcessing(), 300);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const startProcessing = () => {
    setProcessing(true);
    const stepSequence = [
      { index: 0, delay: 500, detail: '' },
      { index: 1, delay: 1200, detail: '' },
      { index: 2, delay: 800, detail: '12 images' },
      { index: 3, delay: 1000, detail: '' },
      { index: 4, delay: 1500, detail: '' },
    ];

    stepSequence.forEach(({ index, delay, detail }) => {
      setTimeout(() => {
        setSteps((prevSteps) =>
          prevSteps.map((step, i) =>
            i === index
              ? { ...step, status: 'running' as const, detail }
              : i < index
              ? { ...step, status: 'complete' as const }
              : step
          )
        );

        if (index === stepSequence.length - 1) {
          setTimeout(() => {
            setSteps((prevSteps) =>
              prevSteps.map((step) => ({ ...step, status: 'complete' as const }))
            );
            setProcessing(false);
            setCompleted(true);
            setSummary({ imagesProcessed: 12, suspiciousDetected: 3 });
          }, 2000);
        }
      }, stepSequence.slice(0, index + 1).reduce((acc, s) => acc + s.delay, 0));
    });
  };

  const handleReset = () => {
    setFile(null);
    setUploadProgress(0);
    setProcessing(false);
    setCompleted(false);
    setSteps(
      steps.map((step) => ({ ...step, status: 'pending' as const, detail: '' }))
    );
    setSummary({ imagesProcessed: 0, suspiciousDetected: 0 });
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Ingest Data" />

      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Upload PCAP or image files for analysis
            </p>
          </div>

          {!file ? (
            <div
              className="rounded-lg border-2 border-dashed p-12 text-center transition-all cursor-pointer hover:border-opacity-70"
              style={{
                background: dragActive ? 'var(--bg-hover)' : 'var(--bg-card)',
                borderColor: dragActive ? 'var(--accent)' : 'var(--border-default)'
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload
                className="w-12 h-12 mx-auto mb-4"
                style={{ color: 'var(--text-muted)' }}
              />
              <div style={{ fontSize: 'var(--text-md)', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Drag & drop PCAP or image files here
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Supported formats: .pcap, .jpg, .png
              </div>
              <button
                className="px-4 py-2 rounded-lg transition-colors hover:opacity-90"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500
                }}
              >
                Select File
              </button>
              <input
                id="file-input"
                type="file"
                accept=".pcap,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div
                className="rounded-lg border p-4"
                style={{
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-default)'
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  {uploadProgress === 100 && !completed && (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--accent)' }} />
                  )}
                  {completed && (
                    <Check className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
                  )}
                </div>

                {uploadProgress < 100 && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        Uploading...
                      </span>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)' }}>
                        {uploadProgress}%
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'var(--bg-sidebar)' }}
                    >
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          background: 'var(--accent)',
                          width: `${uploadProgress}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {uploadProgress === 100 && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)'
                  }}
                >
                  <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>
                    Processing Pipeline
                  </h3>

                  <div className="space-y-4">
                    {steps.map((step, index) => (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {step.status === 'pending' && (
                            <div
                              className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                              style={{ borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                            >
                              <div style={{ fontSize: '10px' }}>{index + 1}</div>
                            </div>
                          )}
                          {step.status === 'running' && (
                            <Loader2
                              className="w-5 h-5 animate-spin"
                              style={{ color: 'var(--accent)' }}
                            />
                          )}
                          {step.status === 'complete' && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: 'var(--status-success)' }}
                            >
                              <Check className="w-3 h-3" style={{ color: '#fff' }} />
                            </div>
                          )}
                          {step.status === 'error' && (
                            <div
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: 'var(--status-error)' }}
                            >
                              <AlertCircle className="w-3 h-3" style={{ color: '#fff' }} />
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div
                            style={{
                              fontSize: 'var(--text-sm)',
                              color: step.status === 'pending' ? 'var(--text-muted)' : 'var(--text-primary)',
                              fontWeight: step.status === 'running' ? 500 : 400
                            }}
                          >
                            {step.label}
                          </div>
                          {step.detail && (
                            <div
                              style={{
                                fontSize: 'var(--text-xs)',
                                color: 'var(--accent)',
                                marginTop: '2px',
                                fontWeight: 600
                              }}
                            >
                              {step.detail}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completed && (
                <div
                  className="rounded-lg border p-6"
                  style={{
                    background: 'var(--bg-card)',
                    borderColor: 'var(--border-default)'
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Check className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
                    <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Analysis Complete
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <div
                      className="p-4 rounded-lg"
                      style={{ background: 'var(--bg-sidebar)' }}
                    >
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Images Processed
                      </div>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--accent)' }}>
                        {summary.imagesProcessed}
                      </div>
                    </div>

                    <div
                      className="p-4 rounded-lg"
                      style={{ background: 'var(--bg-sidebar)' }}
                    >
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                        Suspicious Detected
                      </div>
                      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 600, color: 'var(--status-warning)' }}>
                        {summary.suspiciousDetected}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      className="flex-1 px-4 py-2 rounded-lg transition-colors hover:opacity-90 flex items-center justify-center gap-2"
                      style={{
                        background: 'var(--accent)',
                        color: '#fff',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 500
                      }}
                    >
                      <ImageIcon className="w-4 h-4" />
                      View Results in Image Feed
                    </button>

                    <button
                      onClick={handleReset}
                      className="px-4 py-2 rounded-lg border transition-colors hover:bg-opacity-80"
                      style={{
                        background: 'var(--bg-card)',
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-secondary)',
                        fontSize: 'var(--text-sm)'
                      }}
                    >
                      Upload Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
