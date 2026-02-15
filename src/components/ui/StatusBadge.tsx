import { cn } from "@/lib/utils";
import type { ServerStatus } from "@/types/server";

const statusConfig: Record<
  ServerStatus,
  { dotClass: string; textClass: string; label: string }
> = {
  idle: { dotClass: "bg-gray-400", textClass: "text-gray-400", label: "Idle" },
  syncing: { dotClass: "bg-[var(--color-warning)] glow-warning", textClass: "text-[var(--color-warning)]", label: "Syncing" },
  synced: { dotClass: "bg-[var(--color-success)] glow-success", textClass: "text-[var(--color-success)]", label: "Synced" },
  error: { dotClass: "bg-[var(--color-danger)]", textClass: "text-[var(--color-danger)]", label: "Error" },
};

interface StatusBadgeProps {
  status: ServerStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        className={cn("h-2.5 w-2.5 rounded-full", config.dotClass)}
      />
      <span className={cn("text-xs font-bold uppercase", config.textClass)}>{config.label}</span>
    </span>
  );
}
