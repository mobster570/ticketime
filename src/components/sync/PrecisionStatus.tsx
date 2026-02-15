interface PrecisionStatusProps {
  intervalWidth: number | null;
  convergencePercent: number;
  verified: boolean | null;
}

export function PrecisionStatus({
  intervalWidth,
  convergencePercent,
  verified,
}: PrecisionStatusProps) {
  const confidence = Math.min(100, convergencePercent);
  const segments = 5;
  const filledSegments = Math.round((confidence / 100) * segments);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
        Precision
      </h3>

      {/* Current margin */}
      <div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          Current Margin
        </p>
        <p className="text-lg font-mono font-semibold text-[var(--color-accent)]">
          {intervalWidth !== null
            ? intervalWidth < 1
              ? `+/- ${(intervalWidth * 1000).toFixed(0)} us`
              : `+/- ${intervalWidth.toFixed(2)} ms`
            : "--"}
        </p>
      </div>

      {/* Confidence bar */}
      <div>
        <p className="text-xs text-[var(--color-text-secondary)] mb-1">
          Confidence
        </p>
        <div className="flex gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-sm ${
                i < filledSegments
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-border)]"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Verification status */}
      {verified !== null && (
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Verification
          </p>
          <p
            className={`text-sm font-medium ${
              verified
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {verified ? "Verified" : "Failed"}
          </p>
        </div>
      )}
    </div>
  );
}
