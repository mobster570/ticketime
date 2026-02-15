import { Play, Trash2, Loader2 } from "lucide-react";
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
  if (ms === null) return "---";
  return `${ms >= 0 ? "+" : ""}${ms.toFixed(2)}ms`;
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

  // Status display with inline dot + label
  const getStatusDisplay = () => {
    switch (server.status) {
      case "synced":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] glow-success" />
            <span className="text-xs font-bold text-[var(--color-success)] uppercase">Synced</span>
          </div>
        );
      case "syncing":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)] glow-warning" />
            <span className="text-xs font-bold text-[var(--color-warning)] uppercase">Syncing</span>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-danger)]" />
            <span className="text-xs font-bold text-[var(--color-danger)] uppercase">Error</span>
          </div>
        );
      case "idle":
      default:
        return (
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
            <span className="text-xs font-bold text-gray-400 uppercase">Idle</span>
          </div>
        );
    }
  };

  // Offset color based on status
  const getOffsetColor = () => {
    if (server.offset_ms === null) return "text-[var(--color-text-secondary)]";
    if (server.status === "synced") return "text-emerald-400";
    if (server.status === "syncing") return "text-amber-400";
    return "text-[var(--color-text-secondary)]";
  };

  return (
    <tr className="hover:bg-[var(--color-card-highlight)] transition-colors group">
      <td className="px-6 py-5">
        {getStatusDisplay()}
      </td>
      <td className="px-6 py-5">
        <div>
          <p className="font-bold text-[var(--color-text-primary)]">
            {server.url}
          </p>
          {server.name && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              {server.name}
            </p>
          )}
        </div>
      </td>
      <td className={`px-6 py-5 font-mono font-bold tabular-nums ${getOffsetColor()}`}>
        {formatOffset(server.offset_ms)}
      </td>
      <td className="px-6 py-5">
        <span className={`text-sm font-medium ${health.color}`}>
          {health.label}
        </span>
      </td>
      <td className="px-6 py-5 text-sm text-[var(--color-text-secondary)]">
        {formatTimeAgo(server.last_sync_at)}
      </td>
      <td className="px-6 py-5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onSyncClick(server.id)}
            disabled={syncing}
            title="Sync"
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handleDelete}
            title="Delete"
            className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
