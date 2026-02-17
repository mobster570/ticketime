import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useSettingsStore } from "@/stores/settingsStore";

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  const handleToggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    toggleTheme();
    useSettingsStore.getState().updateField("theme", next);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-colors cursor-pointer w-full"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
