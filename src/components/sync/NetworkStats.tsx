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
    <div className="space-y-4">
      <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
        Network Stats
      </h3>
      <div className="space-y-3">
        <div className="bg-[var(--color-bg-deep)] p-4 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
            <ArrowUpDown className="h-4 w-4 text-[var(--color-accent)]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-medium">
              Requests Sent
            </p>
            <p className="text-sm font-mono font-semibold text-[var(--color-text-primary)] tabular-nums">
              {probeCount}
            </p>
          </div>
        </div>
        <div className="bg-[var(--color-bg-deep)] p-4 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-success)]/10 flex items-center justify-center flex-shrink-0">
            <Wifi className="h-4 w-4 text-[var(--color-success)]" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-medium">
              Median RTT
            </p>
            <p className="text-sm font-mono font-semibold text-[var(--color-text-primary)] tabular-nums">
              {medianRtt !== null ? `${(medianRtt * 1000).toFixed(1)} ms` : "--"}
            </p>
          </div>
        </div>
        <div className="bg-[var(--color-bg-deep)] p-4 rounded-xl border border-[var(--color-border)] flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[var(--color-warning)]/10 flex items-center justify-center flex-shrink-0">
            <Globe className="h-4 w-4 text-[var(--color-warning)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[var(--color-text-secondary)] uppercase tracking-wider font-medium">
              Target Server
            </p>
            <p className="text-sm font-mono font-semibold text-[var(--color-text-primary)] truncate">
              {serverUrl}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
