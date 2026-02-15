import { ServerRow } from "@/components/dashboard/ServerRow";
import { useServerStore } from "@/stores/serverStore";
import { Globe } from "lucide-react";

interface ServerTableProps {
  onSyncClick: (id: number) => void;
}

export function ServerTable({ onSyncClick }: ServerTableProps) {
  const { servers, loading } = useServerStore();

  if (loading) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] shadow-sm flex items-center justify-center py-12">
        <p className="text-[var(--color-text-secondary)]">Loading servers...</p>
      </div>
    );
  }

  if (servers.length === 0) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] shadow-sm flex flex-col items-center justify-center py-12 gap-3">
        <Globe className="h-12 w-12 text-[var(--color-text-secondary)] opacity-50" />
        <p className="text-[var(--color-text-secondary)]">
          No servers added. Enter a URL above to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-card)] rounded-2xl border border-[var(--color-border)] overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="px-6 py-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
                Status
              </th>
              <th className="px-6 py-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
                Server Identity
              </th>
              <th className="px-6 py-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
                Precise Offset
              </th>
              <th className="px-6 py-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
                Health
              </th>
              <th className="px-6 py-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">
                Last Sync
              </th>
              <th className="px-6 py-4 text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]/30">
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
    </div>
  );
}
