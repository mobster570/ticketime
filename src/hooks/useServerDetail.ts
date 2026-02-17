import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { Server, SyncResult } from "@/types/server";
import { getServer, getSyncHistory } from "@/lib/commands";
import { useSyncStore } from "@/stores/syncStore";

interface UseServerDetailReturn {
  server: Server | null;
  syncHistory: SyncResult[];
  latestResult: SyncResult | undefined;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useServerDetail(id: number): UseServerDetailReturn {
  const [server, setServer] = useState<Server | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const syncResult = useSyncStore((s) => s.syncResults[id]);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [srv, history] = await Promise.all([
        getServer(id),
        getSyncHistory(id),
      ]);
      setServer(srv);
      setSyncHistory(history);
    } catch (e) {
      const msg = String(e);
      if (msg.includes("not found") || msg.includes("No server")) {
        navigate("/", { replace: true });
        return;
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Re-fetch when a sync completes
  useEffect(() => {
    if (syncResult) {
      refetch();
    }
  }, [syncResult, refetch]);

  const latestResult =
    syncHistory.length > 0 ? syncHistory[0] : undefined;

  return { server, syncHistory, latestResult, isLoading, error, refetch };
}
