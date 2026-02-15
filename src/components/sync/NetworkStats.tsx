import { Card } from "@/components/ui/Card";
import { Wifi, ArrowUpDown, Globe } from "lucide-react";

interface NetworkStatsProps {
  serverUrl: string;
  medianRtt: number | null;
  probeCount: number;
}

export function NetworkStats({
  serverUrl,
  medianRtt,
  probeCount,
}: NetworkStatsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
        Network Stats
      </h3>
      <div className="space-y-2">
        <Card className="flex items-center gap-3 py-3">
          <ArrowUpDown className="h-4 w-4 text-[var(--color-accent)]" />
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Packets Sent
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {probeCount}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 py-3">
          <Wifi className="h-4 w-4 text-[var(--color-success)]" />
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Current RTT
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {medianRtt !== null ? `${(medianRtt * 1000).toFixed(1)} ms` : "--"}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 py-3">
          <Globe className="h-4 w-4 text-[var(--color-warning)]" />
          <div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Target Server
            </p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] truncate max-w-36">
              {serverUrl}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
