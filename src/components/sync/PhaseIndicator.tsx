import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const phases = [
  { key: "latency_profiling", label: "Latency Profiling" },
  { key: "whole_second_offset", label: "Whole-Second" },
  { key: "binary_search", label: "Binary Search" },
  { key: "verification", label: "Verification" },
];

interface PhaseIndicatorProps {
  currentPhase: string;
}

export function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const currentIdx = phases.findIndex((p) => p.key === currentPhase);

  return (
    <div className="flex items-center gap-2">
      {phases.map((phase, i) => {
        const isComplete = i < currentIdx || currentPhase === "complete";
        const isCurrent = i === currentIdx;

        return (
          <div key={phase.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-0.5 w-8",
                  isComplete
                    ? "bg-[var(--color-success)]"
                    : isCurrent
                      ? "bg-[var(--color-accent)]"
                      : "bg-[var(--color-border)]",
                )}
              />
            )}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium",
                  isComplete
                    ? "bg-[var(--color-success)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-border)] text-[var(--color-text-secondary)]",
                )}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] whitespace-nowrap",
                  isCurrent
                    ? "text-[var(--color-accent)] font-medium"
                    : "text-[var(--color-text-secondary)]",
                )}
              >
                {phase.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
