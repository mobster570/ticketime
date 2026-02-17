use crate::error::AppError;
use crate::models::{LatencyProfile, SyncResult};
use crate::time_extractor::TimeExtractor;

use chrono::Utc;
use std::future::Future;
use std::pin::Pin;
use tokio_util::sync::CancellationToken;

const MAX_RETRIES: u32 = 10;
const MIN_INTERVAL_SECS: f64 = 0.5;
const DEFAULT_PROBE_COUNT: usize = 10;
const IQR_MULTIPLIER: f64 = 1.5;

/// Progress callback type
pub type ProgressCallback = Box<dyn Fn(serde_json::Value) + Send + Sync + 'static>;

// ── Abstraction layer for testability ──

/// Abstracts system clock operations so tests can use simulated time.
pub(crate) trait Clock: Send + Sync {
    /// Current wall-clock time as seconds since UNIX epoch.
    fn system_time_secs(&self) -> f64;
    /// Monotonic time in seconds (for elapsed-time measurement).
    fn monotonic_secs(&self) -> f64;
    /// Wait for a specified duration in seconds.
    fn wait(&self, seconds: f64);
    /// Wait until the system clock reaches a specific fractional-second position.
    /// `min_wait` is the minimum seconds to wait before firing (rate limiter).
    fn wait_until_fraction(&self, fraction: f64, min_wait: f64);
}

/// Abstracts the HTTP probe so tests can simulate network behaviour.
pub(crate) trait ServerProbe: Send + Sync {
    /// Send a probe and return `(server_unix_timestamp, rtt_seconds)`.
    fn probe<'a>(
        &'a self,
        url: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(i64, f64), AppError>> + Send + 'a>>;
}

// ── Real (production) implementations ──

struct RealClock {
    epoch: std::time::Instant,
}

impl RealClock {
    fn new() -> Self {
        Self {
            epoch: std::time::Instant::now(),
        }
    }
}

impl Clock for RealClock {
    fn system_time_secs(&self) -> f64 {
        crate::timing::system_time_secs()
    }
    fn monotonic_secs(&self) -> f64 {
        self.epoch.elapsed().as_secs_f64()
    }
    fn wait(&self, seconds: f64) {
        crate::timing::precise_wait(seconds);
    }
    fn wait_until_fraction(&self, fraction: f64, min_wait: f64) {
        crate::timing::wait_until_fraction(fraction, min_wait);
    }
}

struct RealServerProbe<'a> {
    client: &'a reqwest::Client,
    extractor: &'a dyn TimeExtractor,
}

impl ServerProbe for RealServerProbe<'_> {
    fn probe<'a>(
        &'a self,
        url: &'a str,
    ) -> Pin<Box<dyn Future<Output = Result<(i64, f64), AppError>> + Send + 'a>> {
        Box::pin(async move {
            let start = std::time::Instant::now();
            let response = self.client.head(url).send().await?;
            let rtt = start.elapsed().as_secs_f64();
            let timestamp = self.extractor.extract_time(&response)?;
            Ok((timestamp, rtt))
        })
    }
}

// ── Helper ──

/// Check cancellation and return Err if cancelled.
fn check_cancelled(token: &CancellationToken) -> Result<(), AppError> {
    if token.is_cancelled() {
        return Err(AppError::Cancelled);
    }
    Ok(())
}

// ── Phase 1: Latency Profiling ──

async fn measure_latency(
    probe: &dyn ServerProbe,
    clock: &dyn Clock,
    url: &str,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<LatencyProfile, AppError> {
    let mut rtts: Vec<f64> = Vec::with_capacity(DEFAULT_PROBE_COUNT);

    for i in 0..DEFAULT_PROBE_COUNT {
        check_cancelled(token)?;

        let (_, rtt) = probe.probe(url).await?;
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
            clock.wait(MIN_INTERVAL_SECS);
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
    probe: &dyn ServerProbe,
    clock: &dyn Clock,
    url: &str,
    latency: &LatencyProfile,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<i64, AppError> {
    let half_rtt = latency.median / 2.0;

    for attempt in 0..MAX_RETRIES {
        check_cancelled(token)?;

        clock.wait_until_fraction((1.0 - half_rtt).rem_euclid(1.0), MIN_INTERVAL_SECS);

        let client_predicted_second = (clock.system_time_secs() + half_rtt) as i64;

        let (server_second, rtt) = probe.probe(url).await?;

        if latency.is_in_range(rtt, IQR_MULTIPLIER) {
            let offset = server_second - client_predicted_second;

            progress(serde_json::json!({
                "phase": "whole_second_offset",
                "attempt": attempt,
                "offset_seconds": offset,
                "current_median_ms": latency.median * 1000.0,
            }));

            return Ok(offset);
        }

        clock.wait(MIN_INTERVAL_SECS);
    }

    Err(AppError::MaxRetriesExceeded(MAX_RETRIES))
}

// ── Phase 3: Binary Search for Millisecond Offset ──

async fn find_millisecond_offset(
    probe: &dyn ServerProbe,
    clock: &dyn Clock,
    url: &str,
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

        clock.wait_until_fraction((1.0 - half_rtt).rem_euclid(1.0), MIN_INTERVAL_SECS);

        let (date, rtt) = probe.probe(url).await?;
        if latency.is_in_range(rtt, IQR_MULTIPLIER) {
            previous_date = date;
            break;
        }

        retries += 1;
        if retries >= MAX_RETRIES {
            return Err(AppError::MaxRetriesExceeded(MAX_RETRIES));
        }
        clock.wait(MIN_INTERVAL_SECS);
    }

    // Step 2: Binary search for second boundary
    let mut left = 0.0_f64;
    let mut right = 1.0_f64;
    let mut iteration = 0u32;

    while right - left >= 0.001 {
        check_cancelled(token)?;

        let mid = (left + right) / 2.0;
        let wall_start = clock.monotonic_secs();

        // Probe at midpoint with retry loop for RTT validation
        let current_date: i64;
        let mut inner_retries = 0u32;
        loop {
            check_cancelled(token)?;

            clock.wait_until_fraction((mid - half_rtt).rem_euclid(1.0), MIN_INTERVAL_SECS);

            let (date, rtt) = probe.probe(url).await?;
            if latency.is_in_range(rtt, IQR_MULTIPLIER) {
                current_date = date;
                break;
            }

            inner_retries += 1;
            if inner_retries >= MAX_RETRIES {
                return Err(AppError::MaxRetriesExceeded(MAX_RETRIES));
            }
            clock.wait(MIN_INTERVAL_SECS);
        }

        // Truncation (as i64) matches the C++ reference: static_cast<time_t>(elapsed).
        // Do NOT use .round() (Rust rounds 0.5→1, causing ~500ms error) or
        // floor-diff (overcounts when probes straddle a second boundary).
        let elapsed_seconds = (clock.monotonic_secs() - wall_start) as i64;
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
            "current_median_ms": latency.median * 1000.0,
        }));

        previous_date = current_date;
        iteration += 1;
    }

    // Sub-second offset is distance from boundary to next whole second
    Ok(1.0 - left)
}

// ── Phase 4: Verification ──

async fn verify_offset(
    probe: &dyn ServerProbe,
    clock: &dyn Clock,
    url: &str,
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

            clock.wait_until_fraction((-offset - half_rtt + shift).rem_euclid(1.0), MIN_INTERVAL_SECS);

            let predicted = (clock.system_time_secs() + half_rtt + offset) as i64;

            let (actual, rtt) = probe.probe(url).await?;

            if latency.is_in_range(rtt, IQR_MULTIPLIER) {
                let is_match = predicted == actual;

                progress(serde_json::json!({
                    "phase": "verification",
                    "shift": shift,
                    "predicted": predicted,
                    "actual": actual,
                    "is_match": is_match,
                    "current_median_ms": latency.median * 1000.0,
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
            clock.wait(MIN_INTERVAL_SECS);
        }
    }

    Ok(true)
}

// ── Internal orchestrator (testable) ──

async fn synchronize_with(
    probe: &dyn ServerProbe,
    clock: &dyn Clock,
    server_id: i64,
    url: &str,
    token: &CancellationToken,
    progress: &ProgressCallback,
) -> Result<SyncResult, AppError> {
    let start = clock.monotonic_secs();

    // Phase 1: Latency Profiling
    check_cancelled(token)?;
    let latency = measure_latency(probe, clock, url, token, progress).await?;

    // Phase 2: Whole-Second Offset
    check_cancelled(token)?;
    let second_offset =
        find_second_offset(probe, clock, url, &latency, token, progress).await?;

    // Phase 3: Binary Search for Millisecond Offset
    check_cancelled(token)?;
    let ms_offset =
        find_millisecond_offset(probe, clock, url, &latency, token, progress).await?;

    let total_offset = second_offset as f64 + ms_offset;
    let total_offset_ms = total_offset * 1000.0;

    // Phase 4: Verification
    check_cancelled(token)?;
    let verified =
        verify_offset(probe, clock, url, total_offset, &latency, token, progress).await?;

    let duration_ms = ((clock.monotonic_secs() - start) * 1000.0) as u64;

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

// ── Public API (unchanged signature) ──

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

    let clock = RealClock::new();
    let real_probe = RealServerProbe {
        client: &client,
        extractor,
    };

    synchronize_with(&real_probe, &clock, server_id, url, &token, &progress).await
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::VecDeque;
    use std::sync::Mutex;

    // ── Simulated Clock ──

    /// A deterministic clock that advances only when explicitly told to.
    /// No real time passes — all waits are instantaneous advances of
    /// the internal counters.
    struct SimulatedClock {
        wall_time: Mutex<f64>,
        monotonic: Mutex<f64>,
    }

    impl SimulatedClock {
        fn new(initial_wall_time: f64) -> Self {
            Self {
                wall_time: Mutex::new(initial_wall_time),
                monotonic: Mutex::new(0.0),
            }
        }

        fn advance(&self, seconds: f64) {
            *self.wall_time.lock().unwrap() += seconds;
            *self.monotonic.lock().unwrap() += seconds;
        }
    }

    impl Clock for SimulatedClock {
        fn system_time_secs(&self) -> f64 {
            *self.wall_time.lock().unwrap()
        }

        fn monotonic_secs(&self) -> f64 {
            *self.monotonic.lock().unwrap()
        }

        fn wait(&self, seconds: f64) {
            if seconds > 0.0 {
                self.advance(seconds);
            }
        }

        fn wait_until_fraction(&self, fraction: f64, min_wait: f64) {
            assert!(
                (0.0..1.0).contains(&fraction),
                "fraction must be in [0, 1), got {fraction}"
            );
            let now = self.system_time_secs();
            let not_before = now + min_wait;
            let base_second = not_before.floor();
            let mut target = base_second + fraction;
            if not_before > target {
                target += 1.0;
            }
            let wait_duration = target - now;
            if wait_duration > 0.0 {
                self.advance(wait_duration);
            }
        }
    }

    // ── Simulated Server ──

    /// Simulates a remote server with a configurable time offset and
    /// a predetermined sequence of RTT values. Each call to `probe`
    /// pops the next RTT, advances the shared clock by that amount,
    /// and computes the server timestamp based on the offset.
    struct SimulatedServer {
        clock: std::sync::Arc<SimulatedClock>,
        /// server_time = client_send_time + rtt/2 + server_offset
        server_offset: f64,
        /// Pre-loaded RTT values consumed in FIFO order.
        rtt_sequence: Mutex<VecDeque<f64>>,
    }

    impl SimulatedServer {
        fn new(
            clock: std::sync::Arc<SimulatedClock>,
            server_offset: f64,
            rtts: Vec<f64>,
        ) -> Self {
            Self {
                clock,
                server_offset,
                rtt_sequence: Mutex::new(rtts.into()),
            }
        }

        fn remaining_rtts(&self) -> usize {
            self.rtt_sequence.lock().unwrap().len()
        }
    }

    impl ServerProbe for SimulatedServer {
        fn probe<'a>(
            &'a self,
            _url: &'a str,
        ) -> Pin<Box<dyn Future<Output = Result<(i64, f64), AppError>> + Send + 'a>> {
            Box::pin(async move {
                let rtt = self
                    .rtt_sequence
                    .lock()
                    .unwrap()
                    .pop_front()
                    .expect("SimulatedServer: ran out of pre-loaded RTT values");
                assert!(rtt >= 0.0, "RTT must be non-negative, got {rtt}");

                // Record send time (before network travel)
                let send_time = self.clock.system_time_secs();

                // Simulate full round-trip (clock advances by RTT)
                self.clock.advance(rtt);

                // Server processes at the midpoint of the round-trip
                let server_process_time = send_time + rtt / 2.0 + self.server_offset;
                let server_timestamp = server_process_time.floor() as i64;

                Ok((server_timestamp, rtt))
            })
        }
    }

    // ── Helpers ──

    fn noop_progress() -> ProgressCallback {
        Box::new(|_| {})
    }

    /// Generate `count` RTT values with small deterministic jitter around `base`.
    fn generate_rtts(base: f64, jitter: f64, count: usize) -> Vec<f64> {
        (0..count)
            .map(|i| {
                // Deterministic oscillation: alternates above/below base
                let sign = if i % 2 == 0 { 1.0 } else { -1.0 };
                let magnitude = ((i % 5) as f64 + 1.0) / 5.0; // 0.2..1.0
                base + sign * jitter * magnitude
            })
            .collect()
    }

    // ── Unit tests: LatencyProfile ──

    #[test]
    fn test_latency_profile_iqr() {
        let profile = LatencyProfile {
            min: 0.040,
            q1: 0.045,
            median: 0.050,
            mean: 0.050,
            q3: 0.055,
            max: 0.060,
        };
        assert!((profile.iqr() - 0.010).abs() < 1e-10);
    }

    #[test]
    fn test_latency_profile_is_in_range() {
        let profile = LatencyProfile {
            min: 0.040,
            q1: 0.045,
            median: 0.050,
            mean: 0.050,
            q3: 0.055,
            max: 0.060,
        };
        // IQR = 0.010, multiplier = 1.5
        // lower = 0.045 - 0.015 = 0.030
        // upper = 0.055 + 0.015 = 0.070
        assert!(profile.is_in_range(0.050, 1.5));
        assert!(profile.is_in_range(0.030, 1.5));
        assert!(profile.is_in_range(0.070, 1.5));
        assert!(!profile.is_in_range(0.029, 1.5));
        assert!(!profile.is_in_range(0.071, 1.5));
    }

    // ── SimulatedClock tests ──

    #[test]
    fn test_simulated_clock_advance() {
        let clock = SimulatedClock::new(1_000_000.0);
        assert!((clock.system_time_secs() - 1_000_000.0).abs() < 1e-10);
        assert!((clock.monotonic_secs() - 0.0).abs() < 1e-10);

        clock.advance(1.5);
        assert!((clock.system_time_secs() - 1_000_001.5).abs() < 1e-10);
        assert!((clock.monotonic_secs() - 1.5).abs() < 1e-10);
    }

    #[test]
    fn test_simulated_clock_wait_until_fraction() {
        let clock = SimulatedClock::new(1_000_000.2);
        clock.wait_until_fraction(0.3, 0.0);
        // min_wait=0: not_before = 1_000_000.2, base_second = 1_000_000.0
        // target = 1_000_000.3, not_before(1e6+0.2) < target(1e6+0.3) → no skip
        assert!((clock.system_time_secs() - 1_000_000.3).abs() < 1e-10);
    }

    #[test]
    fn test_simulated_clock_wait_until_fraction_already_past() {
        let clock = SimulatedClock::new(1_000_000.6);
        clock.wait_until_fraction(0.3, 0.0);
        // min_wait=0: not_before = 1_000_000.6, base_second = 1_000_000.0
        // target = 1_000_000.3, not_before(1e6+0.6) > target(1e6+0.3) → skip
        // target = 1_000_001.3
        assert!((clock.system_time_secs() - 1_000_001.3).abs() < 1e-10);
    }

    #[test]
    fn test_simulated_clock_wait_until_fraction_with_min_wait() {
        let clock = SimulatedClock::new(1_000_000.2);
        clock.wait_until_fraction(0.3, 0.5);
        // min_wait=0.5: not_before = 1_000_000.7, base_second = 1_000_000.0
        // target = 1_000_000.3, not_before(1e6+0.7) > target(1e6+0.3) → skip
        // target = 1_000_001.3
        assert!((clock.system_time_secs() - 1_000_001.3).abs() < 1e-10);
    }

    // ── Phase 1: measure_latency ──

    #[tokio::test]
    async fn test_measure_latency_produces_valid_profile() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        // 10 RTTs with small jitter around 50ms
        let rtts = vec![
            0.048, 0.052, 0.049, 0.051, 0.050, 0.050, 0.049, 0.051, 0.048, 0.052,
        ];
        let server = SimulatedServer::new(clock.clone(), 0.0, rtts);
        let token = CancellationToken::new();

        let profile =
            measure_latency(&server, clock.as_ref(), "http://test", &token, &noop_progress())
                .await
                .unwrap();

        // Sorted RTTs: [0.048, 0.048, 0.049, 0.049, 0.050, 0.050, 0.051, 0.051, 0.052, 0.052]
        assert!(profile.min <= profile.q1);
        assert!(profile.q1 <= profile.median);
        assert!(profile.median <= profile.q3);
        assert!(profile.q3 <= profile.max);
        assert!((profile.median - 0.050).abs() < 1e-10);
        assert!((profile.mean - 0.050).abs() < 1e-10);
    }

    // ── Phase 2: find_second_offset ──

    #[tokio::test]
    async fn test_find_second_offset_positive() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let server = SimulatedServer::new(clock.clone(), 5.3, vec![0.050]);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let offset = find_second_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(offset, 5, "whole-second offset for +5.3s should be 5");
    }

    #[tokio::test]
    async fn test_find_second_offset_negative() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let server = SimulatedServer::new(clock.clone(), -3.7, vec![0.050]);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let offset = find_second_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(offset, -4, "whole-second offset for -3.7s should be -4");
    }

    #[tokio::test]
    async fn test_find_second_offset_zero() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let server = SimulatedServer::new(clock.clone(), 0.2, vec![0.050]);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let offset = find_second_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(offset, 0, "whole-second offset for +0.2s should be 0");
    }

    // ── Phase 3: find_millisecond_offset ──

    #[tokio::test]
    async fn test_find_millisecond_offset_converges() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        // Phase 3 needs: 1 baseline + ~10 binary search iterations = ~11 probes
        let rtts = vec![0.050; 15];
        let server = SimulatedServer::new(clock.clone(), 5.3, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let ms_offset = find_millisecond_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        // For server_offset=5.3, sub-second offset should be ~0.3
        assert!(
            (ms_offset - 0.3).abs() < 0.002,
            "sub-second offset should be ~0.300, got {ms_offset:.4}"
        );
    }

    #[tokio::test]
    async fn test_find_millisecond_offset_small_subsecond() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let rtts = vec![0.050; 15];
        let server = SimulatedServer::new(clock.clone(), 5.05, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let ms_offset = find_millisecond_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (ms_offset - 0.05).abs() < 0.002,
            "sub-second offset should be ~0.050, got {ms_offset:.4}"
        );
    }

    #[tokio::test]
    async fn test_find_millisecond_offset_large_subsecond() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let rtts = vec![0.050; 15];
        let server = SimulatedServer::new(clock.clone(), 5.95, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let ms_offset = find_millisecond_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (ms_offset - 0.95).abs() < 0.002,
            "sub-second offset should be ~0.950, got {ms_offset:.4}"
        );
    }

    // ── Phase 4: verify_offset ──

    #[tokio::test]
    async fn test_verify_offset_correct() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let rtts = vec![0.050; 4]; // 2 shifts, possibly extra retries
        let server = SimulatedServer::new(clock.clone(), 5.3, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let verified = verify_offset(
            &server,
            clock.as_ref(),
            "http://test",
            5.3,
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(verified, "correct offset should verify successfully");
    }

    #[tokio::test]
    async fn test_verify_offset_wrong() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        let rtts = vec![0.050; 4];
        let server = SimulatedServer::new(clock.clone(), 5.3, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        // Deliberately wrong offset (off by 0.5s in the dangerous direction)
        let verified = verify_offset(
            &server,
            clock.as_ref(),
            "http://test",
            4.8,
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(!verified, "wrong offset (4.8 vs true 5.3) should fail verification");
    }

    // ── End-to-end synchronize ──

    #[tokio::test]
    async fn test_synchronize_end_to_end() {
        let server_offset = 5.3;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        // Phase 1: 10, Phase 2: 1, Phase 3: ~12, Phase 4: 2 = ~25
        // Use jittered RTTs for Phase 1 to get a realistic IQR
        let mut rtts = generate_rtts(rtt, 0.002, 10); // Phase 1
        rtts.extend(vec![rtt; 20]); // Phases 2-4
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(result.server_id, 42);
        assert_eq!(result.whole_second_offset, 5);
        assert!(
            (result.subsecond_offset - 0.3).abs() < 0.002,
            "subsecond offset should be ~0.300, got {:.4}",
            result.subsecond_offset
        );
        assert!(
            (result.total_offset_ms - 5300.0).abs() < 2.0,
            "total offset should be ~5300ms, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified, "offset should be verified");
        assert_eq!(result.phase_reached, 4);
        assert!(result.duration_ms > 0, "duration should be positive");
    }

    #[tokio::test]
    async fn test_synchronize_negative_offset() {
        let server_offset = -2.7;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.002, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(result.whole_second_offset, -3);
        assert!(
            (result.subsecond_offset - 0.3).abs() < 0.002,
            "subsecond offset should be ~0.300, got {:.4}",
            result.subsecond_offset
        );
        assert!(
            (result.total_offset_ms - (-2700.0)).abs() < 2.0,
            "total offset should be ~-2700ms, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_varying_rtt() {
        // Use a wider spread of RTTs to stress the IQR filter
        let server_offset = 3.5;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        // Phase 1: realistic spread
        let mut rtts = vec![
            0.040, 0.055, 0.048, 0.062, 0.045, 0.050, 0.052, 0.047, 0.058, 0.044,
        ];
        // Phases 2-4: use the median-ish RTT
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (result.total_offset_ms - 3500.0).abs() < 2.0,
            "total offset should be ~3500ms, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_high_latency() {
        // High-latency network (200ms RTT)
        let server_offset = 1.6;
        let rtt = 0.200;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.005, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (result.total_offset_ms - 1600.0).abs() < 2.0,
            "total offset should be ~1600ms with high latency, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_extreme_latency_rtt_over_two_seconds() {
        // Extreme latency: RTT = 2.5 seconds (half_rtt = 1.25s, exceeding 1 second)
        // Uses server_offset = 5.9 which forces the binary search through
        // mid = 0.25, triggering (0.25 - 1.25).rem_euclid(1.0) = (-1.0).rem_euclid(1.0).
        let server_offset = 5.9;
        let rtt = 2.500;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.050, 10); // Phase 1
        rtts.extend(vec![rtt; 30]); // Phases 2-4
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (result.total_offset_ms - 5900.0).abs() < 2.0,
            "total offset should be ~5900ms with extreme latency, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_low_latency() {
        // Low-latency network (5ms RTT)
        let server_offset = 0.8;
        let rtt = 0.005;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.001, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (result.total_offset_ms - 800.0).abs() < 2.0,
            "total offset should be ~800ms with low latency, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_progress_reports_all_phases() {
        let server_offset = 5.3;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.002, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let phases = std::sync::Arc::new(Mutex::new(Vec::<String>::new()));
        let phases_clone = phases.clone();
        let progress: ProgressCallback = Box::new(move |val| {
            if let Some(phase) = val.get("phase").and_then(|p| p.as_str()) {
                phases_clone.lock().unwrap().push(phase.to_string());
            }
        });

        synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &progress,
        )
        .await
        .unwrap();

        let phases = phases.lock().unwrap();
        assert!(
            phases.contains(&"latency_profiling".to_string()),
            "should report latency_profiling phase"
        );
        assert!(
            phases.contains(&"whole_second_offset".to_string()),
            "should report whole_second_offset phase"
        );
        assert!(
            phases.contains(&"binary_search".to_string()),
            "should report binary_search phase"
        );
        assert!(
            phases.contains(&"verification".to_string()),
            "should report verification phase"
        );
        assert!(
            phases.last() == Some(&"complete".to_string()),
            "last phase should be complete"
        );
    }

    // ── Edge cases: subsecond boundaries ──

    #[tokio::test]
    async fn test_synchronize_near_zero_subsecond_offset() {
        // Offset very close to a whole second (subsecond ~0.002)
        let server_offset = 3.002;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.002, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (result.total_offset_ms - 3002.0).abs() < 2.0,
            "total offset should be ~3002ms, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_near_one_subsecond_offset() {
        // Offset with subsecond part close to 1.0 (i.e., 0.998)
        let server_offset = 2.998;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.002, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert!(
            (result.total_offset_ms - 2998.0).abs() < 2.0,
            "total offset should be ~2998ms, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    #[tokio::test]
    async fn test_synchronize_exact_zero_subsecond_offset() {
        // Offset is exactly a whole number of seconds (subsecond = 0.0)
        let server_offset = 4.0;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let mut rtts = generate_rtts(rtt, 0.002, 10);
        rtts.extend(vec![rtt; 20]);
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(result.whole_second_offset, 4);
        assert!(
            result.subsecond_offset.abs() < 0.002,
            "subsecond offset should be ~0.000, got {:.4}",
            result.subsecond_offset
        );
        assert!(
            (result.total_offset_ms - 4000.0).abs() < 2.0,
            "total offset should be ~4000ms, got {:.2}ms",
            result.total_offset_ms
        );
        assert!(result.verified);
    }

    // ── Cancellation ──

    #[tokio::test]
    async fn test_synchronize_cancelled_before_start() {
        let server_offset = 5.3;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let rtts = vec![rtt; 30];
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();
        token.cancel(); // cancel immediately

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &noop_progress(),
        )
        .await;

        assert!(matches!(result, Err(AppError::Cancelled)));
    }

    #[tokio::test]
    async fn test_synchronize_cancelled_during_sync() {
        let server_offset = 5.3;
        let rtt = 0.050;
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));

        let rtts = vec![rtt; 30];
        let server = SimulatedServer::new(clock.clone(), server_offset, rtts);
        let token = CancellationToken::new();

        // Cancel via progress callback during Phase 1 (after a few probes)
        let token_clone = token.clone();
        let probe_count = std::sync::Arc::new(std::sync::atomic::AtomicU32::new(0));
        let probe_count_clone = probe_count.clone();
        let progress: ProgressCallback = Box::new(move |_| {
            let count = probe_count_clone.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            if count >= 3 {
                token_clone.cancel();
            }
        });

        let result = synchronize_with(
            &server,
            clock.as_ref(),
            42,
            "http://test",
            &token,
            &progress,
        )
        .await;

        assert!(matches!(result, Err(AppError::Cancelled)));
    }

    // ── Retry exhaustion & outlier rejection ──

    #[tokio::test]
    async fn test_find_second_offset_retries_on_outlier_rtt() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        // First 2 probes are outliers (way outside IQR), 3rd is good
        let rtts = vec![0.200, 0.200, 0.050];
        let server = SimulatedServer::new(clock.clone(), 5.3, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let offset = find_second_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await
        .unwrap();

        assert_eq!(offset, 5);
        // All 3 RTTs consumed: 2 outliers + 1 good
        assert_eq!(server.remaining_rtts(), 0);
    }

    #[tokio::test]
    async fn test_find_second_offset_max_retries_exceeded() {
        let clock = std::sync::Arc::new(SimulatedClock::new(1_000_000.0));
        // All probes are outliers — should exhaust MAX_RETRIES
        let rtts = vec![0.200; MAX_RETRIES as usize];
        let server = SimulatedServer::new(clock.clone(), 5.3, rtts);
        let token = CancellationToken::new();
        let latency = LatencyProfile {
            min: 0.048,
            q1: 0.049,
            median: 0.050,
            mean: 0.050,
            q3: 0.051,
            max: 0.052,
        };

        let result = find_second_offset(
            &server,
            clock.as_ref(),
            "http://test",
            &latency,
            &token,
            &noop_progress(),
        )
        .await;

        assert!(
            matches!(result, Err(AppError::MaxRetriesExceeded(10))),
            "should return MaxRetriesExceeded after {MAX_RETRIES} outlier RTTs"
        );
    }
}
