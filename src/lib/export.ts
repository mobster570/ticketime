import type { SyncResult } from "@/types/server";

const CSV_COLUMNS = [
  "synced_at",
  "total_offset_ms",
  "whole_second_offset",
  "subsecond_offset",
  "verified",
  "duration_ms",
  "min",
  "q1",
  "median",
  "q3",
  "max",
] as const;

export function syncHistoryToCsv(results: SyncResult[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = results.map((r) =>
    [
      r.synced_at,
      r.total_offset_ms,
      r.whole_second_offset,
      r.subsecond_offset,
      r.verified,
      r.duration_ms,
      r.latency_profile.min,
      r.latency_profile.q1,
      r.latency_profile.median,
      r.latency_profile.q3,
      r.latency_profile.max,
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

export function syncHistoryToJson(results: SyncResult[]): string {
  return JSON.stringify(results, null, 2);
}
