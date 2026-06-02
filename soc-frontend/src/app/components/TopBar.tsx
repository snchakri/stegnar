import { Bell, User, Wifi } from 'lucide-react';

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  return (
    <div
      className="h-16 border-b flex items-center justify-between px-4 lg:px-6"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-default)'
      }}
    >
      <h1 className="topbar-title" style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h1>

      <div className="flex items-center gap-2 lg:gap-4">
        <div
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'var(--bg-card)',
            fontSize: 'var(--text-xs)'
          }}
        >
          <div className="w-2 h-2 rounded-full" style={{ background: 'var(--status-success)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Connected</span>
        </div>

        <button
          className="p-2 rounded-lg transition-colors relative"
          style={{ background: 'var(--bg-card)' }}
        >
          <Bell className="w-[18px] h-[18px]" style={{ color: 'var(--text-secondary)' }} />
          <div
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--status-error)' }}
          />
        </button>

        <button
          className="p-2 rounded-lg transition-colors"
          style={{ background: 'var(--bg-card)' }}
        >
          <User className="w-[18px] h-[18px]" style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .topbar-title {
            font-size: var(--text-md);
          }
        }

        @media (max-width: 1024px) {
          .topbar-title {
            margin-left: 48px;
          }
        }
      `}</style>
    </div>
  );
}
