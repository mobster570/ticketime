import { useServerStore } from "@/stores/serverStore";
import { useSyncStore } from "@/stores/syncStore";

export function StatsCards() {
  const { servers } = useServerStore();
  const { syncResults } = useSyncStore();

  const syncedCount = servers.filter((s) => s.status === "synced").length;

  const offsets = servers
    .map((s) => s.offset_ms)
    .filter((o): o is number => o !== null);
  const avgOffset = offsets.length > 0
    ? offsets.reduce((a, b) => a + b, 0) / offsets.length
    : 0;

  const durations = Object.values(syncResults).map((r) => r.duration_ms);
  const avgDuration = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  const healthyCount = servers.filter((s) => {
    if (!s.last_sync_at) return false;
    const elapsed = Date.now() - new Date(s.last_sync_at).getTime();
    return elapsed < 5 * 60 * 1000;
  }).length;

  const isHealthy = servers.length > 0 && healthyCount === servers.length;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 text-sm font-medium uppercase tracking-tight text-[var(--color-text-secondary)]">
          Active Nodes
        </p>
        <p className="tabular-nums text-3xl font-bold text-[var(--color-text-primary)]">
          {syncedCount}
          <span className="ml-1 text-xl text-[var(--color-text-secondary)]">/ {servers.length}</span>
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 text-sm font-medium uppercase tracking-tight text-[var(--color-text-secondary)]">
          Avg. Offset
        </p>
        <p className="tabular-nums text-3xl font-bold text-[var(--color-text-primary)]">
          {offsets.length > 0 ? (
            <>
              {avgOffset >= 0 ? "+" : ""}{avgOffset.toFixed(1)}
              <span className="ml-1 text-xl text-[var(--color-text-secondary)]">ms</span>
            </>
          ) : (
            <span className="text-[var(--color-text-secondary)]">N/A</span>
          )}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 text-sm font-medium uppercase tracking-tight text-[var(--color-text-secondary)]">
          Health Status
        </p>
        <p className={`text-3xl font-bold uppercase ${
          isHealthy ? "text-emerald-400" : "text-[var(--color-warning)]"
        }`}>
          {servers.length > 0 ? (isHealthy ? "Stable" : "Degraded") : "N/A"}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
        <p className="mb-1 text-sm font-medium uppercase tracking-tight text-[var(--color-text-secondary)]">
          Avg Sync Time
        </p>
        <p className="tabular-nums text-3xl font-bold text-[var(--color-text-primary)]">
          {durations.length > 0 ? (
            <>
              {(avgDuration / 1000).toFixed(1)}
              <span className="ml-1 text-xl text-[var(--color-text-secondary)]">s</span>
            </>
          ) : (
            <span className="text-[var(--color-text-secondary)]">N/A</span>
          )}
        </p>
      </div>
    </div>
  );
}
