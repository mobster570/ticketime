import { Target } from "lucide-react";

interface BinarySearchVizProps {
  leftBound: number;
  rightBound: number;
  iteration: number;
}

export function BinarySearchViz({
  leftBound,
  rightBound,
}: BinarySearchVizProps) {
  const width = rightBound - leftBound;
  const leftPercent = (leftBound / 1000) * 100;
  const widthPercent = (width / 1000) * 100;

  return (
    <div className="bg-[var(--color-bg-deep)] p-6 rounded-xl border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
            <Target className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Binary Search Interval
          </h3>
        </div>
        <span className="text-xs font-mono text-[var(--color-text-secondary)]">
          [{leftBound.toFixed(1)} ms, {rightBound.toFixed(1)} ms]
        </span>
      </div>

      {/* Visualization */}
      <div className="relative">
        {/* Search space rectangle - above the axis */}
        <div className="relative h-8 mb-1">
          <div
            className="absolute top-0 h-full rounded bg-[var(--color-accent)]/20 border-2 border-[var(--color-accent)] transition-all duration-300"
            style={{
              left: `${Math.max(0, leftPercent)}%`,
              width: `${Math.max(0.5, widthPercent)}%`,
            }}
          />
        </div>

        {/* Axis line */}
        <div className="relative h-0.5 w-full bg-[var(--color-border)] rounded-full" />
      </div>

      {/* Bottom scale */}
      <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
        <span>0ms</span>
        <span>500ms</span>
        <span>1000ms</span>
      </div>
    </div>
  );
}
