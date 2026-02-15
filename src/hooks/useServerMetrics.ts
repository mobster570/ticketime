import { useMemo } from "react";
import type { SyncResult } from "@/types/server";

interface ServerMetrics {
  healthScore: number;
  jitter: number | null;
  jitterStatus: string;
  driftRate: number | null;
  driftStatus: string;
}

export function useServerMetrics(
  syncHistory: SyncResult[],
  latestResult: SyncResult | undefined,
): ServerMetrics {
  const healthScore = useMemo(() => {
    if (!latestResult) return 0;

    const profile = latestResult.latency_profile;
    const iqr = profile.q3 - profile.q1;
    const jitterRatio = profile.median > 0 ? iqr / profile.median : 0;
    const jitterPenalty = Math.min(30, jitterRatio * 30);

    const lastSyncAge = Date.now() - new Date(latestResult.synced_at).getTime();
    const ageHours = lastSyncAge / (1000 * 60 * 60);
    const agePenalty = Math.min(40, ageHours * (40 / 24));

    const verificationPenalty = latestResult.verified ? 0 : 20;

    return Math.max(0, Math.round(100 - jitterPenalty - agePenalty - verificationPenalty));
  }, [latestResult]);

  const jitter = useMemo(() => {
    if (!latestResult) return null;
    const profile = latestResult.latency_profile;
    return profile.q3 - profile.q1;
  }, [latestResult]);

  const jitterStatus = useMemo(() => {
    if (!latestResult || jitter === null) return "Unknown";
    const profile = latestResult.latency_profile;
    return jitter < profile.median * 0.5 ? "Stable" : "Unstable";
  }, [latestResult, jitter]);

  const driftRate = useMemo(() => {
    if (syncHistory.length < 2) return null;

    const points = syncHistory.map((r) => ({
      t: new Date(r.synced_at).getTime(),
      offset: r.total_offset_ms,
    }));

    const n = points.length;
    const sumT = points.reduce((s, p) => s + p.t, 0);
    const sumO = points.reduce((s, p) => s + p.offset, 0);
    const sumTO = points.reduce((s, p) => s + p.t * p.offset, 0);
    const sumTT = points.reduce((s, p) => s + p.t * p.t, 0);

    const denom = n * sumTT - sumT * sumT;
    if (denom === 0) return null;

    // slope is ms offset per ms time
    const slope = (n * sumTO - sumT * sumO) / denom;
    // convert to ms/hr
    return slope * 3600000;
  }, [syncHistory]);

  const driftStatus = useMemo(() => {
    if (driftRate === null) return "Unknown";
    return Math.abs(driftRate) < 10 ? "Stable" : "Unstable";
  }, [driftRate]);

  return { healthScore, jitter, jitterStatus, driftRate, driftStatus };
}
