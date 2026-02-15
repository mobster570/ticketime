import { useMemo } from "react";
import { X, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PhaseIndicator } from "@/components/sync/PhaseIndicator";
import { ProgressBar } from "@/components/sync/ProgressBar";
import { BinarySearchViz } from "@/components/sync/BinarySearchViz";
import { ConvergenceChart } from "@/components/sync/ConvergenceChart";
import { NetworkStats } from "@/components/sync/NetworkStats";
import { PrecisionStatus } from "@/components/sync/PrecisionStatus";
import { useSyncStore } from "@/stores/syncStore";
import type { Server } from "@/types/server";

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

  const currentPhase = progress?.phase ?? (result ? "complete" : "idle");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-[800px] max-h-[90vh] overflow-y-auto bg-[var(--color-bg-secondary)] border-[var(--color-border)] p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {isActive ? "Synchronization in Progress" : result ? "Sync Complete" : "Sync"}
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {server.url}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Phase indicator */}
          <div className="flex justify-center mb-6">
            <PhaseIndicator currentPhase={currentPhase} />
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-3 gap-6">
            {/* Left column: progress + visualizations */}
            <div className="col-span-2 space-y-6">
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
                <Card className="space-y-2">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                    Result
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Total Offset</p>
                      <p className="font-mono font-semibold text-[var(--color-accent)]">
                        {result.total_offset_ms >= 0 ? "+" : ""}{result.total_offset_ms.toFixed(2)} ms
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Duration</p>
                      <p className="font-mono text-[var(--color-text-primary)]">
                        {(result.duration_ms / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Verified</p>
                      <p className={result.verified ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}>
                        {result.verified ? "Yes" : "No"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-secondary)]">Median RTT</p>
                      <p className="font-mono text-[var(--color-text-primary)]">
                        {(result.latency_profile.median * 1000).toFixed(1)} ms
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Right column: stats */}
            <div className="space-y-6">
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
              <PrecisionStatus
                intervalWidth={
                  phaseData.interval_width_ms !== undefined
                    ? Number(phaseData.interval_width_ms)
                    : null
                }
                convergencePercent={Number(phaseData.convergence_percent ?? progress?.progress_percent ?? 0)}
                verified={result?.verified ?? null}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border)] px-6 py-4">
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
      </Card>
    </div>
  );
}
