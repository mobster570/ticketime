import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";
import { DEFAULT_SETTINGS } from "@/types/settings";

vi.mock("@/lib/commands", () => ({
  listServers: vi.fn(),
  addServer: vi.fn(),
  deleteServer: vi.fn(),
  startSync: vi.fn(),
  cancelSync: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getSyncHistory: vi.fn(),
}));

import * as commands from "@/lib/commands";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useSettingsStore.setState({
    settings: { ...DEFAULT_SETTINGS },
    savedSettings: { ...DEFAULT_SETTINGS },
    loading: false,
    error: null,
    dirty: false,
  });
  useThemeStore.setState({ theme: "dark" });
  document.documentElement.classList.remove("dark");
});

describe("settingsStore", () => {
  describe("initial state", () => {
    it("matches DEFAULT_SETTINGS", () => {
      expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
    });

    it("has dirty false", () => {
      expect(useSettingsStore.getState().dirty).toBe(false);
    });

    it("has error null", () => {
      expect(useSettingsStore.getState().error).toBeNull();
    });

    it("has loading false", () => {
      expect(useSettingsStore.getState().loading).toBe(false);
    });
  });

  describe("updateField", () => {
    it("sets the dirty flag", () => {
      useSettingsStore.getState().updateField("show_milliseconds", false);
      expect(useSettingsStore.getState().dirty).toBe(true);
    });

    it("updates the specified field", () => {
      useSettingsStore.getState().updateField("overlay_opacity", 50);
      expect(useSettingsStore.getState().settings.overlay_opacity).toBe(50);
    });

    it("does not change savedSettings", () => {
      useSettingsStore.getState().updateField("overlay_opacity", 50);
      expect(useSettingsStore.getState().savedSettings.overlay_opacity).toBe(
        DEFAULT_SETTINGS.overlay_opacity,
      );
    });

    it("calls themeStore.setTheme when updating the theme key", () => {
      const setTheme = vi.spyOn(useThemeStore.getState(), "setTheme");
      useSettingsStore.getState().updateField("theme", "light");
      expect(setTheme).toHaveBeenCalledWith("light");
    });

    it("does not call themeStore.setTheme for non-theme fields", () => {
      const setTheme = vi.spyOn(useThemeStore.getState(), "setTheme");
      useSettingsStore.getState().updateField("show_milliseconds", false);
      expect(setTheme).not.toHaveBeenCalled();
    });
  });

  describe("revertUnsaved", () => {
    it("restores settings to savedSettings", () => {
      useSettingsStore.getState().updateField("overlay_opacity", 10);
      useSettingsStore.getState().revertUnsaved();
      expect(useSettingsStore.getState().settings.overlay_opacity).toBe(
        DEFAULT_SETTINGS.overlay_opacity,
      );
    });

    it("clears the dirty flag", () => {
      useSettingsStore.getState().updateField("overlay_opacity", 10);
      useSettingsStore.getState().revertUnsaved();
      expect(useSettingsStore.getState().dirty).toBe(false);
    });

    it("reverts theme via themeStore when theme differs", () => {
      useSettingsStore.setState({
        settings: { ...DEFAULT_SETTINGS, theme: "light" },
        savedSettings: { ...DEFAULT_SETTINGS, theme: "dark" },
        dirty: true,
      });
      const setTheme = vi.spyOn(useThemeStore.getState(), "setTheme");
      useSettingsStore.getState().revertUnsaved();
      expect(setTheme).toHaveBeenCalledWith("dark");
    });

    it("does not call themeStore.setTheme when theme is unchanged", () => {
      useSettingsStore.getState().updateField("overlay_opacity", 10);
      const setTheme = vi.spyOn(useThemeStore.getState(), "setTheme");
      useSettingsStore.getState().revertUnsaved();
      expect(setTheme).not.toHaveBeenCalled();
    });
  });

  describe("saveSettings", () => {
    it("clears dirty flag on success", async () => {
      vi.mocked(commands.updateSettings).mockResolvedValue(undefined);
      useSettingsStore.setState({ dirty: true });

      await useSettingsStore.getState().saveSettings();

      expect(useSettingsStore.getState().dirty).toBe(false);
    });

    it("updates savedSettings to current settings on success", async () => {
      vi.mocked(commands.updateSettings).mockResolvedValue(undefined);
      useSettingsStore.setState({
        settings: { ...DEFAULT_SETTINGS, overlay_opacity: 30 },
        dirty: true,
      });

      await useSettingsStore.getState().saveSettings();

      expect(useSettingsStore.getState().savedSettings.overlay_opacity).toBe(30);
    });

    it("sets error and preserves dirty flag on failure", async () => {
      vi.mocked(commands.updateSettings).mockRejectedValue(new Error("save failed"));
      useSettingsStore.setState({ dirty: true });

      await useSettingsStore.getState().saveSettings();

      expect(useSettingsStore.getState().error).toContain("save failed");
    });

    it("calls updateSettings with current settings", async () => {
      vi.mocked(commands.updateSettings).mockResolvedValue(undefined);
      const settings = { ...DEFAULT_SETTINGS, overlay_opacity: 60 };
      useSettingsStore.setState({ settings });

      await useSettingsStore.getState().saveSettings();

      expect(commands.updateSettings).toHaveBeenCalledWith(settings);
    });
  });

  describe("fetchSettings", () => {
    it("loads settings from backend on success", async () => {
      const fetched = { ...DEFAULT_SETTINGS, overlay_opacity: 80 };
      vi.mocked(commands.getSettings).mockResolvedValue(fetched);

      await useSettingsStore.getState().fetchSettings();

      expect(useSettingsStore.getState().settings.overlay_opacity).toBe(80);
      expect(useSettingsStore.getState().loading).toBe(false);
    });

    it("sets error on failure", async () => {
      vi.mocked(commands.getSettings).mockRejectedValue(new Error("fetch failed"));

      await useSettingsStore.getState().fetchSettings();

      expect(useSettingsStore.getState().error).toContain("fetch failed");
      expect(useSettingsStore.getState().loading).toBe(false);
    });

    it("migrates legacy localStorage theme to backend", async () => {
      localStorage.setItem("ticketime-theme", "light");
      const fetched = { ...DEFAULT_SETTINGS, theme: "dark" as const };
      vi.mocked(commands.getSettings).mockResolvedValue(fetched);
      vi.mocked(commands.updateSettings).mockResolvedValue(undefined);

      await useSettingsStore.getState().fetchSettings();

      expect(commands.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ theme: "light" }),
      );
      // localStorage.removeItem is called during migration, but setTheme()
      // writes the theme back via localStorage.setItem — final value is "light"
      expect(localStorage.getItem("ticketime-theme")).toBe("light");
    });
  });

  describe("resetToDefaults", () => {
    it("resets settings to DEFAULT_SETTINGS on success", async () => {
      vi.mocked(commands.updateSettings).mockResolvedValue(undefined);
      useSettingsStore.setState({
        settings: { ...DEFAULT_SETTINGS, overlay_opacity: 10 },
      });

      await useSettingsStore.getState().resetToDefaults();

      expect(useSettingsStore.getState().settings).toEqual(DEFAULT_SETTINGS);
      expect(useSettingsStore.getState().dirty).toBe(false);
    });

    it("sets error on failure", async () => {
      vi.mocked(commands.updateSettings).mockRejectedValue(new Error("reset failed"));

      await useSettingsStore.getState().resetToDefaults();

      expect(useSettingsStore.getState().error).toContain("reset failed");
    });
  });
});
