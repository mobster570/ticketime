import { Clock, LayoutDashboard, Activity, BarChart3, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar-bg)]">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <Clock className="h-6 w-6 text-[var(--color-accent)]" />
        <span className="text-lg font-bold text-[var(--color-text-primary)]">
          Ticketime
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2">
        <a
          href="#"
          className="flex items-center gap-3 rounded-lg bg-[var(--color-accent)]/10 px-3 py-2 text-sm font-medium text-[var(--color-sidebar-active)]"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </a>
        <a
          href="#"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
        >
          <Activity className="h-4 w-4" />
          Events
        </a>
        <a
          href="#"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
        >
          <BarChart3 className="h-4 w-4" />
          Analytics
        </a>
        <a
          href="#"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
        >
          <Settings className="h-4 w-4" />
          Settings
        </a>
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--color-border)] p-2">
        <ThemeToggle />
      </div>
    </aside>
  );
}
