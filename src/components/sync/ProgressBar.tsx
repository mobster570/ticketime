interface ProgressBarProps {
  percent: number;
  elapsedMs: number;
}

export function ProgressBar({ percent, elapsedMs }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const elapsed = (elapsedMs / 1000).toFixed(1);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--color-text-secondary)]">
          Overall Progress
        </span>
        <span className="font-mono text-[var(--color-text-primary)]">
          {clamped.toFixed(1)}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Elapsed: {elapsed}s
      </p>
    </div>
  );
}
