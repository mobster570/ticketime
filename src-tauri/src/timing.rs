use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// High-precision wait. Sleeps for the bulk of the duration via
/// `std::thread::sleep`, then busy-waits the final 100ms for sub-ms accuracy.
pub fn precise_wait(seconds: f64) {
    if seconds <= 0.0 {
        return;
    }

    let start = Instant::now();
    let target = std::time::Duration::from_secs_f64(seconds);

    // Sleep through the coarse portion (leave 100ms for busy-wait)
    if seconds > 0.1 {
        let sleep_duration = std::time::Duration::from_secs_f64(seconds - 0.1);
        std::thread::sleep(sleep_duration);
    }

    // Busy-wait for the precise tail
    while start.elapsed() < target {
        std::hint::spin_loop();
    }
}

/// Get the current system time as seconds since UNIX epoch (f64).
pub fn system_time_secs() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs_f64()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;

    #[test]
    fn system_time_secs_returns_reasonable_epoch_timestamp() {
        // 2023-11-15 in seconds — any real wall clock reading should exceed this
        let ts = system_time_secs();
        assert!(ts > 1_700_000_000.0, "timestamp {ts} looks too small");
    }

    #[test]
    fn precise_wait_zero_returns_immediately() {
        let start = Instant::now();
        precise_wait(0.0);
        // Should complete in well under 1ms; allow 50ms for scheduler noise
        assert!(start.elapsed().as_millis() < 50);
    }

    #[test]
    fn precise_wait_negative_returns_immediately() {
        let start = Instant::now();
        precise_wait(-1.0);
        assert!(start.elapsed().as_millis() < 50);
    }

    #[test]
    fn precise_wait_small_duration_takes_approximately_correct_time() {
        let start = Instant::now();
        precise_wait(0.01); // 10 ms
        let elapsed_ms = start.elapsed().as_millis();
        // Should be in the 5–50 ms window
        assert!(elapsed_ms >= 5, "elapsed {elapsed_ms}ms is too short");
        assert!(elapsed_ms <= 50, "elapsed {elapsed_ms}ms is too long");
    }
}
