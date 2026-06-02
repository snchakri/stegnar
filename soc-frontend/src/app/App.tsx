import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { Sidebar } from './components/Sidebar';
import { DatabasePage } from './pages/DatabasePage';
import { RedisPage } from './pages/RedisPage';
import { IngestPage } from './pages/IngestPage';
import { StoragePage } from './pages/StoragePage';
import { PerformancePage } from './pages/PerformancePage';
import { TopologyPage } from './pages/TopologyPage';
import { LogsPage } from './pages/LogsPage';
import { LedgerTrail } from './pages/LedgerTrail';
import { SettingsPage } from './pages/SettingsPage';
import { ProxyPage } from './pages/ProxyPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <BrowserRouter>
      <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/database" replace />} />
              <Route path="/database"    element={<DatabasePage />} />
              <Route path="/redis"       element={<RedisPage />} />
              <Route path="/proxy"       element={<ProxyPage />} />
              <Route path="/ingest"      element={<IngestPage />} />
              <Route path="/storage"     element={<StoragePage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route path="/topology"    element={<TopologyPage />} />
              <Route path="/logs"        element={<LogsPage />} />
              <Route path="/ledger"      element={<LedgerTrail />} />
              <Route path="/settings"    element={<SettingsPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
