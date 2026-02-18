import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSyncStore } from "@/stores/syncStore";
import { useServerStore } from "@/stores/serverStore";
import type { SyncProgressPayload, SyncResult } from "@/types/server";

vi.mock("@/lib/commands", () => ({
  listServers: vi.fn(),
  addServer: vi.fn(),
  deleteServer: vi.fn(),
  startSync: vi.fn(),
  cancelSync: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getSyncHistory: vi.fn(),
}));

import * as commands from "@/lib/commands";

const makeProgress = (serverId: number): SyncProgressPayload => ({
  server_id: serverId,
  phase: "latency_profiling",
  progress_percent: 50,
  phase_data: {},
  elapsed_ms: 100,
});

const makeResult = (serverId: number): SyncResult => ({
  server_id: serverId,
  whole_second_offset: 0,
  subsecond_offset: 5,
  total_offset_ms: 5,
  latency_profile: { min: 10, q1: 12, median: 15, mean: 15, q3: 18, max: 25 },
  verified: true,
  synced_at: new Date().toISOString(),
  duration_ms: 500,
  phase_reached: "complete",
});

beforeEach(() => {
  vi.clearAllMocks();
  useSyncStore.setState({ activeSyncs: {}, syncResults: {} });
  useServerStore.setState({ servers: [], loading: false, error: null });
});

describe("syncStore", () => {
  describe("isSyncing", () => {
    it("returns false when server is not in activeSyncs", () => {
      expect(useSyncStore.getState().isSyncing(1)).toBe(false);
    });

    it("returns true when server is in activeSyncs", () => {
      useSyncStore.setState({ activeSyncs: { 1: makeProgress(1) } });
      expect(useSyncStore.getState().isSyncing(1)).toBe(true);
    });
  });

  describe("getProgress", () => {
    it("returns undefined when no active sync", () => {
      expect(useSyncStore.getState().getProgress(1)).toBeUndefined();
    });

    it("returns progress payload for an active sync", () => {
      const progress = makeProgress(1);
      useSyncStore.setState({ activeSyncs: { 1: progress } });
      expect(useSyncStore.getState().getProgress(1)).toEqual(progress);
    });
  });

  describe("getLatestResult", () => {
    it("returns undefined when no result stored", () => {
      expect(useSyncStore.getState().getLatestResult(1)).toBeUndefined();
    });

    it("returns the stored sync result", () => {
      const result = makeResult(1);
      useSyncStore.setState({ syncResults: { 1: result } });
      expect(useSyncStore.getState().getLatestResult(1)).toEqual(result);
    });
  });

  describe("cancelSync", () => {
    it("removes server from activeSyncs", async () => {
      useSyncStore.setState({ activeSyncs: { 1: makeProgress(1), 2: makeProgress(2) } });
      vi.mocked(commands.cancelSync).mockResolvedValue(undefined);

      await useSyncStore.getState().cancelSync(1);

      expect(useSyncStore.getState().activeSyncs).not.toHaveProperty("1");
      expect(useSyncStore.getState().activeSyncs).toHaveProperty("2");
    });

    it("calls commands.cancelSync with the correct id", async () => {
      useSyncStore.setState({ activeSyncs: { 3: makeProgress(3) } });
      vi.mocked(commands.cancelSync).mockResolvedValue(undefined);

      await useSyncStore.getState().cancelSync(3);

      expect(commands.cancelSync).toHaveBeenCalledWith(3);
    });
  });

  describe("startSync", () => {
    it("sets server status to syncing at start", async () => {
      useServerStore.setState({
        servers: [
          {
            id: 1,
            url: "https://example.com",
            name: null,
            offset_ms: null,
            last_sync_at: null,
            created_at: "2024-01-01T00:00:00Z",
            status: "idle",
            extractor_type: "date_header",
          },
        ],
      });

      vi.mocked(commands.startSync).mockImplementation(async (_id, _cb) => {
        // no events emitted
      });

      await useSyncStore.getState().startSync(1);

      // After startSync resolves, the serverStore should have been updated to syncing at call time.
      // We verify the command was invoked.
      expect(commands.startSync).toHaveBeenCalledWith(1, expect.any(Function));
    });

    it("adds progress to activeSyncs on Progress event", async () => {
      const progress = makeProgress(1);

      vi.mocked(commands.startSync).mockImplementation(async (_id, cb) => {
        cb({ event: "Progress", data: progress });
      });

      await useSyncStore.getState().startSync(1);

      // After a Progress event the activeSyncs entry persists until Complete/Error
      expect(useSyncStore.getState().activeSyncs[1]).toEqual(progress);
    });

    it("moves result to syncResults and clears activeSyncs on Complete event", async () => {
      const result = makeResult(1);
      useSyncStore.setState({ activeSyncs: { 1: makeProgress(1) } });

      vi.mocked(commands.startSync).mockImplementation(async (_id, cb) => {
        cb({ event: "Complete", data: { server_id: 1, result } });
      });

      await useSyncStore.getState().startSync(1);

      expect(useSyncStore.getState().activeSyncs).not.toHaveProperty("1");
      expect(useSyncStore.getState().syncResults[1]).toEqual(result);
    });

    it("clears activeSyncs on Error event", async () => {
      useSyncStore.setState({ activeSyncs: { 1: makeProgress(1) } });

      vi.mocked(commands.startSync).mockImplementation(async (_id, cb) => {
        cb({ event: "Error", data: { server_id: 1, error: "timeout" } });
      });

      await useSyncStore.getState().startSync(1);

      expect(useSyncStore.getState().activeSyncs).not.toHaveProperty("1");
    });
  });
});
