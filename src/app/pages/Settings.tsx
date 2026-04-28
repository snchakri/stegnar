import { Settings as SettingsIcon, Sliders, Globe, Database, Cpu, Trash2 } from 'lucide-react';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';

const queueItems = [
  { job: 'job-a1f3', priority: 'CRITICAL', endpoint: '192.168.1.45', age: '2m 15s', deadline: '180ms' },
  { job: 'job-b2c4', priority: 'HIGH', endpoint: '192.168.1.89', age: '45s', deadline: '500ms' },
];

export function Settings() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1>System Settings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginTop: '4px' }}>
          Configure system behavior and thresholds
        </p>
      </div>

      <Card title="Model Inference Profile" icon={Sliders}>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Confidence Threshold
              </label>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>70%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="70"
              className="w-full"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              Results below this threshold trigger SOC review
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Speed vs Accuracy
              </label>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Balanced</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              defaultValue="50"
              className="w-full"
              style={{ accentColor: 'var(--accent-primary)' }}
            />
            <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>Max Speed</span>
              <span>Max Accuracy</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
            <div>
              <div style={{ fontSize: 'var(--text-sm)' }}>Enable Explainability</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Generate inference explanations
              </div>
            </div>
            <label className="switch">
              <input type="checkbox" defaultChecked />
              <span className="slider"></span>
            </label>
          </div>

          <div
            className="p-3 rounded-lg border"
            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Active Profile
            </div>
            <div className="grid grid-cols-2 gap-3" style={{ fontSize: 'var(--text-sm)' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Profile ID:</span>{' '}
                <span style={{ fontFamily: 'monospace' }}>CALPA-v2</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Latency Budget:</span> 1200ms
              </div>
            </div>
          </div>

          <button
            className="w-full py-2 px-4 rounded-lg"
            style={{
              background: 'var(--gradient-primary)',
              color: 'var(--bg-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500
            }}
          >
            Save Profile Settings
          </button>
        </div>
      </Card>

      <Card title="Protocol Whitelist" icon={Globe}>
        <div className="grid grid-cols-3 gap-4">
          {['HTTP/1.1', 'HTTP/2', 'HTTP/3', 'IPv4', 'IPv6', 'WebSocket'].map((protocol) => (
            <label
              key={protocol}
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors hover:bg-opacity-70"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <span style={{ fontSize: 'var(--text-sm)' }}>{protocol}</span>
              <input
                type="checkbox"
                defaultChecked={!protocol.includes('3')}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--accent-primary)' }}
              />
            </label>
          ))}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '12px' }}>
          Policy Version: v2.4 • Effective: 2026-04-28 12:00:00
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card title="Queue Manager" icon={Database}>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2" style={{ fontSize: 'var(--text-sm)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Queue Depth</span>
                <span>47 / 1000</span>
              </div>
              <ProgressBar value={47} max={1000} color="var(--accent-primary)" />
            </div>

            <div className="space-y-2">
              {queueItems.map((item) => (
                <div
                  key={item.job}
                  className="flex items-center justify-between p-2 rounded"
                  style={{ background: 'var(--bg-secondary)' }}
                >
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {item.job}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {item.endpoint} • {item.age}
                    </div>
                  </div>
                  <button className="p-1 hover:bg-red-500/10 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--status-critical)' }} />
                  </button>
                </div>
              ))}
            </div>

            <button
              className="w-full py-2 px-4 rounded-lg border transition-colors hover:bg-red-500/10"
              style={{
                borderColor: 'var(--status-critical)',
                color: 'var(--status-critical)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Clear All Queue Items
            </button>
          </div>
        </Card>

        <Card title="Cache Settings" icon={Database}>
          <div className="space-y-4">
            <div>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                TTL (minutes)
              </label>
              <input
                type="number"
                defaultValue="10"
                className="w-full mt-2 px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                Max Memory (MB)
              </label>
              <input
                type="number"
                defaultValue="512"
                className="w-full mt-2 px-3 py-2 rounded-lg border"
                style={{
                  background: 'var(--bg-secondary)',
                  borderColor: 'var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--text-sm)'
                }}
              />
            </div>

            <div
              className="p-3 rounded-lg"
              style={{ background: 'var(--bg-secondary)' }}
            >
              <div className="grid grid-cols-2 gap-2" style={{ fontSize: 'var(--text-sm)' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Hit Rate</div>
                  <div style={{ color: 'var(--status-success)' }}>94.7%</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>Keys</div>
                  <div>1,247</div>
                </div>
              </div>
            </div>

            <button
              className="w-full py-2 px-4 rounded-lg border"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Clear Cache
            </button>
          </div>
        </Card>
      </div>

      <Card title="Proxy Resources" icon={Cpu}>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              RAM Limit (GB)
            </label>
            <input
              type="number"
              defaultValue="8"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              CPU Threads
            </label>
            <input
              type="number"
              defaultValue="4"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Max Concurrent Streams
            </label>
            <input
              type="number"
              defaultValue="100"
              className="w-full mt-2 px-3 py-2 rounded-lg border"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)'
              }}
            />
          </div>
        </div>

        <button
          className="w-full mt-4 py-2 px-4 rounded-lg"
          style={{
            background: 'var(--gradient-primary)',
            color: 'var(--bg-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500
          }}
        >
          Apply Resource Settings
        </button>
      </Card>

      <style>{`
        .switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--border-subtle);
          transition: 0.15s;
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.15s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background: var(--gradient-primary);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }
      `}</style>
    </div>
  );
}
