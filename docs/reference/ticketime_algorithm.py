"""
Ticketime Synchronization Algorithm
====================================
A Python description of the algorithm that extracts millisecond-precision
server time offsets from HTTP Date headers (which only have 1-second resolution).
"""

import time
import math
import statistics
import requests
from dataclasses import dataclass


# ──────────────────────────────────────────────────────────────
#  Data Structures
# ──────────────────────────────────────────────────────────────

@dataclass
class LatencyProfile:
    """Five-number summary + mean of round-trip times."""
    min: float
    Q1: float
    median: float
    mean: float
    Q3: float
    max: float

    @property
    def IQR(self) -> float:
        return self.Q3 - self.Q1

    def is_in_range(self, rtt: float, margin: float = 1.5) -> bool:
        """Check whether an RTT falls within an acceptable range (IQR fence)."""
        lower = self.Q1 - margin * self.IQR
        upper = self.Q3 + margin * self.IQR
        return lower <= rtt <= upper


# ──────────────────────────────────────────────────────────────
#  Utility Functions
# ──────────────────────────────────────────────────────────────

def modulo(x: float, y: float) -> float:
    """Modulo that always returns a value in [0, y) regardless of sign."""
    result = math.fmod(x, y)
    if (x < 0) != (y < 0):
        result += y
    return result


def get_server_date(url: str) -> int:
    """
    Send an HTTP HEAD request and parse the Date header
    into a Unix timestamp (whole seconds).
    """
    from email.utils import parsedate_to_datetime

    response = requests.head(url, verify=False, timeout=10)
    date_str = response.headers.get("Date")
    if date_str is None:
        raise RuntimeError("Server did not return a Date header")

    return int(parsedate_to_datetime(date_str).timestamp())


def precise_wait(seconds: float):
    """
    High-precision wait.
    Uses sleep for the bulk of the duration, then busy-waits
    for the final 100 ms to achieve sub-millisecond accuracy.
    """
    if seconds < 0:
        raise ValueError("Wait duration must be non-negative")

    start = time.perf_counter()
    # Sleep through the coarse portion
    if seconds > 0.1:
        time.sleep(seconds - 0.1)
    # Busy-wait for the precise tail
    while time.perf_counter() - start < seconds:
        pass


def wait_until_fraction(fraction: float):
    """
    Wait until the system clock reaches a specific fractional-second
    position within the next whole second.

    For example, wait_until_fraction(0.3) waits until the clock reads
    XX:XX:XX.300.
    """
    if fraction >= 1.0:
        raise ValueError("Fraction must be in [0, 1)")

    now = time.time()
    current_second = math.floor(now)
    target = current_second + fraction

    # If we're already past that fraction in this second,
    # aim for the same fraction in the next second
    if now + 0.5 > target:
        target += 1.0

    precise_wait(target - now)


# ──────────────────────────────────────────────────────────────
#  Phase 1 — Latency Profiling
# ──────────────────────────────────────────────────────────────

def measure_latency(url: str,
                    request_count: int = 10,
                    interval: float = 0.5) -> LatencyProfile:
    """
    Send multiple HTTP requests and build a statistical profile of
    the round-trip time (RTT).

    Returns a LatencyProfile with min, Q1, median, mean, Q3, max.
    """
    rtts = []

    for _ in range(request_count):
        start = time.perf_counter()
        requests.head(url, verify=False, timeout=10)
        end = time.perf_counter()

        rtts.append(end - start)
        time.sleep(interval)

    rtts.sort()

    return LatencyProfile(
        min=rtts[0],
        Q1=statistics.quantiles(rtts, n=4)[0],   # 25th percentile
        median=statistics.median(rtts),
        mean=statistics.mean(rtts),
        Q3=statistics.quantiles(rtts, n=4)[2],    # 75th percentile
        max=rtts[-1],
    )


# ──────────────────────────────────────────────────────────────
#  Phase 2 — Whole-Second Offset
# ──────────────────────────────────────────────────────────────

def find_second_offset(url: str, latency: LatencyProfile) -> int:
    """
    Determine the whole-second component of the offset between the
    local clock and the server clock.

    Strategy:
        Time the request so that it arrives at the server near the
        middle of a second (avoiding boundaries). Then compare the
        server's reported second with the client's predicted second.
    """
    half_rtt = latency.median / 2

    while True:
        # Wait so the request arrives near a whole-second boundary
        # on the server (specifically, near the midpoint where Date
        # won't be ambiguous).
        wait_until_fraction(modulo(1.0 - half_rtt, 1.0))

        # Predict what second the server will see when our request arrives
        client_predicted_second = int(time.time() + half_rtt)

        # Send the request and measure RTT
        start = time.perf_counter()
        server_second = get_server_date(url)
        end = time.perf_counter()
        rtt = end - start

        # Only accept the result if this request had a "normal" RTT
        if latency.is_in_range(rtt):
            break
        # Otherwise, discard and retry

    return server_second - client_predicted_second


# ──────────────────────────────────────────────────────────────
#  Phase 3 — Binary Search for Millisecond Offset
# ──────────────────────────────────────────────────────────────

def find_millisecond_offset(url: str, latency: LatencyProfile) -> float:
    """
    Determine the sub-second component of the offset using binary search.

    Core idea:
        The Date header ticks in whole seconds. By probing different
        fractional-second positions, we find the exact local-clock moment
        when the server's second rolls over. That transition point reveals
        the sub-second offset.

    Returns:
        The fractional-second offset (0.0 to 1.0).
    """
    half_rtt = latency.median / 2

    # ── Step 1: Get a baseline server date ──
    while True:
        wait_until_fraction(modulo(1.0 - half_rtt, 1.0))

        start = time.perf_counter()
        previous_date = get_server_date(url)
        end = time.perf_counter()
        rtt = end - start

        if latency.is_in_range(rtt):
            break

    # ── Step 2: Binary search for the second boundary ──
    left = 0.0   # earliest possible position of the boundary
    right = 1.0  # latest possible position of the boundary

    while right - left >= 0.001:  # converge to 1 ms precision
        mid = (left + right) / 2

        # Record wall-clock time to measure expected elapsed seconds
        wall_start = time.perf_counter()

        # Probe at the midpoint position within the second
        while True:
            wait_until_fraction(modulo(mid - half_rtt, 1.0))

            start = time.perf_counter()
            current_date = get_server_date(url)
            end = time.perf_counter()
            rtt = end - start

            if latency.is_in_range(rtt):
                break

        wall_end = time.perf_counter()
        elapsed_seconds = round(wall_end - wall_start)

        # ── Decision logic ──
        date_change = current_date - previous_date

        if date_change == elapsed_seconds:
            # The server's second did NOT tick over at this probe point.
            # The boundary must be LATER → narrow from the left.
            left = mid
        else:
            # The server's second DID tick over unexpectedly.
            # The boundary must be EARLIER → narrow from the right.
            right = mid

        previous_date = current_date

    # The boundary sits at approximately `left`. The sub-second offset
    # is the distance from that boundary to the next whole second.
    return 1.0 - left


# ──────────────────────────────────────────────────────────────
#  Phase 4 — Verification
# ──────────────────────────────────────────────────────────────

def verify_offset(url: str,
                  offset: float,
                  latency: LatencyProfile,
                  trials: int = 1) -> bool:
    """
    Verify the computed offset by sending requests timed to arrive
    at known positions relative to the predicted second boundary.

    For each trial, two probes are sent:
        • One arriving 0.5 s BEFORE the predicted boundary
        • One arriving 0.5 s AFTER the predicted boundary

    In both cases, the client predicts what the server's Date should be.
    If all predictions match, the offset is confirmed.
    """
    half_rtt = latency.median / 2

    for _ in range(trials):
        for shift in [-0.5, 0.5]:
            while True:
                # Time the request so it arrives at (boundary + shift)
                # on the server's timeline
                wait_until_fraction(
                    modulo(-offset - half_rtt + shift, 1.0)
                )

                # Predict what the server will report
                predicted = int(time.time() + half_rtt + offset)

                start = time.perf_counter()
                actual = get_server_date(url)
                end = time.perf_counter()
                rtt = end - start

                if latency.is_in_range(rtt):
                    break

            if predicted != actual:
                return False

    return True


# ──────────────────────────────────────────────────────────────
#  Full Synchronization Pipeline
# ──────────────────────────────────────────────────────────────

def synchronize(url: str) -> float:
    """
    Run the complete synchronization pipeline against a target server.

    Returns the total offset in seconds (server_time − local_time),
    accurate to approximately 1 millisecond.
    """
    # Phase 1: Profile network latency
    print("[Phase 1] Measuring network latency...")
    latency = measure_latency(url, request_count=10, interval=0.5)
    print(f"  Median RTT : {latency.median * 1000:.1f} ms")
    print(f"  IQR        : {latency.Q1 * 1000:.1f} – {latency.Q3 * 1000:.1f} ms")

    # Phase 2: Find whole-second offset
    print("[Phase 2] Determining whole-second offset...")
    second_offset = find_second_offset(url, latency)
    print(f"  Whole-second offset: {second_offset:+d} s")

    # Phase 3: Binary search for sub-second precision
    print("[Phase 3] Binary search for millisecond offset...")
    ms_offset = find_millisecond_offset(url, latency)
    print(f"  Sub-second offset  : {ms_offset * 1000:.1f} ms")

    # Combine into total offset
    total_offset = second_offset + ms_offset
    print(f"  Total offset       : {total_offset:+.3f} s")

    # Phase 4: Verify
    print("[Phase 4] Verifying offset...")
    if verify_offset(url, total_offset, latency, trials=1):
        print("  ✓ Offset verified successfully.")
    else:
        print("  ✗ Verification failed — offset may be unreliable.")

    return total_offset


# ──────────────────────────────────────────────────────────────
#  Entry Point
# ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    target_url = input("Enter target server URL: ").strip()
    offset = synchronize(target_url)
    print(f"\nFinal offset: {offset:+.3f} s ({offset * 1000:+.1f} ms)")
