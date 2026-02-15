import { useEffect, useRef, useCallback } from "react";
import { useServerStore } from "@/stores/serverStore";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { Server, SyncResult } from "@/types/server";

interface HeroClockProps {
  serverId: number;
  server: Server;
  latestResult?: SyncResult;
}

const STATUS_MAP: Record<
  Server["status"],
  { label: string; color: string }
> = {
  synced: { label: "Synchronized", color: "var(--color-success)" },
  syncing: { label: "Syncing", color: "var(--color-accent)" },
  idle: { label: "Idle", color: "var(--color-text-secondary)" },
  error: { label: "Error", color: "var(--color-danger)" },
};

export function HeroClock({ serverId, server, latestResult }: HeroClockProps) {
  const hhRef = useRef<HTMLSpanElement>(null);
  const mmRef = useRef<HTMLSpanElement>(null);
  const ssRef = useRef<HTMLSpanElement>(null);
  const msRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number>(0);

  const offsetMs = useServerStore(
    (s) => s.servers.find((srv) => srv.id === serverId)?.offset_ms ?? null,
  );

  const tick = useCallback(() => {
    const now = Date.now();
    const adjusted = offsetMs !== null ? now + offsetMs : now;
    const d = new Date(adjusted);

    if (hhRef.current) hhRef.current.textContent = String(d.getUTCHours()).padStart(2, "0");
    if (mmRef.current) mmRef.current.textContent = String(d.getUTCMinutes()).padStart(2, "0");
    if (ssRef.current) ssRef.current.textContent = String(d.getUTCSeconds()).padStart(2, "0");
    if (msRef.current) msRef.current.textContent = `.${String(d.getUTCMilliseconds()).padStart(3, "0")}`;

    rafRef.current = requestAnimationFrame(tick);
  }, [offsetMs]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  const status = STATUS_MAP[server.status];
  const hasOffset = offsetMs !== null;

  const formatOffset = (ms: number) => {
    const sign = ms >= 0 ? "+" : "";
    return `${sign}${ms.toFixed(2)}ms`;
  };

  const isOffsetSmall = offsetMs !== null && Math.abs(offsetMs) < 5;

  return (
    <Card className="relative overflow-hidden h-full min-h-[400px] py-10 flex flex-col justify-center items-center">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] pointer-events-none" />

      <div className="z-10 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <span className={cn(
            "inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
            server.status === "synced"
              ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : server.status === "syncing"
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : server.status === "error"
                  ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                  : "bg-[var(--color-text-secondary)]/10 text-[var(--color-text-secondary)]"
          )}>
            <span className={cn(
              "w-2 h-2 rounded-full",
              server.status === "synced" && "bg-[var(--color-success)] glow-success",
              server.status === "syncing" && "bg-[var(--color-accent)] animate-pulse",
              server.status === "error" && "bg-[var(--color-danger)]",
              server.status === "idle" && "bg-[var(--color-text-secondary)]"
            )} />
            {status.label}
          </span>

          <span className="text-xs uppercase tracking-widest text-[var(--color-text-secondary)] font-semibold">
            Current Precise Time (UTC)
          </span>
        </div>

        <div className="font-mono leading-none flex items-baseline">
          {hasOffset ? (
            <>
              <span ref={hhRef} className="text-6xl md:text-7xl lg:text-9xl font-bold tracking-tighter text-[var(--color-text-primary)]">
                00
              </span>
              <span className="text-6xl md:text-7xl lg:text-9xl font-bold tracking-tighter text-[var(--color-text-secondary)] animate-pulse">
                :
              </span>
              <span ref={mmRef} className="text-6xl md:text-7xl lg:text-9xl font-bold tracking-tighter text-[var(--color-text-primary)]">
                00
              </span>
              <span className="text-6xl md:text-7xl lg:text-9xl font-bold tracking-tighter text-[var(--color-text-secondary)] animate-pulse">
                :
              </span>
              <span ref={ssRef} className="text-6xl md:text-7xl lg:text-9xl font-bold tracking-tighter text-[var(--color-text-primary)]">
                00
              </span>
              <span
                ref={msRef}
                className="text-3xl md:text-4xl lg:text-6xl font-medium text-[var(--color-accent)] ml-2"
              >
                .000
              </span>
            </>
          ) : (
            <span className="text-6xl md:text-8xl font-bold text-[var(--color-text-secondary)]/50">
              --:--:--.---
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-12 mt-8 w-full max-w-2xl border-t border-[var(--color-border)] pt-8 text-center">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
              Offset
            </div>
            <div className={cn(
              "font-mono text-sm",
              isOffsetSmall ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"
            )}>
              {offsetMs !== null ? formatOffset(offsetMs) : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
              Extractor
            </div>
            <div className="font-mono text-sm text-[var(--color-text-primary)]">
              {server.extractor_type}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
              Verified
            </div>
            <div className={cn(
              "font-mono text-sm",
              latestResult?.verified ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"
            )}>
              {latestResult ? (latestResult.verified ? "Yes" : "No") : "—"}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
