import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useServerDetail } from "@/hooks/useServerDetail";
import { useServerMetrics } from "@/hooks/useServerMetrics";
import { useSyncStore } from "@/stores/syncStore";
import { Breadcrumb } from "@/components/server-detail/Breadcrumb";
import { DetailHeader } from "@/components/server-detail/DetailHeader";
import { HeroClock } from "@/components/server-detail/HeroClock";
import { RttBoxPlot } from "@/components/server-detail/RttBoxPlot";
import { SyncHealthPanel } from "@/components/server-detail/SyncHealthPanel";
import { OffsetTrendChart } from "@/components/server-detail/OffsetTrendChart";
import { MetadataCards } from "@/components/server-detail/MetadataCards";
import { SyncProgressPanel } from "@/components/sync/SyncProgressPanel";

export function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const serverId = Number(id);

  const { server, syncHistory, latestResult, isLoading, error } =
    useServerDetail(serverId);
  const metrics = useServerMetrics(syncHistory, latestResult);
  const { startSync, isSyncing } = useSyncStore();
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const syncing = isSyncing(serverId);

  const handleResync = () => {
    startSync(serverId);
    setShowSyncPanel(true);
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-[var(--color-danger)]">Error: {error}</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-[var(--color-accent)] hover:underline cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-[var(--color-text-secondary)]">Server not found</p>
        <button
          onClick={() => navigate("/")}
          className="text-sm text-[var(--color-accent)] hover:underline cursor-pointer"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb server={server} />

        {/* Header: title + actions */}
        <DetailHeader
          server={server}
          syncHistory={syncHistory}
          onResync={handleResync}
          isSyncing={syncing}
        />

        {/* Grid layout: 8+4 top, 6+6 middle, 12 bottom */}
        <div className="grid grid-cols-12 gap-6">
          {/* Row 1: Hero Clock (8) + Health Panel (4) */}
          <div className="col-span-12 lg:col-span-8">
            <HeroClock
              serverId={serverId}
              server={server}
              latestResult={latestResult}
            />
          </div>
          <div className="col-span-12 lg:col-span-4">
            <SyncHealthPanel
              healthScore={metrics.healthScore}
              jitter={metrics.jitter}
              jitterStatus={metrics.jitterStatus}
              driftRate={metrics.driftRate}
              driftStatus={metrics.driftStatus}
            />
          </div>

          {/* Row 2: Charts (6+6) */}
          <div className="col-span-12 lg:col-span-6">
            <RttBoxPlot latencyProfile={latestResult?.latency_profile} />
          </div>
          <div className="col-span-12 lg:col-span-6">
            <OffsetTrendChart
              syncHistory={syncHistory}
              serverId={serverId}
            />
          </div>

          {/* Row 3: Metadata Cards */}
          <div className="col-span-12">
            <MetadataCards
              server={server}
              syncHistory={syncHistory}
              latestResult={latestResult}
            />
          </div>
        </div>
      </div>

      {showSyncPanel && server && (
        <SyncProgressPanel
          server={server}
          onClose={() => setShowSyncPanel(false)}
        />
      )}
    </main>
  );
}
