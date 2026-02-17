import { useMemo } from "react";
import { X, StopCircle, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/sync/ProgressBar";
import { BinarySearchViz } from "@/components/sync/BinarySearchViz";
import { ConvergenceChart } from "@/components/sync/ConvergenceChart";
import { NetworkStats } from "@/components/sync/NetworkStats";
import { PrecisionStatus } from "@/components/sync/PrecisionStatus";
import { useSyncStore } from "@/stores/syncStore";
import type { Server, SyncPhase } from "@/types/server";
import { cn } from "@/lib/utils";

interface SyncProgressPanelProps {
  server: Server;
  onClose: () => void;
}

export function SyncProgressPanel({ server, onClose }: SyncProgressPanelProps) {
  const { activeSyncs, cancelSync, syncResults } = useSyncStore();
  const progress = activeSyncs[server.id];
  const result = syncResults[server.id];
  const isActive = !!progress;

  const phaseData = progress?.phase_data ?? {};

  const convergenceData = useMemo(() => {
    // This would ideally accumulate over time, but we show current state
    if (phaseData.iteration !== undefined && phaseData.interval_width_ms !== undefined) {
      // Build from current iteration backwards (approximation)
      const points = [];
      const currentIter = Number(phaseData.iteration);
      const currentWidth = Number(phaseData.interval_width_ms);
      for (let i = 0; i <= currentIter; i++) {
        // Approximate exponential convergence: width halves each iteration
        const width = 1000 / Math.pow(2, i);
        points.push({ iteration: i, width: i === currentIter ? currentWidth : width });
      }
      return points;
    }
    return [];
  }, [phaseData.iteration, phaseData.interval_width_ms]);

  const handleCancel = () => {
    cancelSync(server.id);
    onClose();
  };

  const currentPhase: SyncPhase | "idle" = progress?.phase ?? (result ? "complete" : "idle");

  // Get phase display name and color
  const getPhaseDisplay = (phase: SyncPhase | "idle") => {
    const phases: Record<SyncPhase | "idle", { label: string; color: string }> = {
      latency_profiling: { label: "Latency Profiling", color: "var(--color-accent)" },
      whole_second_offset: { label: "Whole-Second Offset", color: "var(--color-accent)" },
      binary_search: { label: "Binary Search", color: "var(--color-accent)" },
      verification: { label: "Verification", color: "var(--color-accent)" },
      complete: { label: "Complete", color: "var(--color-success)" },
      idle: { label: "Idle", color: "var(--color-text-secondary)" },
    };
    return phases[phase];
  };

  const phaseDisplay = getPhaseDisplay(currentPhase);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-bg-primary)]/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[var(--color-bg-card)] rounded-xl shadow-2xl border border-[var(--color-accent)]/20 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-accent)]/20 flex items-center justify-between bg-[var(--color-bg-deep)]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                {isActive ? "Synchronization in Progress" : result ? "Sync Complete" : "Sync"}
              </h2>
              <p className="text-sm font-medium" style={{ color: phaseDisplay.color }}>
                {phaseDisplay.label}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content: 12-col grid with bg-grid-pattern */}
        <div className="p-6 grid grid-cols-12 gap-6 bg-grid-pattern overflow-y-auto">
          {/* Left column (col-span-8): Progress card + visualizations */}
          <div className="col-span-8 space-y-6">
            <ProgressBar
              percent={progress?.progress_percent ?? (result ? 100 : 0)}
              elapsedMs={progress?.elapsed_ms ?? (result?.duration_ms ?? 0)}
            />

            {/* Binary search viz (Phase 3 only) */}
            {currentPhase === "binary_search" && (
              <BinarySearchViz
                leftBound={Number(phaseData.left_bound_ms ?? 0)}
                rightBound={Number(phaseData.right_bound_ms ?? 1000)}
                iteration={Number(phaseData.iteration ?? 0)}
              />
            )}

            {/* Convergence chart */}
            {convergenceData.length > 0 && (
              <ConvergenceChart data={convergenceData} />
            )}

            {/* Result display */}
            {result && !isActive && (
              <div className="bg-[var(--color-bg-deep)] p-6 rounded-xl border border-[var(--color-border)]">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">
                  Sync Result
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-1">
                      Total Offset
                    </p>
                    <p className="font-mono font-semibold text-lg text-[var(--color-accent)]">
                      {result.total_offset_ms >= 0 ? "+" : ""}{result.total_offset_ms.toFixed(2)} ms
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-1">
                      Duration
                    </p>
                    <p className="font-mono font-semibold text-lg text-[var(--color-text-primary)]">
                      {(result.duration_ms / 1000).toFixed(1)}s
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-1">
                      Verified
                    </p>
                    <p className={cn(
                      "font-semibold text-lg",
                      result.verified ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                    )}>
                      {result.verified ? "Yes" : "No"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wider font-medium mb-1">
                      Median RTT
                    </p>
                    <p className="font-mono font-semibold text-lg text-[var(--color-text-primary)]">
                      {(result.latency_profile.median * 1000).toFixed(1)} ms
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column (col-span-4): stats sidebar */}
          <div className="col-span-4 space-y-6">
            <PrecisionStatus
              intervalWidth={
                phaseData.interval_width_ms !== undefined
                  ? Number(phaseData.interval_width_ms)
                  : null
              }
              convergencePercent={Number(phaseData.convergence_percent ?? progress?.progress_percent ?? 0)}
              verified={result?.verified ?? null}
            />
            <NetworkStats
              serverUrl={server.url}
              medianRtt={
                phaseData.current_median_ms
                  ? Number(phaseData.current_median_ms) / 1000
                  : result
                    ? result.latency_profile.median
                    : null
              }
              probeCount={Number(phaseData.probe_index ?? phaseData.iteration ?? 0)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[var(--color-bg-deep)] px-6 py-4 border-t border-[var(--color-accent)]/20 flex justify-between items-center">
          <div />

          {/* cancel/close button */}
          {isActive ? (
            <Button variant="danger" onClick={handleCancel}>
              <StopCircle className="mr-1.5 h-4 w-4" />
              Cancel Sync
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
