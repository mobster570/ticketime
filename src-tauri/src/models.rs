use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

// ── Server Status ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatus {
    Idle,
    Syncing,
    Synced,
    Error,
}

impl fmt::Display for ServerStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ServerStatus::Idle => write!(f, "idle"),
            ServerStatus::Syncing => write!(f, "syncing"),
            ServerStatus::Synced => write!(f, "synced"),
            ServerStatus::Error => write!(f, "error"),
        }
    }
}

impl FromStr for ServerStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "idle" => Ok(ServerStatus::Idle),
            "syncing" => Ok(ServerStatus::Syncing),
            "synced" => Ok(ServerStatus::Synced),
            "error" => Ok(ServerStatus::Error),
            other => Err(format!("unknown server status: {other}")),
        }
    }
}

// ── Server ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Server {
    pub id: i64,
    pub url: String,
    pub name: Option<String>,
    pub offset_ms: Option<f64>,
    pub last_sync_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub status: ServerStatus,
    pub extractor_type: String,
}

// ── Latency Profile ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatencyProfile {
    pub min: f64,
    pub q1: f64,
    pub median: f64,
    pub mean: f64,
    pub q3: f64,
    pub max: f64,
}

impl LatencyProfile {
    pub fn iqr(&self) -> f64 {
        self.q3 - self.q1
    }

    pub fn is_in_range(&self, rtt: f64, multiplier: f64) -> bool {
        let lower = self.q1 - multiplier * self.iqr();
        let upper = self.q3 + multiplier * self.iqr();
        lower <= rtt && rtt <= upper
    }
}

// ── Sync Result ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub server_id: i64,
    pub whole_second_offset: i64,
    pub subsecond_offset: f64,
    pub total_offset_ms: f64,
    pub latency_profile: LatencyProfile,
    pub verified: bool,
    pub synced_at: DateTime<Utc>,
    pub duration_ms: u64,
    pub phase_reached: SyncPhase,
}

// ── Sync Phase ──

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncPhase {
    LatencyProfiling,
    WholeSecondOffset,
    BinarySearch,
    Verification,
    Complete,
}

impl From<SyncPhase> for serde_json::Value {
    fn from(phase: SyncPhase) -> Self {
        // SAFETY: Serializing a unit-variant enum to JSON is infallible.
        serde_json::to_value(phase).unwrap()
    }
}

// These integer values are persisted in SQLite. Do not reorder.
impl From<SyncPhase> for i32 {
    fn from(phase: SyncPhase) -> Self {
        match phase {
            SyncPhase::LatencyProfiling => 0,
            SyncPhase::WholeSecondOffset => 1,
            SyncPhase::BinarySearch => 2,
            SyncPhase::Verification => 3,
            SyncPhase::Complete => 4,
        }
    }
}

impl TryFrom<i32> for SyncPhase {
    type Error = String;
    fn try_from(v: i32) -> Result<Self, Self::Error> {
        match v {
            0 => Ok(SyncPhase::LatencyProfiling),
            1 => Ok(SyncPhase::WholeSecondOffset),
            2 => Ok(SyncPhase::BinarySearch),
            3 => Ok(SyncPhase::Verification),
            4 => Ok(SyncPhase::Complete),
            other => Err(format!("unknown sync phase: {other}")),
        }
    }
}

// ── Sync Events (for Channel IPC) ──

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum SyncEvent {
    Progress(SyncProgressPayload),
    Complete(SyncCompletePayload),
    Error(SyncErrorPayload),
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncProgressPayload {
    pub server_id: i64,
    pub phase: SyncPhase,
    pub progress_percent: f64,
    pub phase_data: serde_json::Value,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncCompletePayload {
    pub server_id: i64,
    pub result: SyncResult,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyncErrorPayload {
    pub server_id: i64,
    pub error: String,
}

// ── App Settings ──

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub min_request_interval_ms: u32,
    pub health_resync_threshold: u8,
    pub external_time_source: String,
    pub show_milliseconds: bool,
    pub millisecond_precision: u8,
    pub show_timezone_offset: bool,
    pub overlay_opacity: u8,
    pub overlay_auto_hide: bool,
    pub overlay_always_on_top: bool,
    pub alert_intervals: Vec<u32>,
    pub alert_method: String,
    pub drift_warning_threshold_ms: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            min_request_interval_ms: 500,
            health_resync_threshold: 50,
            external_time_source: "ntp".to_string(),
            show_milliseconds: true,
            millisecond_precision: 3,
            show_timezone_offset: false,
            overlay_opacity: 75,
            overlay_auto_hide: false,
            overlay_always_on_top: true,
            alert_intervals: vec![10, 5, 1],
            alert_method: "both".to_string(),
            drift_warning_threshold_ms: 1000,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    // ── ServerStatus::Display ──

    #[test]
    fn server_status_display_idle() {
        assert_eq!(ServerStatus::Idle.to_string(), "idle");
    }

    #[test]
    fn server_status_display_syncing() {
        assert_eq!(ServerStatus::Syncing.to_string(), "syncing");
    }

    #[test]
    fn server_status_display_synced() {
        assert_eq!(ServerStatus::Synced.to_string(), "synced");
    }

    #[test]
    fn server_status_display_error() {
        assert_eq!(ServerStatus::Error.to_string(), "error");
    }

    // ── ServerStatus::FromStr ──

    #[test]
    fn server_status_from_str_all_variants() {
        assert_eq!("idle".parse::<ServerStatus>().unwrap(), ServerStatus::Idle);
        assert_eq!("syncing".parse::<ServerStatus>().unwrap(), ServerStatus::Syncing);
        assert_eq!("synced".parse::<ServerStatus>().unwrap(), ServerStatus::Synced);
        assert_eq!("error".parse::<ServerStatus>().unwrap(), ServerStatus::Error);
    }

    #[test]
    fn server_status_from_str_unknown_returns_err() {
        let result = "unknown".parse::<ServerStatus>();
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("unknown server status"));
    }

    // ── ServerStatus serde roundtrip ──

    #[test]
    fn server_status_serde_roundtrip() {
        for status in [
            ServerStatus::Idle,
            ServerStatus::Syncing,
            ServerStatus::Synced,
            ServerStatus::Error,
        ] {
            let json = serde_json::to_string(&status).unwrap();
            let roundtripped: ServerStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(roundtripped, status);
        }
    }

    #[test]
    fn server_status_serializes_to_lowercase_string() {
        assert_eq!(serde_json::to_string(&ServerStatus::Idle).unwrap(), "\"idle\"");
        assert_eq!(serde_json::to_string(&ServerStatus::Syncing).unwrap(), "\"syncing\"");
        assert_eq!(serde_json::to_string(&ServerStatus::Synced).unwrap(), "\"synced\"");
        assert_eq!(serde_json::to_string(&ServerStatus::Error).unwrap(), "\"error\"");
    }

    // ── SyncPhase i32 conversions ──

    #[test]
    fn sync_phase_to_i32_mapping() {
        assert_eq!(i32::from(SyncPhase::LatencyProfiling), 0);
        assert_eq!(i32::from(SyncPhase::WholeSecondOffset), 1);
        assert_eq!(i32::from(SyncPhase::BinarySearch), 2);
        assert_eq!(i32::from(SyncPhase::Verification), 3);
        assert_eq!(i32::from(SyncPhase::Complete), 4);
    }

    #[test]
    fn sync_phase_from_i32_all_valid() {
        assert_eq!(SyncPhase::try_from(0).unwrap(), SyncPhase::LatencyProfiling);
        assert_eq!(SyncPhase::try_from(1).unwrap(), SyncPhase::WholeSecondOffset);
        assert_eq!(SyncPhase::try_from(2).unwrap(), SyncPhase::BinarySearch);
        assert_eq!(SyncPhase::try_from(3).unwrap(), SyncPhase::Verification);
        assert_eq!(SyncPhase::try_from(4).unwrap(), SyncPhase::Complete);
    }

    #[test]
    fn sync_phase_try_from_invalid_returns_err() {
        assert!(SyncPhase::try_from(-1).is_err());
        assert!(SyncPhase::try_from(5).is_err());
        assert!(SyncPhase::try_from(100).is_err());
    }

    // ── SyncPhase serde_json::Value conversion ──

    #[test]
    fn sync_phase_to_json_value_snake_case() {
        let v: serde_json::Value = SyncPhase::LatencyProfiling.into();
        assert_eq!(v, serde_json::Value::String("latency_profiling".to_string()));

        let v: serde_json::Value = SyncPhase::WholeSecondOffset.into();
        assert_eq!(v, serde_json::Value::String("whole_second_offset".to_string()));

        let v: serde_json::Value = SyncPhase::BinarySearch.into();
        assert_eq!(v, serde_json::Value::String("binary_search".to_string()));

        let v: serde_json::Value = SyncPhase::Verification.into();
        assert_eq!(v, serde_json::Value::String("verification".to_string()));

        let v: serde_json::Value = SyncPhase::Complete.into();
        assert_eq!(v, serde_json::Value::String("complete".to_string()));
    }

    // ── SyncPhase serde roundtrip ──

    #[test]
    fn sync_phase_serde_roundtrip() {
        for phase in [
            SyncPhase::LatencyProfiling,
            SyncPhase::WholeSecondOffset,
            SyncPhase::BinarySearch,
            SyncPhase::Verification,
            SyncPhase::Complete,
        ] {
            let json = serde_json::to_string(&phase).unwrap();
            let roundtripped: SyncPhase = serde_json::from_str(&json).unwrap();
            assert_eq!(roundtripped, phase);
        }
    }

    // ── AppSettings::Default ──

    #[test]
    fn app_settings_default_values() {
        let s = AppSettings::default();
        assert_eq!(s.theme, "dark");
        assert_eq!(s.min_request_interval_ms, 500);
        assert_eq!(s.health_resync_threshold, 50);
        assert_eq!(s.external_time_source, "ntp");
        assert!(s.show_milliseconds);
        assert_eq!(s.millisecond_precision, 3);
        assert!(!s.show_timezone_offset);
        assert_eq!(s.overlay_opacity, 75);
        assert!(!s.overlay_auto_hide);
        assert!(s.overlay_always_on_top);
        assert_eq!(s.alert_intervals, vec![10, 5, 1]);
        assert_eq!(s.alert_method, "both");
        assert_eq!(s.drift_warning_threshold_ms, 1000);
    }

    // ── SyncEvent serialization ──

    #[test]
    fn sync_event_progress_serializes_with_correct_tag() {
        let payload = SyncProgressPayload {
            server_id: 1,
            phase: SyncPhase::LatencyProfiling,
            progress_percent: 25.0,
            phase_data: serde_json::Value::Null,
            elapsed_ms: 100,
        };
        let event = SyncEvent::Progress(payload);
        let v: serde_json::Value = serde_json::to_value(&event).unwrap();
        assert_eq!(v["event"], "Progress");
        assert_eq!(v["data"]["server_id"], 1);
        assert_eq!(v["data"]["progress_percent"], 25.0);
    }

    #[test]
    fn sync_event_complete_serializes_with_correct_tag() {
        let profile = LatencyProfile {
            min: 1.0,
            q1: 2.0,
            median: 3.0,
            mean: 3.0,
            q3: 4.0,
            max: 5.0,
        };
        let result = SyncResult {
            server_id: 2,
            whole_second_offset: 0,
            subsecond_offset: 0.0,
            total_offset_ms: 0.0,
            latency_profile: profile,
            verified: true,
            synced_at: Utc::now(),
            duration_ms: 500,
            phase_reached: SyncPhase::Complete,
        };
        let event = SyncEvent::Complete(SyncCompletePayload { server_id: 2, result });
        let v: serde_json::Value = serde_json::to_value(&event).unwrap();
        assert_eq!(v["event"], "Complete");
        assert_eq!(v["data"]["server_id"], 2);
    }

    #[test]
    fn sync_event_error_serializes_with_correct_tag() {
        let event = SyncEvent::Error(SyncErrorPayload {
            server_id: 3,
            error: "something went wrong".to_string(),
        });
        let v: serde_json::Value = serde_json::to_value(&event).unwrap();
        assert_eq!(v["event"], "Error");
        assert_eq!(v["data"]["server_id"], 3);
        assert_eq!(v["data"]["error"], "something went wrong");
    }
}
