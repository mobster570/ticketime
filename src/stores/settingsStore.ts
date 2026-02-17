import { create } from "zustand";
import type { Settings } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";
import { getSettings, updateSettings } from "@/lib/commands";
import { useThemeStore } from "@/stores/themeStore";

interface SettingsStore {
  settings: Settings;
  savedSettings: Settings;
  loading: boolean;
  error: string | null;
  dirty: boolean;
  fetchSettings: () => Promise<void>;
  updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  saveSettings: () => Promise<void>;
  resetToDefaults: () => Promise<void>;
  revertUnsaved: () => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  savedSettings: { ...DEFAULT_SETTINGS },
  loading: false,
  error: null,
  dirty: false,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const settings = await getSettings();

      // One-time localStorage migration
      const legacyTheme = localStorage.getItem("ticketime-theme");
      if (legacyTheme && (legacyTheme === "dark" || legacyTheme === "light") && settings.theme === "dark") {
        settings.theme = legacyTheme;
        await updateSettings(settings);
        localStorage.removeItem("ticketime-theme");
      }

      useThemeStore.getState().setTheme(settings.theme);
      set({ settings, savedSettings: { ...settings }, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  updateField: <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const settings = { ...get().settings, [key]: value };
    set({ settings, dirty: true });

    if (key === "theme") {
      useThemeStore.getState().setTheme(value as "dark" | "light");
    }
  },

  saveSettings: async () => {
    const { settings } = get();
    set({ error: null });
    try {
      await updateSettings(settings);
      set({ dirty: false, savedSettings: { ...settings } });
      useThemeStore.getState().setTheme(settings.theme);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  resetToDefaults: async () => {
    set({ error: null });
    try {
      await updateSettings(DEFAULT_SETTINGS);
      set({
        settings: { ...DEFAULT_SETTINGS },
        savedSettings: { ...DEFAULT_SETTINGS },
        dirty: false,
      });
      useThemeStore.getState().setTheme(DEFAULT_SETTINGS.theme);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  revertUnsaved: () => {
    const { savedSettings, settings } = get();
    if (settings.theme !== savedSettings.theme) {
      useThemeStore.getState().setTheme(savedSettings.theme);
    }
    set({ settings: { ...savedSettings }, dirty: false });
  },
}));
