import { cn } from "@/lib/utils";
import type { ServerStatus } from "@/types/server";

const statusConfig: Record<
  ServerStatus,
  { color: string; label: string }
> = {
  idle: { color: "bg-gray-400", label: "Idle" },
  syncing: { color: "bg-[var(--color-warning)]", label: "Syncing" },
  synced: { color: "bg-[var(--color-success)]", label: "Synced" },
  error: { color: "bg-[var(--color-danger)]", label: "Error" },
};

interface StatusBadgeProps {
  status: ServerStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn("h-2 w-2 rounded-full", config.color)}
      />
      <span className="text-[var(--color-text-secondary)]">{config.label}</span>
    </span>
  );
}
