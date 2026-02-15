import { useState } from "react";
import { Globe, RefreshCw } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { useSyncStore } from "@/stores/syncStore";

export function TopBar() {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addServer, servers } = useServerStore();
  const { startSync } = useSyncStore();

  const handleAdd = async () => {
    if (!url.trim()) return;

    setAdding(true);
    setError(null);
    try {
      let finalUrl = url.trim();
      if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
        finalUrl = `https://${finalUrl}`;
      }
      await addServer(finalUrl);
      setUrl("");
    } catch (e) {
      setError(String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleSyncAll = async () => {
    for (const server of servers) {
      if (server.status !== "syncing") {
        startSync(server.id);
      }
    }
  };

  return (
    <div className="h-20 border-b border-[var(--color-border)] bg-[var(--color-bg-card)]/50 backdrop-blur-md px-8">
      <div className="flex h-full items-center gap-4">
        <div className="relative flex-1 max-w-2xl">
          <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--color-text-secondary)]" />
          <input
            type="text"
            placeholder="Enter server URL or IP address"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            disabled={adding}
            className="w-full rounded-xl border-none bg-[var(--color-input-bg)] py-3 pl-12 pr-32 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !url.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-[var(--color-accent)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:bg-[var(--color-accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Server
          </button>
        </div>

        <div className="h-8 w-[1px] bg-[var(--color-border)]"></div>

        <button
          onClick={handleSyncAll}
          disabled={servers.length === 0}
          className="rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="mr-2 inline h-4 w-4" />
          Sync All
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
