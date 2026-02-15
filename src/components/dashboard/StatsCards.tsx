import { Activity, Clock, Heart, Timer } from "lucide-react";
import { Card } from "@/components/ui/Card";
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

  const stats = [
    {
      label: "Active Nodes",
      value: `${syncedCount}/${servers.length}`,
      icon: Activity,
      color: "text-[var(--color-accent)]",
    },
    {
      label: "Net Offset",
      value: offsets.length > 0 ? `${avgOffset >= 0 ? "+" : ""}${avgOffset.toFixed(1)} ms` : "N/A",
      icon: Clock,
      color: "text-[var(--color-warning)]",
    },
    {
      label: "Health Status",
      value: servers.length > 0 ? `${healthyCount}/${servers.length} Good` : "N/A",
      icon: Heart,
      color: "text-[var(--color-success)]",
    },
    {
      label: "Avg Sync Time",
      value: durations.length > 0 ? `${(avgDuration / 1000).toFixed(1)}s` : "N/A",
      icon: Timer,
      color: "text-purple-400",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="flex items-center gap-3">
          <stat.icon className={`h-8 w-8 ${stat.color}`} />
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {stat.label}
            </p>
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">
              {stat.value}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
