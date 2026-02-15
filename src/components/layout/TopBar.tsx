import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Enter server URL or IP address"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
        </div>
        <Button variant="success" onClick={handleAdd} disabled={adding || !url.trim()}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Server
        </Button>
        <Button variant="primary" onClick={handleSyncAll} disabled={servers.length === 0}>
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Sync All
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--color-danger)]">{error}</p>
      )}
    </div>
  );
}
