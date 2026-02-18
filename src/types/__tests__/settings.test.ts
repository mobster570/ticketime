import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "@/types/settings";
import type { Settings } from "@/types/settings";

describe("DEFAULT_SETTINGS", () => {
  it("has all required keys defined by the Settings interface", () => {
    const requiredKeys: (keyof Settings)[] = [
      "theme",
      "min_request_interval_ms",
      "health_resync_threshold",
      "external_time_source",
      "show_milliseconds",
      "millisecond_precision",
      "show_timezone_offset",
      "overlay_opacity",
      "overlay_auto_hide",
      "overlay_always_on_top",
      "alert_intervals",
      "alert_method",
      "drift_warning_threshold_ms",
    ];
    for (const key of requiredKeys) {
      expect(DEFAULT_SETTINGS).toHaveProperty(key);
    }
  });

  it("has no unexpected extra keys beyond the Settings interface", () => {
    const expectedKeyCount = 13;
    expect(Object.keys(DEFAULT_SETTINGS)).toHaveLength(expectedKeyCount);
  });

  it("conforms to the Settings type at compile time", () => {
    // This assignment is a compile-time check; if Settings changes
    // incompatibly the test file will fail to compile.
    const _typed: Settings = DEFAULT_SETTINGS;
    expect(_typed).toBeDefined();
  });

  describe("default values", () => {
    it("theme defaults to dark", () => {
      expect(DEFAULT_SETTINGS.theme).toBe("dark");
    });

    it("min_request_interval_ms defaults to 500", () => {
      expect(DEFAULT_SETTINGS.min_request_interval_ms).toBe(500);
    });

    it("health_resync_threshold defaults to 50", () => {
      expect(DEFAULT_SETTINGS.health_resync_threshold).toBe(50);
    });

    it("external_time_source defaults to ntp", () => {
      expect(DEFAULT_SETTINGS.external_time_source).toBe("ntp");
    });

    it("show_milliseconds defaults to true", () => {
      expect(DEFAULT_SETTINGS.show_milliseconds).toBe(true);
    });

    it("millisecond_precision defaults to 3", () => {
      expect(DEFAULT_SETTINGS.millisecond_precision).toBe(3);
    });

    it("show_timezone_offset defaults to false", () => {
      expect(DEFAULT_SETTINGS.show_timezone_offset).toBe(false);
    });

    it("overlay_opacity defaults to 75", () => {
      expect(DEFAULT_SETTINGS.overlay_opacity).toBe(75);
    });

    it("overlay_auto_hide defaults to false", () => {
      expect(DEFAULT_SETTINGS.overlay_auto_hide).toBe(false);
    });

    it("overlay_always_on_top defaults to true", () => {
      expect(DEFAULT_SETTINGS.overlay_always_on_top).toBe(true);
    });

    it("alert_intervals defaults to [10, 5, 1]", () => {
      expect(DEFAULT_SETTINGS.alert_intervals).toEqual([10, 5, 1]);
    });

    it("alert_method defaults to both", () => {
      expect(DEFAULT_SETTINGS.alert_method).toBe("both");
    });

    it("drift_warning_threshold_ms defaults to 1000", () => {
      expect(DEFAULT_SETTINGS.drift_warning_threshold_ms).toBe(1000);
    });
  });
});
