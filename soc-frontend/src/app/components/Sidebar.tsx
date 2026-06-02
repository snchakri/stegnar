import { NavLink } from 'react-router';
import {
  Database, Server, Activity, Network,
  FileText, Settings as SettingsIcon, HardDrive,
  Upload, Menu, X, Shield, Globe, Filter,
  AlertTriangle,
} from 'lucide-react';

const navItems = [
  { path: '/database',    label: 'Database',    icon: Database     },
  { path: '/redis',       label: 'Redis',       icon: Server       },
  { path: '/proxy',       label: 'Proxy Logs',  icon: Globe        },
  { path: '/ingest',      label: 'Ingest Debug', icon: Filter      },
  { path: '/storage',     label: 'Storage',     icon: HardDrive    },
  { path: '/performance', label: 'Performance', icon: Activity     },
  { path: '/diagnostics', label: 'Diagnostics',  icon: AlertTriangle },
  { path: '/topology',    label: 'Topology',    icon: Network      },
  { path: '/logs',        label: 'Logs',        icon: FileText     },
  { path: '/ledger',      label: 'Ledger',      icon: Shield       },
  { path: '/settings',    label: 'Settings',    icon: SettingsIcon },
];

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      <button
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 p-2 rounded-lg lg:hidden"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', border: '1px solid' }}
      >
        {isOpen
          ? <X    className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
          : <Menu className="w-5 h-5" style={{ color: 'var(--text-primary)' }} />
        }
      </button>

      <aside
        className={`sidebar ${isOpen ? 'sidebar-open' : 'sidebar-closed'}`}
        style={{ background: 'var(--bg-sidebar)', borderColor: 'var(--border-default)' }}
      >
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <Database className="w-5 h-5" style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Admin Panel
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Dashboard
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mb-2">
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Navigation
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className="nav-item">
              {({ isActive }) => (
                <>
                  {isActive && <div className="nav-accent-bar" />}
                  <div className={`nav-content ${isActive ? 'active' : ''}`}>
                    <item.icon className="w-[18px] h-[18px]" />
                    <span style={{ fontSize: 'var(--text-sm)' }}>{item.label}</span>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--border-default)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>v2.1.0</div>
        </div>

        <style>{`
          .sidebar {
            width: 240px;
            display: flex;
            flex-direction: column;
            border-right: 1px solid;
            transition: transform 0.3s ease;
            position: relative;
            z-index: 50;
          }
          @media (max-width: 1024px) {
            .sidebar { position: fixed; top: 0; left: 0; bottom: 0; transform: translateX(-100%); }
            .sidebar-open  { transform: translateX(0); }
            .sidebar-closed { transform: translateX(-100%); }
          }
          @media (min-width: 1024px) {
            .sidebar { position: relative; transform: translateX(0); }
          }
          .nav-item { display: block; position: relative; margin-bottom: 2px; }
          .nav-accent-bar { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--accent); border-radius: 0 4px 4px 0; }
          .nav-content { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 6px; color: var(--text-secondary); transition: all 150ms ease; }
          .nav-content.active { background: var(--bg-card); color: var(--text-primary); }
          .nav-content:hover { background: var(--bg-hover); color: var(--text-primary); }
        `}</style>
      </aside>
    </>
  );
}
