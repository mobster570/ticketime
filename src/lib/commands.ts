import { invoke, Channel } from "@tauri-apps/api/core";
import type { Server, SyncEvent, SyncResult } from "@/types/server";

export async function addServer(url: string): Promise<Server> {
  return invoke<Server>("add_server", { url });
}

export async function getServer(id: number): Promise<Server> {
  return invoke<Server>("get_server", { id });
}

export async function listServers(): Promise<Server[]> {
  return invoke<Server[]>("list_servers");
}

export async function deleteServer(id: number): Promise<void> {
  return invoke<void>("delete_server", { id });
}

export async function startSync(
  id: number,
  onEvent: (event: SyncEvent) => void,
): Promise<void> {
  const channel = new Channel<SyncEvent>();
  channel.onmessage = onEvent;
  return invoke<void>("start_sync", { id, onEvent: channel });
}

export async function cancelSync(id: number): Promise<void> {
  return invoke<void>("cancel_sync", { id });
}

export async function getSyncHistory(
  id: number,
  options?: { since?: string; limit?: number },
): Promise<SyncResult[]> {
  return invoke<SyncResult[]>("get_sync_history", {
    id,
    since: options?.since ?? null,
    limit: options?.limit ?? null,
  });
}
