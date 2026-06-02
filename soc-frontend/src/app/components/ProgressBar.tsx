interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  height?: string;
}

export function ProgressBar({ value, max, color = 'var(--accent-primary)', height = '6px' }: ProgressBarProps) {
  const percentage = (value / max) * 100;

  return (
    <div
      className="rounded-full overflow-hidden"
      style={{
        background: 'var(--bg-secondary)',
        height
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${percentage}%`,
          background: color
        }}
      />
    </div>
  );
}
