import { Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export function ConnectionStatus() {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setConnected(Math.random() > 0.05);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-4 right-6 z-50">
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
        style={{
          background: 'var(--card-default)',
          borderColor: 'var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: connected ? 'var(--status-success)' : 'var(--status-critical)'
        }}
      >
        {connected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Reconnecting...</span>
          </>
        )}
      </div>
    </div>
  );
}
