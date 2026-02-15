import { create } from "zustand";

type Theme = "dark" | "light";

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  initTheme: () => void;
}

const STORAGE_KEY = "ticketime-theme";

function applyTheme(theme: Theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: "dark",

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    set({ theme: next });
  },

  initTheme: () => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const theme = stored ?? "dark";
    applyTheme(theme);
    set({ theme });
  },
}));
