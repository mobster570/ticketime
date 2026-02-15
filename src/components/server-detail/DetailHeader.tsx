import { RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ExportButton } from "@/components/server-detail/ExportButton";
import type { Server, SyncResult } from "@/types/server";
import { useSyncStore } from "@/stores/syncStore";

interface DetailHeaderProps {
  server: Server;
  syncHistory: SyncResult[];
  onResync?: () => void;
  isSyncing?: boolean;
}

export function DetailHeader({
  server,
  syncHistory,
  onResync,
  isSyncing,
}: DetailHeaderProps) {
  const { cancelSync } = useSyncStore();

  const handleCancel = () => {
    cancelSync(server.id);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] font-[var(--font-display)] truncate">
          {server.name ?? server.url}
        </h1>
        {server.name && (
          <p className="mt-1 font-mono text-sm text-[var(--color-text-secondary)] truncate">
            {server.url}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <ExportButton syncHistory={syncHistory} serverName={server.name ?? server.url} />
        {isSyncing ? (
          <Button variant="danger" size="sm" onClick={handleCancel}>
            <XCircle className="mr-1.5 h-4 w-4" />
            Cancel Sync
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={onResync}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Re-sync Now
          </Button>
        )}
      </div>
    </div>
  );
}
