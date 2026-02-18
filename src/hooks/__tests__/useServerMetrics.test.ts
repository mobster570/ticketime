import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useServerMetrics } from "@/hooks/useServerMetrics";
import type { SyncResult, LatencyProfile } from "@/types/server";

function makeProfile(overrides: Partial<LatencyProfile> = {}): LatencyProfile {
  return {
    min: 10,
    q1: 12,
    median: 20,
    mean: 20,
    q3: 24,
    max: 40,
    ...overrides,
  };
}

function makeResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    server_id: 1,
    whole_second_offset: 0,
    subsecond_offset: 0,
    total_offset_ms: 0,
    latency_profile: makeProfile(),
    verified: true,
    synced_at: new Date().toISOString(), // very recent — minimal age penalty
    duration_ms: 200,
    phase_reached: "complete",
    ...overrides,
  };
}

describe("useServerMetrics", () => {
  describe("with no latestResult", () => {
    it("returns healthScore 0", () => {
      const { result } = renderHook(() => useServerMetrics([], undefined));
      expect(result.current.healthScore).toBe(0);
    });

    it("returns jitter null", () => {
      const { result } = renderHook(() => useServerMetrics([], undefined));
      expect(result.current.jitter).toBeNull();
    });

    it("returns jitterStatus Unknown", () => {
      const { result } = renderHook(() => useServerMetrics([], undefined));
      expect(result.current.jitterStatus).toBe("Unknown");
    });

    it("returns driftRate null", () => {
      const { result } = renderHook(() => useServerMetrics([], undefined));
      expect(result.current.driftRate).toBeNull();
    });

    it("returns driftStatus Unknown", () => {
      const { result } = renderHook(() => useServerMetrics([], undefined));
      expect(result.current.driftStatus).toBe("Unknown");
    });
  });

  describe("healthScore", () => {
    it("returns near 100 for a recent, verified sync with low jitter", () => {
      // q1=12, q3=14 => iqr=2, median=20 => jitterRatio=0.1 => jitterPenalty=3
      // age ~0 => agePenalty ~0, verified => verificationPenalty=0
      // score ≈ 97
      const latencyProfile = makeProfile({ q1: 12, q3: 14, median: 20 });
      const latest = makeResult({ latency_profile: latencyProfile });
      const { result } = renderHook(() => useServerMetrics([], latest));
      expect(result.current.healthScore).toBeGreaterThanOrEqual(90);
    });

    it("applies verificationPenalty of 20 when not verified", () => {
      const latest = makeResult({ verified: false });
      const verified = makeResult({ verified: true });
      const { result: unverifiedResult } = renderHook(() => useServerMetrics([], latest));
      const { result: verifiedResult } = renderHook(() => useServerMetrics([], verified));
      // Unverified should be 20 less (both same profile and synced_at)
      expect(verifiedResult.current.healthScore - unverifiedResult.current.healthScore).toBe(20);
    });

    it("floors at 10 when all penalties are maxed", () => {
      // agePenalty capped at 40, jitterPenalty capped at 30, verificationPenalty = 20
      // total = 90, score = max(0, round(100 - 90)) = 10
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      // iqr=40, median=1 => jitterRatio=40 => penalty capped at 30
      const profile = makeProfile({ q1: 0, q3: 40, median: 1 });
      const latest = makeResult({ synced_at: oldDate, latency_profile: profile, verified: false });
      const { result } = renderHook(() => useServerMetrics([], latest));
      expect(result.current.healthScore).toBe(10);
    });
  });

  describe("jitter", () => {
    it("returns q3 - q1", () => {
      const profile = makeProfile({ q1: 10, q3: 25 });
      const latest = makeResult({ latency_profile: profile });
      const { result } = renderHook(() => useServerMetrics([], latest));
      expect(result.current.jitter).toBe(15);
    });
  });

  describe("jitterStatus", () => {
    it("returns Stable when jitter < median * 0.5", () => {
      // q3-q1 = 14-12 = 2, median=20, threshold = 10 => Stable
      const profile = makeProfile({ q1: 12, q3: 14, median: 20 });
      const latest = makeResult({ latency_profile: profile });
      const { result } = renderHook(() => useServerMetrics([], latest));
      expect(result.current.jitterStatus).toBe("Stable");
    });

    it("returns Unstable when jitter >= median * 0.5", () => {
      // q3-q1 = 20, median=20, threshold=10 => Unstable
      const profile = makeProfile({ q1: 10, q3: 30, median: 20 });
      const latest = makeResult({ latency_profile: profile });
      const { result } = renderHook(() => useServerMetrics([], latest));
      expect(result.current.jitterStatus).toBe("Unstable");
    });
  });

  describe("driftRate", () => {
    it("returns null with 0 sync results", () => {
      const latest = makeResult();
      const { result } = renderHook(() => useServerMetrics([], latest));
      expect(result.current.driftRate).toBeNull();
    });

    it("returns null with 1 sync result", () => {
      const r = makeResult();
      const { result } = renderHook(() => useServerMetrics([r], r));
      expect(result.current.driftRate).toBeNull();
    });

    it("calculates linear regression slope with 2 results", () => {
      // Two points: same synced_at offset difference => deterministic slope
      const t1 = new Date("2024-01-01T00:00:00Z").getTime();
      const t2 = t1 + 3600000; // 1 hour later
      const r1: SyncResult = makeResult({ synced_at: new Date(t1).toISOString(), total_offset_ms: 0 });
      const r2: SyncResult = makeResult({ synced_at: new Date(t2).toISOString(), total_offset_ms: 10 });
      const { result } = renderHook(() => useServerMetrics([r1, r2], r2));
      // slope (ms/ms) * 3600000 = drift per hour in ms
      // deltaOffset=10, deltaT=3600000ms => slope=10/3600000 ms/ms => *3600000 = 10 ms/hr
      // Precision limited by floating-point with large epoch timestamps
      expect(result.current.driftRate).toBeCloseTo(10, 1);
    });

    it("returns null when all time values are identical (denom = 0)", () => {
      const ts = new Date("2024-01-01T00:00:00Z").toISOString();
      const r1 = makeResult({ synced_at: ts, total_offset_ms: 5 });
      const r2 = makeResult({ synced_at: ts, total_offset_ms: 10 });
      const { result } = renderHook(() => useServerMetrics([r1, r2], r2));
      expect(result.current.driftRate).toBeNull();
    });
  });

  describe("driftStatus", () => {
    it("returns Unknown when driftRate is null (< 2 results)", () => {
      const latest = makeResult();
      const { result } = renderHook(() => useServerMetrics([latest], latest));
      expect(result.current.driftStatus).toBe("Unknown");
    });

    it("returns Stable when |driftRate| < 10", () => {
      const t1 = new Date("2024-01-01T00:00:00Z").getTime();
      const t2 = t1 + 3600000;
      // drift = 5 ms/hr < 10 => Stable
      const r1 = makeResult({ synced_at: new Date(t1).toISOString(), total_offset_ms: 0 });
      const r2 = makeResult({ synced_at: new Date(t2).toISOString(), total_offset_ms: 5 });
      const { result } = renderHook(() => useServerMetrics([r1, r2], r2));
      expect(result.current.driftStatus).toBe("Stable");
    });

    it("returns Unstable when |driftRate| >= 10", () => {
      const t1 = new Date("2024-01-01T00:00:00Z").getTime();
      const t2 = t1 + 3600000;
      // drift = 20 ms/hr >= 10 => Unstable
      const r1 = makeResult({ synced_at: new Date(t1).toISOString(), total_offset_ms: 0 });
      const r2 = makeResult({ synced_at: new Date(t2).toISOString(), total_offset_ms: 20 });
      const { result } = renderHook(() => useServerMetrics([r1, r2], r2));
      expect(result.current.driftStatus).toBe("Unstable");
    });
  });
});
