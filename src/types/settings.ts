export interface Settings {
  theme: "dark" | "light";
  min_request_interval_ms: number;
  health_resync_threshold: number;
  external_time_source: string;
  show_milliseconds: boolean;
  millisecond_precision: 1 | 2 | 3;
  show_timezone_offset: boolean;
  overlay_opacity: number;
  overlay_auto_hide: boolean;
  overlay_always_on_top: boolean;
  alert_intervals: number[];
  alert_method: "sound" | "visual" | "both";
  drift_warning_threshold_ms: number;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  min_request_interval_ms: 500,
  health_resync_threshold: 50,
  external_time_source: "ntp",
  show_milliseconds: true,
  millisecond_precision: 3,
  show_timezone_offset: false,
  overlay_opacity: 75,
  overlay_auto_hide: false,
  overlay_always_on_top: true,
  alert_intervals: [10, 5, 1],
  alert_method: "both",
  drift_warning_threshold_ms: 1000,
};
