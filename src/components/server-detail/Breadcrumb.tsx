import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Server } from "@/types/server";

interface BreadcrumbProps {
  server: Server;
}

export function Breadcrumb({ server }: BreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      <button
        onClick={() => navigate("/")}
        className="text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
      >
        Servers
      </button>
      <ChevronRight className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
      <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[300px]">
        {server.name ?? server.url}
      </span>
    </nav>
  );
}
