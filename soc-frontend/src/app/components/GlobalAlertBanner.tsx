import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

export function GlobalAlertBanner() {
  const [visible, setVisible] = useState(true);
  const [alert] = useState({
    endpoint: '192.168.1.47',
    confidence: 94.2,
    description: 'High confidence steganography detected'
  });

  if (!visible) return null;

  return (
    <div
      className="flex items-center justify-between px-6 py-3 border-b"
      style={{
        background: 'var(--status-critical)',
        borderColor: 'var(--border-subtle)',
        color: 'var(--bg-primary)'
      }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-5 h-5" />
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          Critical Alert: {alert.description} on {alert.endpoint} ({alert.confidence}% confidence)
        </div>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="p-1 rounded hover:bg-black/20 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
