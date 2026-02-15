interface ProgressBarProps {
  percent: number;
  elapsedMs: number;
}

export function ProgressBar({ percent, elapsedMs }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="bg-[var(--color-bg-deep)] p-6 rounded-xl border border-[var(--color-border)]">
      <div className="flex justify-between items-end mb-4">
        <div>
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-tighter">
            Total Completion
          </span>
          <div className="text-4xl font-bold font-mono tabular-nums text-[var(--color-text-primary)]">
            {clamped.toFixed(1)}<span className="text-[var(--color-accent)] text-2xl">%</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-tighter">
            Time Elapsed
          </span>
          <div className="text-xl font-medium font-mono text-[var(--color-text-primary)]">
            {timeDisplay}<span className="text-xs ml-1">sec</span>
          </div>
        </div>
      </div>
      <div className="w-full h-4 bg-[var(--color-border)] rounded-full overflow-hidden p-1">
        <div
          className="h-full bg-[var(--color-accent)] rounded-full glow-primary transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
