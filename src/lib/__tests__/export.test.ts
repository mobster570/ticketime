import { describe, it, expect } from "vitest";
import { syncHistoryToCsv, syncHistoryToJson } from "@/lib/export";
import type { SyncResult } from "@/types/server";

const EXPECTED_HEADER = "synced_at,total_offset_ms,whole_second_offset,subsecond_offset,verified,duration_ms,min,q1,median,q3,max";

function makeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    server_id: 1,
    synced_at: "2026-01-01T00:00:00Z",
    total_offset_ms: 10.5,
    whole_second_offset: 10,
    subsecond_offset: 0.5,
    verified: true,
    duration_ms: 250,
    phase_reached: "complete",
    latency_profile: {
      min: 5,
      q1: 7,
      median: 9,
      mean: 9.5,
      q3: 11,
      max: 15,
    },
    ...overrides,
  };
}

describe("syncHistoryToCsv()", () => {
  it("produces the correct header row", () => {
    const csv = syncHistoryToCsv([]);
    expect(csv).toBe(EXPECTED_HEADER);
  });

  it("produces correct data row with all fields", () => {
    const result = makeSyncResult();
    const csv = syncHistoryToCsv([result]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(EXPECTED_HEADER);
    expect(lines[1]).toBe(
      "2026-01-01T00:00:00Z,10.5,10,0.5,true,250,5,7,9,11,15",
    );
  });

  it("handles empty array (header only, no trailing newline)", () => {
    const csv = syncHistoryToCsv([]);
    expect(csv).toBe(EXPECTED_HEADER);
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("handles multiple results producing one row each", () => {
    const r1 = makeSyncResult({ synced_at: "2026-01-01T00:00:00Z", total_offset_ms: 1 });
    const r2 = makeSyncResult({ synced_at: "2026-01-02T00:00:00Z", total_offset_ms: 2 });
    const csv = syncHistoryToCsv([r1, r2]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(EXPECTED_HEADER);
    expect(lines[1]).toContain("2026-01-01T00:00:00Z");
    expect(lines[2]).toContain("2026-01-02T00:00:00Z");
  });

  it("does not include latency profile mean column", () => {
    const csv = syncHistoryToCsv([makeSyncResult()]);
    expect(csv).not.toContain("mean");
  });

  it("renders false for unverified results", () => {
    const result = makeSyncResult({ verified: false });
    const csv = syncHistoryToCsv([result]);
    const dataRow = csv.split("\n")[1];
    expect(dataRow).toContain(",false,");
  });
});

describe("syncHistoryToJson()", () => {
  it("returns valid JSON that can be parsed back", () => {
    const results = [makeSyncResult()];
    const json = syncHistoryToJson(results);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("round-trips the data faithfully", () => {
    const results = [makeSyncResult()];
    const parsed = JSON.parse(syncHistoryToJson(results));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].synced_at).toBe("2026-01-01T00:00:00Z");
    expect(parsed[0].total_offset_ms).toBe(10.5);
    expect(parsed[0].latency_profile.median).toBe(9);
  });

  it("returns an empty JSON array for no results", () => {
    const json = syncHistoryToJson([]);
    expect(JSON.parse(json)).toEqual([]);
  });

  it("uses 2-space indentation", () => {
    const json = syncHistoryToJson([makeSyncResult()]);
    expect(json).toContain("  ");
    expect(json).toMatch(/^\[/);
  });

  it("preserves all fields including phase_reached", () => {
    const result = makeSyncResult({ phase_reached: "verification" });
    const parsed = JSON.parse(syncHistoryToJson([result]));
    expect(parsed[0].phase_reached).toBe("verification");
  });
});
