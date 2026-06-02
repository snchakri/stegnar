import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface CardProps {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}

export function Card({ title, icon: Icon, children, className = '' }: CardProps) {
  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-150 hover:-translate-y-0.5 ${className}`}
      style={{
        background: 'var(--card-default)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-soft)'
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--text-secondary)' }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
