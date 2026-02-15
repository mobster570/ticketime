import { create } from "zustand";
import type { Server, ServerStatus } from "@/types/server";
import * as commands from "@/lib/commands";

interface ServerStore {
  servers: Server[];
  loading: boolean;
  error: string | null;
  fetchServers: () => Promise<void>;
  addServer: (url: string) => Promise<void>;
  removeServer: (id: number) => Promise<void>;
  updateServerFromSync: (
    id: number,
    offsetMs: number | null,
    lastSyncAt: string | null,
    status: ServerStatus,
  ) => void;
}

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  loading: false,
  error: null,

  fetchServers: async () => {
    set({ loading: true, error: null });
    try {
      const servers = await commands.listServers();
      set({ servers, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  addServer: async (url: string) => {
    set({ error: null });
    try {
      const server = await commands.addServer(url);
      set({ servers: [...get().servers, server] });
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  removeServer: async (id: number) => {
    set({ error: null });
    try {
      await commands.deleteServer(id);
      set({ servers: get().servers.filter((s) => s.id !== id) });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateServerFromSync: (id, offsetMs, lastSyncAt, status) => {
    set({
      servers: get().servers.map((s) =>
        s.id === id
          ? { ...s, offset_ms: offsetMs, last_sync_at: lastSyncAt, status }
          : s,
      ),
    });
  },
}));
