import { useState } from "react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { ServerTable } from "@/components/dashboard/ServerTable";
import { SyncProgressPanel } from "@/components/sync/SyncProgressPanel";
import { useSyncStore } from "@/stores/syncStore";
import { useServerStore } from "@/stores/serverStore";

export function DashboardPage() {
  const { startSync } = useSyncStore();
  const { servers } = useServerStore();
  const [syncPanelServerId, setSyncPanelServerId] = useState<number | null>(null);

  const handleSyncClick = (id: number) => {
    setSyncPanelServerId(id);
    startSync(id);
  };

  const syncPanelServer = syncPanelServerId !== null
    ? servers.find((s) => s.id === syncPanelServerId) ?? null
    : null;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <StatsCards />

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Network Overview</h2>
        </div>

        <ServerTable onSyncClick={handleSyncClick} />

        {syncPanelServer && (
          <SyncProgressPanel
            server={syncPanelServer}
            onClose={() => setSyncPanelServerId(null)}
          />
        )}
      </div>
    </div>
  );
}
