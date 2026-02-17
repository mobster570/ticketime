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
        serde_json::to_value(phase).unwrap()
    }
}

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
