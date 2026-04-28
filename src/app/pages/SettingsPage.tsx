import { useState } from 'react';
import { TopBar } from '../components/TopBar';

export function SettingsPage() {
  const [settings, setSettings] = useState({
    alertThreshold: 70,
    autoRefresh: true,
    retentionDays: 90,
    maxConcurrentScans: 10,
    enableNotifications: true,
    enableEmailAlerts: true,
    enableAuditLog: true,
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
    setHasChanges(true);
  };

  const handleSave = () => {
    console.log('Saving settings:', settings);
    setHasChanges(false);
  };

  const handleReset = () => {
    setSettings({
      alertThreshold: 70,
      autoRefresh: true,
      retentionDays: 90,
      maxConcurrentScans: 10,
      enableNotifications: true,
      enableEmailAlerts: true,
      enableAuditLog: true,
    });
    setHasChanges(false);
  };

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Settings" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div
            className="rounded-lg border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                General
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Core system configuration
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Alert Threshold (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.alertThreshold}
                    onChange={(e) => handleChange('alertThreshold', parseInt(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span
                    className="px-3 py-1 rounded"
                    style={{
                      background: 'var(--bg-sidebar)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-primary)',
                      minWidth: '50px',
                      textAlign: 'center'
                    }}
                  >
                    {settings.alertThreshold}%
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  CALPA scores above this threshold trigger alerts
                </p>
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Data Retention (days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={settings.retentionDays}
                  onChange={(e) => handleChange('retentionDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    background: 'var(--bg-sidebar)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Number of days to retain analysis data
                </p>
              </div>

              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Max Concurrent Scans
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.maxConcurrentScans}
                  onChange={(e) => handleChange('maxConcurrentScans', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{
                    background: 'var(--bg-sidebar)',
                    borderColor: 'var(--border-default)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)'
                  }}
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Maximum number of parallel image scans
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-lg border"
            style={{
              background: 'var(--bg-card)',
              borderColor: 'var(--border-default)'
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                System Configuration
              </h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Toggle system features
              </p>
            </div>

            <div className="p-4 space-y-3">
              {[
                { key: 'autoRefresh', label: 'Auto-refresh dashboard', description: 'Automatically refresh data every 30 seconds' },
                { key: 'enableNotifications', label: 'Enable notifications', description: 'Show system notifications in browser' },
                { key: 'enableEmailAlerts', label: 'Email alerts', description: 'Send email notifications for critical events' },
                { key: 'enableAuditLog', label: 'Audit logging', description: 'Log all system actions to audit trail' },
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-opacity-70 transition-colors"
                  style={{ background: 'var(--bg-sidebar)' }}
                >
                  <div className="flex-1">
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {option.label}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {option.description}
                    </div>
                  </div>
                  <div className="ml-4">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={settings[option.key as keyof typeof settings] as boolean}
                        onChange={(e) => handleChange(option.key, e.target.checked)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="flex-1 py-2.5 px-4 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: hasChanges ? 'var(--accent)' : 'var(--bg-sidebar)',
                color: hasChanges ? '#fff' : 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
                fontWeight: 500
              }}
            >
              Save Changes
            </button>
            <button
              onClick={handleReset}
              disabled={!hasChanges}
              className="px-4 py-2.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)'
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
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
          background-color: var(--border-default);
          transition: 0.2s;
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
          transition: 0.2s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--accent);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }
      `}</style>
    </div>
  );
}
