import { describe, it, expect, vi, beforeEach } from "vitest";
import { useServerStore } from "@/stores/serverStore";
import type { Server } from "@/types/server";

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

const makeServer = (id: number, url = `https://server${id}.example.com`): Server => ({
  id,
  url,
  name: null,
  offset_ms: null,
  last_sync_at: null,
  created_at: "2024-01-01T00:00:00Z",
  status: "idle",
  extractor_type: "date_header",
});

beforeEach(() => {
  vi.clearAllMocks();
  useServerStore.setState({ servers: [], loading: false, error: null });
});

describe("serverStore", () => {
  describe("initial state", () => {
    it("has empty servers array", () => {
      expect(useServerStore.getState().servers).toEqual([]);
    });

    it("has loading false", () => {
      expect(useServerStore.getState().loading).toBe(false);
    });

    it("has error null", () => {
      expect(useServerStore.getState().error).toBeNull();
    });
  });

  describe("fetchServers", () => {
    it("populates servers on success", async () => {
      const servers = [makeServer(1), makeServer(2)];
      vi.mocked(commands.listServers).mockResolvedValue(servers);

      await useServerStore.getState().fetchServers();

      expect(useServerStore.getState().servers).toEqual(servers);
      expect(useServerStore.getState().loading).toBe(false);
      expect(useServerStore.getState().error).toBeNull();
    });

    it("sets error on failure", async () => {
      vi.mocked(commands.listServers).mockRejectedValue(new Error("network error"));

      await useServerStore.getState().fetchServers();

      expect(useServerStore.getState().error).toContain("network error");
      expect(useServerStore.getState().loading).toBe(false);
      expect(useServerStore.getState().servers).toEqual([]);
    });
  });

  describe("addServer", () => {
    it("appends the new server on success", async () => {
      const existing = makeServer(1);
      useServerStore.setState({ servers: [existing] });
      const newServer = makeServer(2);
      vi.mocked(commands.addServer).mockResolvedValue(newServer);

      await useServerStore.getState().addServer("https://server2.example.com");

      expect(useServerStore.getState().servers).toEqual([existing, newServer]);
      expect(useServerStore.getState().error).toBeNull();
    });

    it("sets error and re-throws on failure", async () => {
      vi.mocked(commands.addServer).mockRejectedValue(new Error("bad url"));

      await expect(
        useServerStore.getState().addServer("bad-url"),
      ).rejects.toThrow("bad url");

      expect(useServerStore.getState().error).toContain("bad url");
    });
  });

  describe("removeServer", () => {
    it("removes the server by id on success", async () => {
      useServerStore.setState({ servers: [makeServer(1), makeServer(2)] });
      vi.mocked(commands.deleteServer).mockResolvedValue(undefined);

      await useServerStore.getState().removeServer(1);

      const servers = useServerStore.getState().servers;
      expect(servers).toHaveLength(1);
      expect(servers[0].id).toBe(2);
    });

    it("sets error on failure and keeps existing servers", async () => {
      useServerStore.setState({ servers: [makeServer(1)] });
      vi.mocked(commands.deleteServer).mockRejectedValue(new Error("db error"));

      await useServerStore.getState().removeServer(1);

      expect(useServerStore.getState().error).toContain("db error");
      expect(useServerStore.getState().servers).toHaveLength(1);
    });
  });

  describe("updateServerFromSync", () => {
    it("updates offset_ms, last_sync_at, and status for the matching server", () => {
      useServerStore.setState({ servers: [makeServer(1), makeServer(2)] });

      useServerStore.getState().updateServerFromSync(1, 42, "2024-06-01T12:00:00Z", "synced");

      const server = useServerStore.getState().servers.find((s) => s.id === 1)!;
      expect(server.offset_ms).toBe(42);
      expect(server.last_sync_at).toBe("2024-06-01T12:00:00Z");
      expect(server.status).toBe("synced");
    });

    it("does not affect other servers", () => {
      useServerStore.setState({ servers: [makeServer(1), makeServer(2)] });

      useServerStore.getState().updateServerFromSync(1, 42, "2024-06-01T12:00:00Z", "synced");

      const server2 = useServerStore.getState().servers.find((s) => s.id === 2)!;
      expect(server2.offset_ms).toBeNull();
      expect(server2.status).toBe("idle");
    });

    it("can set offset_ms to null (e.g. syncing or error state)", () => {
      useServerStore.setState({ servers: [makeServer(1)] });

      useServerStore.getState().updateServerFromSync(1, null, null, "syncing");

      const server = useServerStore.getState().servers[0];
      expect(server.offset_ms).toBeNull();
      expect(server.status).toBe("syncing");
    });
  });
});
