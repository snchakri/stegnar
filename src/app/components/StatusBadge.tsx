interface StatusBadgeProps {
  status: string;
  small?: boolean;
}

/** Comprehensive colour map — covers infra states AND all verdict values. */
function resolveColor(status: string): string {
  switch (status.toUpperCase()) {
    // Stego / threat verdicts → RED
    case 'STEGO':
    case 'MALICIOUS':
    case 'FLAGGED':
    case 'CRITICAL':
    case 'DOWN':
      return 'var(--status-critical)';

    // Ambiguous / warning → YELLOW
    case 'AMBIGUOUS':
    case 'SUSPICIOUS':
    case 'DEGRADED':
    case 'HIGH':
    case 'WARNING':
      return 'var(--status-warning)';

    // Clean / safe / online → GREEN
    case 'CLEAN':
    case 'BENIGN':
    case 'UP':
    case 'HEALTHY':
    case 'NORMAL':
    case 'WARMIDLE':
      return 'var(--status-success)';

    // Operational states → BLUE-ISH / ACCENT
    case 'RUNNING':
    case 'ACTIVE':
    case 'ONLINE':
    case 'ASSIGNED':
      return 'var(--accent)';

    // Transitional
    case 'SANITIZING':
    case 'CHECKING':
      return 'var(--status-warning)';

    // Cache/info states → muted
    case 'CACHE_HIT':
    case 'NO_IMAGE':
    case 'UNKNOWN':
      return 'var(--text-muted)';

    default:
      return 'var(--text-muted)';
  }
}

const PULSE_STATUSES = new Set([
  'STEGO', 'MALICIOUS', 'CRITICAL', 'DOWN', 'FLAGGED',
]);

export function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const color  = resolveColor(status);
  const doPulse = PULSE_STATUSES.has(status.toUpperCase());

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="rounded-full"
        style={{
          width:      small ? '6px' : '8px',
          height:     small ? '6px' : '8px',
          background: color,
          boxShadow:  doPulse ? `0 0 6px ${color}` : undefined,
          animation:  doPulse ? 'pulse-subtle 2s infinite' : undefined,
        }}
      />
      <span
        style={{
          fontSize:      small ? 'var(--text-xs)' : 'var(--text-sm)',
          color,
          fontWeight:    600,
          letterSpacing: '0.02em',
        }}
      >
        {status}
      </span>
    </div>
  );
}
