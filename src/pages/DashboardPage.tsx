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
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      <StatsCards />
      <ServerTable onSyncClick={handleSyncClick} />

      {syncPanelServer && (
        <SyncProgressPanel
          server={syncPanelServer}
          onClose={() => setSyncPanelServerId(null)}
        />
      )}
    </div>
  );
}
