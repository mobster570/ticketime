import { create } from "zustand";
import type { SyncProgressPayload, SyncResult } from "@/types/server";
import * as commands from "@/lib/commands";
import { useServerStore } from "@/stores/serverStore";

interface SyncStore {
  activeSyncs: Record<number, SyncProgressPayload>;
  syncResults: Record<number, SyncResult>;
  startSync: (id: number) => Promise<void>;
  cancelSync: (id: number) => Promise<void>;
  isSyncing: (id: number) => boolean;
  getProgress: (id: number) => SyncProgressPayload | undefined;
  getLatestResult: (id: number) => SyncResult | undefined;
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  activeSyncs: {},
  syncResults: {},

  startSync: async (id: number) => {
    const serverStore = useServerStore.getState();
    serverStore.updateServerFromSync(id, null, null, "syncing");

    await commands.startSync(id, (event) => {
      switch (event.event) {
        case "Progress":
          set((state) => ({
            activeSyncs: { ...state.activeSyncs, [id]: event.data },
          }));
          break;
        case "Complete": {
          const result = event.data.result;
          set((state) => {
            const { [id]: _, ...rest } = state.activeSyncs;
            return {
              activeSyncs: rest,
              syncResults: { ...state.syncResults, [id]: result },
            };
          });
          useServerStore
            .getState()
            .updateServerFromSync(
              id,
              result.total_offset_ms,
              result.synced_at,
              "synced",
            );
          break;
        }
        case "Error": {
          set((state) => {
            const { [id]: _, ...rest } = state.activeSyncs;
            return { activeSyncs: rest };
          });
          useServerStore
            .getState()
            .updateServerFromSync(id, null, null, "error");
          break;
        }
      }
    });
  },

  cancelSync: async (id: number) => {
    await commands.cancelSync(id);
    set((state) => {
      const { [id]: _, ...rest } = state.activeSyncs;
      return { activeSyncs: rest };
    });
  },

  isSyncing: (id: number) => id in get().activeSyncs,
  getProgress: (id: number) => get().activeSyncs[id],
  getLatestResult: (id: number) => get().syncResults[id],
}));
