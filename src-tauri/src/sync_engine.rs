use crate::error::AppError;
use crate::models::{LatencyProfile, SyncResult};
use crate::time_extractor::TimeExtractor;
use crate::timing::{modulo, precise_wait, system_time_secs, wait_until_fraction};
use chrono::Utc;
use std::time::Instant;
use tokio_util::sync::CancellationToken;

const MAX_RETRIES: u32 = 10;
const MIN_INTERVAL_SECS: f64 = 0.5;
const DEFAULT_PROBE_COUNT: usize = 10;
const IQR_MULTIPLIER: f64 = 1.5;

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(serde_json::Value) + Send + Sync + 'static>;

/// Send an HTTP HEAD request and extract server time + measure RTT.
async fn get_server_time(
    client: &reqwest::Client,
    url: &str,
    extractor: &dyn TimeExtractor,
) -> Result<(i64, f64), AppError> {
    let start = Instant::now();
    let response = client.head(url).send().await?;
    let rtt = start.elapsed().as_secs_f64();
    let timestamp = extractor.extract_time(&response)?;
    Ok((timestamp, rtt))
}

/// Check cancellation and return Err if cancelled.
fn check_cancelled(token: &CancellationToken) -> Result<(), AppError> {
    if token.is_cancelled() {
        return Err(AppError::Cancelled);
    }
    Ok(())
}

// ── Phase 1: Latency Profiling ──

async fn measure_latency(
    client: &reqwest::Client,
    url: &str,
    extractor: &dyn TimeExtractor,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<LatencyProfile, AppError> {
    let mut rtts: Vec<f64> = Vec::with_capacity(DEFAULT_PROBE_COUNT);

    for i in 0..DEFAULT_PROBE_COUNT {
        check_cancelled(token)?;

        let (_, rtt) = get_server_time(client, url, extractor).await?;
        rtts.push(rtt);

        let mut sorted = rtts.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let current_median = sorted[sorted.len() / 2];

        progress(serde_json::json!({
            "phase": "latency_profiling",
            "probe_index": i,
            "total_probes": DEFAULT_PROBE_COUNT,
            "rtt_ms": rtt * 1000.0,
            "current_median_ms": current_median * 1000.0,
        }));

        if i < DEFAULT_PROBE_COUNT - 1 {
            precise_wait(MIN_INTERVAL_SECS);
        }
    }

    rtts.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let n = rtts.len();

    // Linear-interpolated quartile matching the C++ reference.
    let quartile = |q: usize| -> f64 {
        let index = (n - 1) as f64 * (q as f64 / 4.0);
        let lo = index.floor() as usize;
        let hi = index.ceil() as usize;
        rtts[lo] + (rtts[hi] - rtts[lo]) * (index - lo as f64)
    };

    let profile = LatencyProfile {
        min: quartile(0),
        q1: quartile(1),
        median: quartile(2),
        mean: rtts.iter().sum::<f64>() / n as f64,
        q3: quartile(3),
        max: quartile(4),
    };

    Ok(profile)
}

// ── Phase 2: Whole-Second Offset ──

async fn find_second_offset(
    client: &reqwest::Client,
    url: &str,
    extractor: &dyn TimeExtractor,
    latency: &LatencyProfile,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<i64, AppError> {
    let half_rtt = latency.median / 2.0;

    for attempt in 0..MAX_RETRIES {
        check_cancelled(token)?;

        wait_until_fraction(modulo(1.0 - half_rtt, 1.0));

        let client_predicted_second = (system_time_secs() + half_rtt) as i64;

        let (server_second, rtt) = get_server_time(client, url, extractor).await?;

        if latency.is_in_range(rtt, IQR_MULTIPLIER) {
            let offset = server_second - client_predicted_second;

            progress(serde_json::json!({
                "phase": "whole_second_offset",
                "attempt": attempt,
                "offset_seconds": offset,
            }));

            return Ok(offset);
        }

        precise_wait(MIN_INTERVAL_SECS);
    }

    Err(AppError::MaxRetriesExceeded(MAX_RETRIES))
}

// ── Phase 3: Binary Search for Millisecond Offset ──

async fn find_millisecond_offset(
    client: &reqwest::Client,
    url: &str,
    extractor: &dyn TimeExtractor,
    latency: &LatencyProfile,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<f64, AppError> {
    let half_rtt = latency.median / 2.0;

    // Step 1: Get baseline server date
    let mut previous_date: i64;
    let mut retries = 0u32;
    loop {
        check_cancelled(token)?;

        wait_until_fraction(modulo(1.0 - half_rtt, 1.0));

        let (date, rtt) = get_server_time(client, url, extractor).await?;
        if latency.is_in_range(rtt, IQR_MULTIPLIER) {
            previous_date = date;
            break;
        }

        retries += 1;
        if retries >= MAX_RETRIES {
            return Err(AppError::MaxRetriesExceeded(MAX_RETRIES));
        }
        precise_wait(MIN_INTERVAL_SECS);
    }

    // Step 2: Binary search for second boundary
    let mut left = 0.0_f64;
    let mut right = 1.0_f64;
    let mut iteration = 0u32;

    while right - left >= 0.001 {
        check_cancelled(token)?;

        let mid = (left + right) / 2.0;
        let wall_start = Instant::now();

        // Probe at midpoint with retry loop for RTT validation
        let current_date: i64;
        let mut inner_retries = 0u32;
        loop {
            check_cancelled(token)?;

            wait_until_fraction(modulo(mid - half_rtt, 1.0));

            let (date, rtt) = get_server_time(client, url, extractor).await?;
            if latency.is_in_range(rtt, IQR_MULTIPLIER) {
                current_date = date;
                break;
            }

            inner_retries += 1;
            if inner_retries >= MAX_RETRIES {
                return Err(AppError::MaxRetriesExceeded(MAX_RETRIES));
            }
            precise_wait(MIN_INTERVAL_SECS);
        }

        // Truncation (as i64) matches the C++ reference: static_cast<time_t>(elapsed).
        // Do NOT use .round() (Rust rounds 0.5→1, causing ~500ms error) or
        // floor-diff (overcounts when probes straddle a second boundary).
        let elapsed_seconds = wall_start.elapsed().as_secs_f64() as i64;
        let date_change = current_date - previous_date;

        if date_change == elapsed_seconds {
            // Server's second did NOT tick over — boundary is LATER
            left = mid;
        } else {
            // Server's second DID tick over — boundary is EARLIER
            right = mid;
        }

        let interval_width_ms = (right - left) * 1000.0;
        let convergence_percent = (1.0 - (right - left)) * 100.0;

        progress(serde_json::json!({
            "phase": "binary_search",
            "iteration": iteration,
            "left_bound_ms": left * 1000.0,
            "right_bound_ms": right * 1000.0,
            "interval_width_ms": interval_width_ms,
            "convergence_percent": convergence_percent,
        }));

        previous_date = current_date;
        iteration += 1;
    }

    // Sub-second offset is distance from boundary to next whole second
    Ok(1.0 - left)
}

// ── Phase 4: Verification ──

async fn verify_offset(
    client: &reqwest::Client,
    url: &str,
    extractor: &dyn TimeExtractor,
    offset: f64,
    latency: &LatencyProfile,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<bool, AppError> {
    let half_rtt = latency.median / 2.0;

    for shift in &[-0.5_f64, 0.5_f64] {
        check_cancelled(token)?;

        let mut retries = 0u32;
        loop {
            check_cancelled(token)?;

            wait_until_fraction(modulo(-offset - half_rtt + shift, 1.0));

            let predicted = (system_time_secs() + half_rtt + offset) as i64;

            let (actual, rtt) = get_server_time(client, url, extractor).await?;

            if latency.is_in_range(rtt, IQR_MULTIPLIER) {
                let is_match = predicted == actual;

                progress(serde_json::json!({
                    "phase": "verification",
                    "shift": shift,
                    "predicted": predicted,
                    "actual": actual,
                    "is_match": is_match,
                }));

                if !is_match {
                    return Ok(false);
                }
                break;
            }

            retries += 1;
            if retries >= MAX_RETRIES {
                return Err(AppError::MaxRetriesExceeded(MAX_RETRIES));
            }
            precise_wait(MIN_INTERVAL_SECS);
        }
    }

    Ok(true)
}

// ── Main Synchronize Function ──

pub async fn synchronize(
    server_id: i64,
    url: &str,
    extractor: &dyn TimeExtractor,
    token: CancellationToken,
    progress: ProgressCallback,
) -> Result<SyncResult, AppError> {
    // Validate URL
    reqwest::Url::parse(url).map_err(|e| AppError::InvalidUrl(e.to_string()))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(AppError::Http)?;

    let start_time = Instant::now();

    // Phase 1: Latency Profiling
    check_cancelled(&token)?;
    let latency = measure_latency(&client, url, extractor, &token, &progress).await?;

    // Phase 2: Whole-Second Offset
    check_cancelled(&token)?;
    let second_offset = find_second_offset(&client, url, extractor, &latency, &token, &progress).await?;

    // Phase 3: Binary Search for Millisecond Offset
    check_cancelled(&token)?;
    let ms_offset = find_millisecond_offset(&client, url, extractor, &latency, &token, &progress).await?;

    let total_offset = second_offset as f64 + ms_offset;
    let total_offset_ms = total_offset * 1000.0;

    // Phase 4: Verification
    check_cancelled(&token)?;
    let verified = verify_offset(&client, url, extractor, total_offset, &latency, &token, &progress).await?;

    let duration_ms = start_time.elapsed().as_millis() as u64;

    progress(serde_json::json!({
        "phase": "complete",
        "total_offset_ms": total_offset_ms,
        "verified": verified,
        "duration_ms": duration_ms,
    }));

    Ok(SyncResult {
        server_id,
        whole_second_offset: second_offset,
        subsecond_offset: ms_offset,
        total_offset_ms,
        latency_profile: latency,
        verified,
        synced_at: Utc::now(),
        duration_ms,
        phase_reached: if verified { 4 } else { 3 },
    })
}
