interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

const statusColors: Record<string, string> = {
  UP: 'var(--status-success)',
  DOWN: 'var(--status-critical)',
  DEGRADED: 'var(--status-warning)',
  Running: 'var(--accent-primary)',
  WarmIdle: 'var(--status-success)',
  Assigned: 'var(--accent-secondary)',
  Sanitizing: 'var(--status-warning)',
  CRITICAL: 'var(--status-critical)',
  HIGH: 'var(--status-warning)',
  NORMAL: 'var(--text-muted)',
  Clean: 'var(--status-success)',
  Suspicious: 'var(--status-warning)',
  Flagged: 'var(--status-critical)',
};

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const color = statusColors[status] || 'var(--text-muted)';

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="rounded-full"
        style={{
          width: small ? '6px' : '8px',
          height: small ? '6px' : '8px',
          background: color,
          animation: ['CRITICAL', 'DOWN', 'Flagged'].includes(status) ? 'pulse-subtle 2s infinite' : undefined
        }}
      />
      <span
        style={{
          fontSize: small ? 'var(--text-xs)' : 'var(--text-sm)',
          color,
          fontWeight: 500,
          letterSpacing: '0.02em'
        }}
      >
        {status}
      </span>
    </div>
  );
}
