import { Timer, LayoutDashboard, Activity, BarChart3, Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/utils";

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar-bg)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]">
          <Timer className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-[var(--color-text-primary)]">
          Ticketime
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 px-4">
        <a
          href="#"
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
            "bg-[var(--color-accent)] text-white"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </a>
        <a
          href="#"
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
            "text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
          )}
        >
          <Activity className="h-5 w-5" />
          Events
        </a>
        <a
          href="#"
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
            "text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
          )}
        >
          <BarChart3 className="h-5 w-5" />
          Analytics
        </a>
        <a
          href="#"
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
            "text-[var(--color-text-secondary)] opacity-50 cursor-not-allowed"
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </a>
      </nav>

      {/* Footer */}
      <div className="space-y-3 border-t border-[var(--color-border)] p-4">
        <ThemeToggle />
        <div className="flex items-center gap-2 px-2">
          <div className="h-2 w-2 rounded-full bg-[var(--color-success)] glow-success"></div>
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">System Online</span>
        </div>
        <p className="px-2 text-xs text-[var(--color-text-secondary)]/60">v1.0.0</p>
      </div>
    </aside>
  );
}
