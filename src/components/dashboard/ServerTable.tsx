import { ServerRow } from "@/components/dashboard/ServerRow";
import { Card } from "@/components/ui/Card";
import { useServerStore } from "@/stores/serverStore";
import { Globe } from "lucide-react";

interface ServerTableProps {
  onSyncClick: (id: number) => void;
}

export function ServerTable({ onSyncClick }: ServerTableProps) {
  const { servers, loading } = useServerStore();

  if (loading) {
    return (
      <Card className="flex items-center justify-center py-12">
        <p className="text-[var(--color-text-secondary)]">Loading servers...</p>
      </Card>
    );
  }

  if (servers.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-12 gap-3">
        <Globe className="h-12 w-12 text-[var(--color-text-secondary)] opacity-50" />
        <p className="text-[var(--color-text-secondary)]">
          No servers added. Enter a URL above to get started.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
          Network Overview
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Status
              </th>
              <th className="px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Server
              </th>
              <th className="px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Offset
              </th>
              <th className="px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Health
              </th>
              <th className="px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Last Sync
              </th>
              <th className="px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <ServerRow
                key={server.id}
                server={server}
                onSyncClick={onSyncClick}
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
