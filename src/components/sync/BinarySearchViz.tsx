interface BinarySearchVizProps {
  leftBound: number;
  rightBound: number;
  iteration: number;
}

export function BinarySearchViz({
  leftBound,
  rightBound,
  iteration,
}: BinarySearchVizProps) {
  const width = rightBound - leftBound;
  const leftPercent = (leftBound / 1000) * 100;
  const widthPercent = (width / 1000) * 100;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
          Binary Search Interval
        </h3>
        <span className="text-xs text-[var(--color-text-secondary)]">
          Iteration {iteration}
        </span>
      </div>

      {/* Visual bar */}
      <div className="relative h-8 w-full rounded bg-[var(--color-border)]">
        <div
          className="absolute top-0 h-full rounded bg-[var(--color-accent)]/30 border border-[var(--color-accent)] transition-all duration-300"
          style={{
            left: `${Math.max(0, leftPercent)}%`,
            width: `${Math.max(1, widthPercent)}%`,
          }}
        />
      </div>

      {/* Bounds display */}
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-[var(--color-text-secondary)]">
          LB: {leftBound.toFixed(1)} ms
        </span>
        <span className="text-[var(--color-accent)] font-medium">
          Width: {width.toFixed(2)} ms
        </span>
        <span className="text-[var(--color-text-secondary)]">
          UB: {rightBound.toFixed(1)} ms
        </span>
      </div>
    </div>
  );
}
