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
