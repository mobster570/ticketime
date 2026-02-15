import { Zap, TrendingUp, Info } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { HealthGauge } from "@/components/server-detail/HealthGauge";
import { cn } from "@/lib/utils";

interface SyncHealthPanelProps {
  healthScore: number;
  jitter: number | null;
  jitterStatus: string;
  driftRate: number | null;
  driftStatus: string;
}

export function SyncHealthPanel({
  healthScore,
  jitter,
  jitterStatus,
  driftRate,
  driftStatus,
}: SyncHealthPanelProps) {
  const jitterValue =
    jitter !== null ? `${jitter.toFixed(2)} ms` : "N/A";
  const driftValue =
    driftRate !== null ? `${driftRate.toFixed(2)} ms/hr` : "N/A";

  const jitterColor =
    jitterStatus === "Stable"
      ? "var(--color-success)"
      : "var(--color-warning)";
  const driftColor =
    driftStatus === "Stable"
      ? "var(--color-success)"
      : "var(--color-warning)";

  return (
    <Card className="h-full flex flex-col p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
          Sync Health
        </h3>
        <Info className="h-4 w-4 text-[var(--color-text-secondary)] opacity-50" />
      </div>

      {/* Gauge Area */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <HealthGauge score={healthScore} />
      </div>

      {/* Metric Rows */}
      <div className="space-y-3 mt-6">
        {/* Jitter Row */}
        <div
          className={cn(
            "p-4 rounded-lg flex items-center justify-between",
            "bg-[var(--color-bg-primary)]",
            jitterStatus === "Unstable" && "border border-[var(--color-warning)]/30"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-success)]">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
                Jitter (IQR)
              </p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {jitterValue}
              </p>
            </div>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded uppercase font-bold"
            style={{
              backgroundColor: `color-mix(in srgb, ${jitterColor} 10%, transparent)`,
              color: jitterColor,
            }}
          >
            {jitterStatus}
          </span>
        </div>

        {/* Drift Row */}
        <div
          className={cn(
            "p-4 rounded-lg flex items-center justify-between",
            "bg-[var(--color-bg-primary)]",
            driftStatus !== "Stable" &&
              driftStatus !== "Unknown" &&
              "border border-[var(--color-warning)]/30"
          )}
        >
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-success)]">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
                Drift Rate
              </p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {driftValue}
              </p>
            </div>
          </div>
          <span
            className="text-[10px] px-2 py-0.5 rounded uppercase font-bold"
            style={{
              backgroundColor: `color-mix(in srgb, ${driftColor} 10%, transparent)`,
              color: driftColor,
            }}
          >
            {driftStatus}
          </span>
        </div>
      </div>
    </Card>
  );
}
