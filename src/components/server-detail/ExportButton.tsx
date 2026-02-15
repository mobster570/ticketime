import { useState, useRef, useEffect } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { syncHistoryToCsv, syncHistoryToJson } from "@/lib/export";
import type { SyncResult } from "@/types/server";

interface ExportButtonProps {
  syncHistory: SyncResult[];
  serverName?: string;
}

export function ExportButton({ syncHistory, serverName }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const exportAs = async (format: "csv" | "json") => {
    setOpen(false);
    const ext = format;
    const filterName = format.toUpperCase();
    const slug = (serverName ?? "server").replace(/[^a-zA-Z0-9_-]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
    const defaultFilename = `ticketime_${slug}_${timestamp}.${ext}`;
    const path = await save({
      title: "Export Sync Logs",
      defaultPath: defaultFilename,
      filters: [{ name: filterName, extensions: [ext] }],
    });
    if (!path) return;

    const content =
      format === "csv"
        ? syncHistoryToCsv(syncHistory)
        : syncHistoryToJson(syncHistory);

    await writeTextFile(path, content);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        disabled={syncHistory.length === 0}
      >
        <Download className="h-4 w-4 mr-1.5" />
        Export Logs
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-10 min-w-[160px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg py-1">
          <button
            className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 cursor-pointer"
            onClick={() => exportAs("csv")}
          >
            Export as CSV
          </button>
          <button
            className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]/50 cursor-pointer"
            onClick={() => exportAs("json")}
          >
            Export as JSON
          </button>
        </div>
      )}
    </div>
  );
}
