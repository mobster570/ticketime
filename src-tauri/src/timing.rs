use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// Always-positive modulo (mirrors Python `modulo` function).
pub fn modulo(x: f64, y: f64) -> f64 {
    let result = x % y;
    if (x < 0.0) != (y < 0.0) {
        result + y
    } else {
        result
    }
}

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

/// Wait until the system clock reaches a specific fractional-second position.
/// `fraction` must be in [0, 1).
pub fn wait_until_fraction(fraction: f64) {
    assert!((0.0..1.0).contains(&fraction), "fraction must be in [0, 1)");

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs_f64();

    let current_second = now.floor();
    let mut target = current_second + fraction;

    // If we're already past that fraction in this second,
    // aim for the same fraction in the next second
    if now + 0.5 > target {
        target += 1.0;
    }

    precise_wait(target - now);
}

/// Get the current system time as seconds since UNIX epoch (f64).
pub fn system_time_secs() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs_f64()
}
