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
    <div className="bg-[var(--color-accent)]/5 border border-[var(--color-accent)]/20 p-5 rounded-xl space-y-4">
      <h3 className="text-xs font-bold text-[var(--color-accent)] uppercase tracking-widest">
        Precision Status
      </h3>

      {/* Current margin */}
      <div>
        <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-1">
          Current Margin
        </p>
        <p className="text-lg font-mono font-bold text-[var(--color-text-primary)]">
          {intervalWidth !== null
            ? intervalWidth < 1
              ? `±${(intervalWidth * 1000).toFixed(0)} `
              : `±${intervalWidth.toFixed(2)} `
            : "--"}
          {intervalWidth !== null && (
            <span className="text-xs text-[var(--color-text-secondary)] font-normal">
              {intervalWidth < 1 ? "μs" : "ms"}
            </span>
          )}
        </p>
      </div>

      {/* Confidence bar */}
      <div>
        <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-2">
          Confidence Score
        </p>
        <div className="flex gap-1">
          {Array.from({ length: segments }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-1.5 rounded-full ${
                i < filledSegments
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-accent)]/20"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Verification status */}
      {verified !== null && (
        <div className="pt-2 border-t border-[var(--color-accent)]/20">
          <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-1">
            Verification
          </p>
          <p
            className={`text-sm font-semibold ${
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
