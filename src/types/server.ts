export type ServerStatus = "idle" | "syncing" | "synced" | "error";

export type SyncPhase =
  | "latency_profiling"
  | "whole_second_offset"
  | "binary_search"
  | "verification"
  | "complete";

export interface Server {
  id: number;
  url: string;
  name: string | null;
  offset_ms: number | null;
  last_sync_at: string | null;
  created_at: string;
  status: ServerStatus;
  extractor_type: string;
}

export interface LatencyProfile {
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
}

export interface SyncResult {
  server_id: number;
  whole_second_offset: number;
  subsecond_offset: number;
  total_offset_ms: number;
  latency_profile: LatencyProfile;
  verified: boolean;
  synced_at: string;
  duration_ms: number;
  phase_reached: SyncPhase;
}

export interface SyncProgressPayload {
  server_id: number;
  phase: SyncPhase;
  progress_percent: number;
  phase_data: Record<string, unknown>;
  elapsed_ms: number;
}

export interface SyncCompletePayload {
  server_id: number;
  result: SyncResult;
}

export interface SyncErrorPayload {
  server_id: number;
  error: string;
}

export type SyncEvent =
  | { event: "Progress"; data: SyncProgressPayload }
  | { event: "Complete"; data: SyncCompletePayload }
  | { event: "Error"; data: SyncErrorPayload };
