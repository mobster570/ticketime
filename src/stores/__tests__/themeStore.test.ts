import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "@/stores/themeStore";

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ theme: "dark" });
  document.documentElement.classList.remove("dark");
});

describe("themeStore", () => {
  describe("initial state", () => {
    it("has theme dark by default", () => {
      expect(useThemeStore.getState().theme).toBe("dark");
    });
  });

  describe("toggleTheme", () => {
    it("switches dark to light", () => {
      useThemeStore.setState({ theme: "dark" });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("switches light to dark", () => {
      useThemeStore.setState({ theme: "light" });
      useThemeStore.getState().toggleTheme();
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("removes dark class when switching to light", () => {
      document.documentElement.classList.add("dark");
      useThemeStore.setState({ theme: "dark" });
      useThemeStore.getState().toggleTheme();
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("adds dark class when switching to dark", () => {
      useThemeStore.setState({ theme: "light" });
      useThemeStore.getState().toggleTheme();
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("persists theme to localStorage", () => {
      useThemeStore.setState({ theme: "dark" });
      useThemeStore.getState().toggleTheme();
      expect(localStorage.getItem("ticketime-theme")).toBe("light");
    });
  });

  describe("setTheme", () => {
    it("sets theme to light", () => {
      useThemeStore.getState().setTheme("light");
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("sets theme to dark", () => {
      useThemeStore.setState({ theme: "light" });
      useThemeStore.getState().setTheme("dark");
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("adds dark class when setting dark", () => {
      useThemeStore.getState().setTheme("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes dark class when setting light", () => {
      document.documentElement.classList.add("dark");
      useThemeStore.getState().setTheme("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("persists to localStorage", () => {
      useThemeStore.getState().setTheme("light");
      expect(localStorage.getItem("ticketime-theme")).toBe("light");
    });
  });

  describe("initTheme", () => {
    it("reads theme from localStorage", () => {
      localStorage.setItem("ticketime-theme", "light");
      useThemeStore.getState().initTheme();
      expect(useThemeStore.getState().theme).toBe("light");
    });

    it("defaults to dark when localStorage is empty", () => {
      useThemeStore.getState().initTheme();
      expect(useThemeStore.getState().theme).toBe("dark");
    });

    it("applies dark class when initialized as dark", () => {
      localStorage.setItem("ticketime-theme", "dark");
      useThemeStore.getState().initTheme();
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("removes dark class when initialized as light", () => {
      document.documentElement.classList.add("dark");
      localStorage.setItem("ticketime-theme", "light");
      useThemeStore.getState().initTheme();
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });
});
