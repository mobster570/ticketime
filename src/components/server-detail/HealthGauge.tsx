interface HealthGaugeProps {
  score: number;
}

export function HealthGauge({ score }: HealthGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));

  const color =
    clampedScore >= 80
      ? "var(--color-success)"
      : clampedScore >= 50
        ? "var(--color-warning)"
        : "var(--color-danger)";

  const label =
    clampedScore >= 80
      ? "Optimal Stability"
      : clampedScore >= 50
        ? "Moderate"
        : "Unstable";

  // Semi-circle arc parameters
  const cx = 100;
  const cy = 100;
  const r = 80;
  const startAngle = Math.PI; // 180 degrees (left)
  const endAngle = 0; // 0 degrees (right)
  const sweepAngle = Math.PI * (clampedScore / 100);

  // Background arc (full semi-circle)
  const bgX1 = cx + r * Math.cos(startAngle);
  const bgY1 = cy - r * Math.sin(startAngle);
  const bgX2 = cx + r * Math.cos(endAngle);
  const bgY2 = cy - r * Math.sin(endAngle);
  const bgPath = `M ${bgX1} ${bgY1} A ${r} ${r} 0 1 1 ${bgX2} ${bgY2}`;

  // Foreground arc (score portion)
  const fgEndAngle = startAngle - sweepAngle;
  const fgX1 = cx + r * Math.cos(startAngle);
  const fgY1 = cy - r * Math.sin(startAngle);
  const fgX2 = cx + r * Math.cos(fgEndAngle);
  const fgY2 = cy - r * Math.sin(fgEndAngle);
  // The gauge is a semicircle (180° max), so the score arc never exceeds
  // 180° of the full circle — large-arc-flag is always 0.
  const fgPath =
    clampedScore > 0
      ? `M ${fgX1} ${fgY1} A ${r} ${r} 0 0 1 ${fgX2} ${fgY2}`
      : "";

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[200px]">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="14"
          strokeLinecap="round"
          opacity={0.5}
        />

        {/* Score arc with glow */}
        {fgPath && (
          <>
            {/* Glow layer */}
            <path
              d={fgPath}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
              opacity={0.3}
              filter="url(#glow)"
            />
            {/* Main arc */}
            <path
              d={fgPath}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
            />
          </>
        )}

        {/* Score text */}
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          className="text-3xl font-bold"
          fill={color}
          style={{ fontSize: "36px", fontFamily: "var(--font-display)" }}
        >
          {clampedScore}%
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fill="var(--color-text-secondary)"
          style={{ fontSize: "11px" }}
        >
          {score === 0 ? "No Data" : label}
        </text>
      </svg>
    </div>
  );
}
