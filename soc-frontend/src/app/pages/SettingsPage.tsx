import { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { apiUrl } from '../../lib/config';

export function SettingsPage() {
  const [settings, setSettings] = useState({
    alertThreshold:      70,
    autoRefresh:         true,
    retentionDays:       90,
    maxConcurrentScans:  10,
    enableAuditLog:      true,
  });

  const [hasChanges,  setHasChanges]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveStatus,  setSaveStatus]  = useState<'idle' | 'ok' | 'error'>('idle');
  const [loading,     setLoading]     = useState(true);

  // Load settings from backend on mount
  useEffect(() => {
    fetch(apiUrl('/settings'))
      .then(r => r.json())
      .then(data => {
        setSettings(prev => ({ ...prev, ...data }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const resp = await fetch(apiUrl('/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await resp.json();
      if (data.ok) {
        setSaveStatus('ok');
        setHasChanges(false);
      } else {
        setSaveStatus('error');
      }
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = () => {
    setSettings({
      alertThreshold:      70,
      autoRefresh:         true,
      retentionDays:       90,
      maxConcurrentScans:  10,
      enableAuditLog:      true,
    });
    setHasChanges(true);
    setSaveStatus('idle');
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <TopBar title="Settings" />
        <div className="flex-1 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
          Loading settings from backend…
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar title="Settings" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Save status banner */}
          {saveStatus === 'ok' && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #22c55e', color: '#34d399', fontSize: 'var(--text-sm)' }}>
              ✓ Settings saved to backend successfully.
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', color: '#f87171', fontSize: 'var(--text-sm)' }}>
              ✗ Failed to save settings — check API connectivity.
            </div>
          )}

          {/* Detection Settings */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>Detection Settings</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                Runtime controls pushed directly to the backend on save
              </p>
            </div>

            <div className="p-4 space-y-5">
              {/* Alert Threshold */}
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Alert Threshold (%)
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min="0" max="100"
                    value={settings.alertThreshold}
                    onChange={(e) => handleChange('alertThreshold', parseInt(e.target.value))}
                    className="flex-1"
                    style={{ accentColor: 'var(--accent)' }}
                  />
                  <span className="px-3 py-1 rounded"
                    style={{ background: 'var(--bg-sidebar)', fontSize: 'var(--text-sm)', color: settings.alertThreshold > 70 ? '#f87171' : 'var(--text-primary)', minWidth: '50px', textAlign: 'center', fontWeight: 600 }}>
                    {settings.alertThreshold}%
                  </span>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  CALPA scores above this threshold trigger alerts and mark verdict as STEGO
                </p>
              </div>

              {/* Data Retention */}
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Data Retention (days)
                </label>
                <input
                  type="number" min="1" max="365"
                  value={settings.retentionDays}
                  onChange={(e) => handleChange('retentionDays', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Number of days to retain analysis data in PostgreSQL TimescaleDB before cold storage compression
                </p>
              </div>

              {/* Max Concurrent Scans */}
              <div>
                <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                  Max Concurrent Scans
                </label>
                <input
                  type="number" min="1" max="50"
                  value={settings.maxConcurrentScans}
                  onChange={(e) => handleChange('maxConcurrentScans', parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border"
                  style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Maximum parallel CALPA-NET inference jobs dispatched to the MITM gateway
                </p>
              </div>
            </div>
          </div>

          {/* System Feature Toggles */}
          <div className="rounded-lg border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)' }}>
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>System Configuration</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '4px' }}>Toggle system features</p>
            </div>

            <div className="p-4 space-y-3">
              {[
                { key: 'autoRefresh',         label: 'Auto-refresh dashboard',      description: 'Automatically refresh SOC dashboard data every 30s' },
                { key: 'enableAuditLog',      label: 'Audit logging',               description: 'Log all system actions to the forensic audit trail' },
              ].map((option) => (
                <label
                  key={option.key}
                  className="flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors"
                  style={{ background: 'var(--bg-sidebar)' }}
                >
                  <div className="flex-1">
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{option.label}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>{option.description}</div>
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

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex-1 py-2.5 px-4 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: hasChanges && !saving ? 'var(--accent)' : 'var(--bg-sidebar)',
                color: hasChanges && !saving ? '#fff' : 'var(--text-muted)',
                fontSize: 'var(--text-sm)', fontWeight: 500,
              }}
            >
              {saving ? 'Saving to backend…' : 'Save Changes'}
            </button>
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-4 py-2.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .switch { position:relative; display:inline-block; width:44px; height:24px; }
        .switch input { opacity:0; width:0; height:0; }
        .slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:var(--border-default); transition:.2s; border-radius:24px; }
        .slider:before { position:absolute; content:""; height:18px; width:18px; left:3px; bottom:3px; background-color:white; transition:.2s; border-radius:50%; }
        input:checked + .slider { background-color:var(--accent); }
        input:checked + .slider:before { transform:translateX(20px); }
      `}</style>
    </div>
  );
}
