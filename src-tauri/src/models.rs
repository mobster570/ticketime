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
    pub phase_reached: u8,
}

// ── Sync Phase ──

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncPhase {
    LatencyProfiling,
    WholeSecondOffset,
    BinarySearch,
    Verification,
    Complete,
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
    pub phase: String,
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
