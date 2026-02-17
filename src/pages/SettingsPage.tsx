import { useEffect } from "react";
import {
  Settings,
  RefreshCw,
  Monitor,
  Bell,
  Keyboard,
  Plug,
} from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { cn } from "@/lib/utils";

const PRECISION_OPTIONS = [
  { value: 1, label: "0.1s" },
  { value: 2, label: "0.01s" },
  { value: 3, label: "0.001s" },
];

const EXTERNAL_SOURCE_OPTIONS = [
  { value: "ntp", label: "NTP Pool" },
  { value: "google", label: "Google Time" },
  { value: "cloudflare", label: "Cloudflare" },
];

const ALERT_METHOD_OPTIONS = [
  { value: "visual", label: "Visual Only" },
  { value: "sound", label: "Sound Only" },
  { value: "both", label: "Both" },
];

const ALARM_INTERVALS = [1, 3, 5, 10, 15, 30, 60];

export function SettingsPage() {
  const {
    settings,
    dirty,
    updateField,
    saveSettings,
    resetToDefaults,
  } = useSettingsStore();

  useEffect(() => {
    return () => {
      const store = useSettingsStore.getState();
      if (store.dirty) store.revertUnsaved();
    };
  }, []);

  const handleReset = () => {
    if (window.confirm("Reset all settings to defaults?")) {
      resetToDefaults();
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">
              Settings
            </h1>
            {dirty && (
              <span className="rounded-full bg-[var(--color-warning)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--color-warning)]">
                Unsaved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>
              Reset to Defaults
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={saveSettings}
              disabled={!dirty}
            >
              Save Changes
            </Button>
          </div>
        </div>

        {/* General */}
        <SettingsSection
          title="General"
          description="Basic application configuration"
          icon={Settings}
        >
          <SettingsField label="Theme" description="Choose your preferred visual theme">
            <Select
              options={[
                { value: "dark", label: "Dark Mode" },
                { value: "light", label: "Light Mode" },
              ]}
              value={settings.theme}
              onChange={(e) => updateField("theme", e.target.value as "dark" | "light")}
              className="w-36"
            />
          </SettingsField>
        </SettingsSection>

        {/* Sync */}
        <SettingsSection
          title="Synchronization"
          description="Network and timing precision parameters"
          icon={RefreshCw}
        >
          <SettingsField
            label="Min Request Interval"
            description="Minimum time between sync requests"
          >
            <NumberInput
              value={settings.min_request_interval_ms}
              min={100}
              max={10000}
              step={100}
              unit="ms"
              onChange={(e) => updateField("min_request_interval_ms", Number(e.target.value))}
              className="w-36"
            />
          </SettingsField>

          <SettingsField
            label="Health Threshold"
            description="Offset deviation to trigger health warning"
          >
            <div className="w-44">
              <Slider
                value={settings.health_resync_threshold}
                min={10}
                max={500}
                step={10}
                unit="ms"
                onChange={(e) => updateField("health_resync_threshold", Number(e.target.value))}
              />
            </div>
          </SettingsField>

          <SettingsField
            label="External Source"
            description="External source for time synchronization"
          >
            <Select
              options={EXTERNAL_SOURCE_OPTIONS}
              value={settings.external_time_source}
              onChange={(e) => updateField("external_time_source", e.target.value)}
              className="w-36"
            />
          </SettingsField>
        </SettingsSection>

        {/* Display */}
        <SettingsSection
          title="Display"
          description="Customize the clock interface"
          icon={Monitor}
        >
          <SettingsField
            label="Show Milliseconds"
            description="Display fractional seconds on the main clock"
          >
            <Toggle
              checked={settings.show_milliseconds}
              onChange={(e) => updateField("show_milliseconds", e.target.checked)}
            />
          </SettingsField>

          <SettingsField
            label="Precision"
            description="Number of decimal places for seconds"
          >
            <Select
              options={PRECISION_OPTIONS}
              value={settings.millisecond_precision}
              onChange={(e) => updateField("millisecond_precision", Number(e.target.value) as 1 | 2 | 3)}
              disabled={!settings.show_milliseconds}
              className="w-32"
            />
          </SettingsField>

          <SettingsField
            label="Timezone Offset"
            description="Show offset from UTC next to local time"
          >
            <Toggle
              checked={settings.show_timezone_offset}
              onChange={(e) => updateField("show_timezone_offset", e.target.checked)}
            />
          </SettingsField>

          <SettingsField
            label="Overlay Opacity"
            description="Transparency of the floating clock overlay"
          >
            <div className="w-44">
              <Slider
                value={settings.overlay_opacity}
                min={10}
                max={100}
                step={5}
                unit="%"
                onChange={(e) => updateField("overlay_opacity", Number(e.target.value))}
              />
            </div>
          </SettingsField>

          <SettingsField
            label="Auto-hide"
            description="Hide overlay when mouse is not near"
          >
            <Toggle
              checked={settings.overlay_auto_hide}
              onChange={(e) => updateField("overlay_auto_hide", e.target.checked)}
            />
          </SettingsField>

          <SettingsField
            label="Always on Top"
            description="Keep overlay above all other windows"
          >
            <Toggle
              checked={settings.overlay_always_on_top}
              onChange={(e) => updateField("overlay_always_on_top", e.target.checked)}
            />
          </SettingsField>
        </SettingsSection>

        {/* Alerts */}
        <SettingsSection
          title="Alerts"
          description="Notification preferences"
          icon={Bell}
        >
          <SettingsField
            label="Alarm Intervals"
            description="Seconds between repetitive drift warnings"
          >
            <div className="flex flex-wrap items-center gap-2">
              {ALARM_INTERVALS.map((interval) => (
                <button
                  key={interval}
                  onClick={() => {
                    const current = settings.alert_intervals;
                    const next = current.includes(interval)
                      ? current.filter((i) => i !== interval)
                      : [...current, interval].sort((a, b) => a - b);
                    updateField("alert_intervals", next);
                  }}
                  className={cn(
                    "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                    settings.alert_intervals.includes(interval)
                      ? "bg-[var(--color-accent)] text-white border-[var(--color-accent)]"
                      : "bg-[var(--color-input-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
                  )}
                >
                  {interval}s
                </button>
              ))}
            </div>
          </SettingsField>

          <SettingsField
            label="Alert Method"
            description="How to notify when sync fails or drift occurs"
          >
            <Select
              options={ALERT_METHOD_OPTIONS}
              value={settings.alert_method}
              onChange={(e) => updateField("alert_method", e.target.value as "sound" | "visual" | "both")}
              className="w-36"
            />
          </SettingsField>

          <SettingsField
            label="Drift Threshold"
            description="Clock drift threshold for alerts"
          >
            <NumberInput
              value={settings.drift_warning_threshold_ms}
              min={100}
              max={10000}
              step={100}
              unit="ms"
              onChange={(e) => updateField("drift_warning_threshold_ms", Number(e.target.value))}
              className="w-36"
            />
          </SettingsField>
        </SettingsSection>

        {/* Hotkeys (disabled) */}
        <SettingsSection
          title="Hotkeys"
          description="Keyboard shortcuts configuration"
          icon={Keyboard}
          disabled
        >
          <SettingsField label="Sync Now" description="Trigger immediate synchronization">
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 font-mono text-xs">
              Ctrl + R
            </span>
          </SettingsField>
          <SettingsField label="Toggle Overlay" description="Show/Hide floating clock">
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-input-bg)] px-2 py-1 font-mono text-xs">
              Ctrl + Shift + O
            </span>
          </SettingsField>
        </SettingsSection>

        {/* Advanced (disabled) */}
        <SettingsSection
          title="Advanced"
          description="Developer tools and debug options"
          icon={Plug}
          disabled
        >
          <SettingsField label="Debug Mode" description="Enable verbose logging">
            <Toggle disabled />
          </SettingsField>
          <SettingsField label="Raw API Access" description="Allow direct NTP queries">
            <Toggle disabled />
          </SettingsField>
        </SettingsSection>
      </div>
    </div>
  );
}
