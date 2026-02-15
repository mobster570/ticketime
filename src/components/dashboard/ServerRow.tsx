import { Play, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { Server } from "@/types/server";
import { useSyncStore } from "@/stores/syncStore";
import { useServerStore } from "@/stores/serverStore";

function getHealthLabel(server: Server): { label: string; color: string } {
  if (server.status === "error") return { label: "Error", color: "text-[var(--color-danger)]" };
  if (!server.last_sync_at) return { label: "Unknown", color: "text-gray-400" };

  const elapsed = Date.now() - new Date(server.last_sync_at).getTime();
  if (elapsed < 5 * 60 * 1000) return { label: "Good", color: "text-[var(--color-success)]" };
  if (elapsed < 60 * 60 * 1000) return { label: "Stale", color: "text-[var(--color-warning)]" };
  return { label: "Unknown", color: "text-gray-400" };
}

function formatOffset(ms: number | null): string {
  if (ms === null) return "--";
  return `${ms >= 0 ? "+" : ""}${ms.toFixed(2)} ms`;
}

function formatTimeAgo(isoStr: string | null): string {
  if (!isoStr) return "Never";
  const diff = Date.now() - new Date(isoStr).getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface ServerRowProps {
  server: Server;
  onSyncClick: (id: number) => void;
}

export function ServerRow({ server, onSyncClick }: ServerRowProps) {
  const { isSyncing } = useSyncStore();
  const { removeServer } = useServerStore();
  const health = getHealthLabel(server);
  const syncing = isSyncing(server.id) || server.status === "syncing";

  const handleDelete = () => {
    if (confirm(`Delete server ${server.url}?`)) {
      removeServer(server.id);
    }
  };

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-[var(--color-card-highlight)] transition-colors">
      <td className="px-4 py-3">
        <StatusBadge status={server.status} />
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            {server.url}
          </p>
          {server.name && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {server.name}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm font-mono text-[var(--color-text-primary)]">
        {formatOffset(server.offset_ms)}
      </td>
      <td className="px-4 py-3">
        <span className={`text-sm font-medium ${health.color}`}>
          {health.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        {formatTimeAgo(server.last_sync_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSyncClick(server.id)}
            disabled={syncing}
            title="Sync"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
