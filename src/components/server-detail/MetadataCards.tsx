import { Globe, Clock, Cpu, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { Server, SyncResult } from "@/types/server";

interface MetadataCardsProps {
  server: Server;
  syncHistory: SyncResult[];
  latestResult?: SyncResult;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Invalid";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function extractorLabel(type: string): string {
  switch (type) {
    case "date_header":
      return "HTTP Date Header";
    default:
      return type;
  }
}

export function MetadataCards({
  server,
  syncHistory,
  latestResult,
}: MetadataCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Server Address */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1.5">
          <Globe className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Server Address
          </span>
        </div>
        <p className="font-mono text-sm text-[var(--color-text-primary)] truncate">
          {server.url}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {extractDomain(server.url)}
        </p>
      </Card>

      {/* Last Sync */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1.5">
          <Clock className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Last Sync
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-primary)]">
          {formatDate(server.last_sync_at)}
        </p>
        {latestResult && (
          <span
            className="mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: latestResult.verified
                ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                : "color-mix(in srgb, var(--color-warning) 15%, transparent)",
              color: latestResult.verified
                ? "var(--color-success)"
                : "var(--color-warning)",
            }}
          >
            {latestResult.verified ? "Verified" : "Unverified"}
          </span>
        )}
      </Card>

      {/* Extractor Type */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1.5">
          <Cpu className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Extractor Type
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-primary)]">
          {extractorLabel(server.extractor_type)}
        </p>
        <p className="mt-1 text-xs font-mono text-[var(--color-text-secondary)]">
          {server.extractor_type}
        </p>
      </Card>

      {/* Sync Stats */}
      <Card className="p-4">
        <div className="flex items-center gap-2 text-[var(--color-text-secondary)] mb-1.5">
          <BarChart3 className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Sync Stats
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-primary)]">
          {syncHistory.length} sync{syncHistory.length !== 1 ? "s" : ""} recorded
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          Added {formatDate(server.created_at)}
        </p>
      </Card>
    </div>
  );
}
