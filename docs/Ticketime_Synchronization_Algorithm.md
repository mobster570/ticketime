# Ticketime Synchronization Algorithm

The core challenge is this: the HTTP `Date` header only has **one-second resolution**, yet the goal is to determine the server's time to **millisecond precision**. The algorithm achieves this in three phases.

---

## Phase 1 — Measuring Network Latency

Before any synchronization, the application needs a reliable profile of how long requests take to travel to the server and back (the round-trip time, or RTT).

It sends a series of requests (e.g., 10) at regular intervals, measures each RTT, then sorts the results and computes a statistical summary: minimum, first quartile (Q1), median, third quartile (Q3), and maximum. The **median** becomes the primary estimate of "typical" latency, and the interquartile range (Q1–Q3) defines what counts as a "normal" response time. Any request whose RTT falls far outside this range is considered unreliable and is discarded and retried.

This latency profile is essential because all subsequent timing depends on accurately predicting when a request will reach the server.

---

## Phase 2 — Finding the Whole-Second Offset

The goal here is to determine, in whole seconds, how far the server's clock differs from the local clock.

The key insight is that the request takes approximately **half the median RTT** to travel from client to server. So if you send a request at the right moment and add half the median RTT to your local send time, you get a good estimate of "what second the server saw when it processed my request."

The procedure:

1. **Wait** for a carefully chosen moment within the current local second — specifically, the moment where the request, after traveling for half the median RTT, will arrive at the server very close to a whole-second boundary. This maximizes the chance that the client's predicted second and the server's actual second agree.
2. **Send** the request and record both the local predicted second and the server's `Date` value.
3. **Validate** that the RTT of this particular request was within the normal range. If not, discard and retry.
4. **Subtract** to get the whole-second offset: `server_second − client_predicted_second`.

At this point you know the offset to the nearest whole second — but not the fractional part.

---

## Phase 3 — Binary Search for Millisecond Precision

This is the heart of the algorithm. Since the `Date` header only ticks in whole seconds, the algorithm exploits the **exact moment it ticks over** from one second to the next to pinpoint the sub-second offset.

Imagine the server's internal clock as a continuous line, and the `Date` header as a staircase that steps up by one every time the clock crosses a whole-second boundary. If you can find exactly *when* that step happens (relative to your local clock), you know the sub-second difference.

The procedure:

1. **Establish a baseline**: send a request timed to arrive mid-second and record the server's `Date` value. Call this the "previous date."

2. **Initialize a search interval** of [0, 1], representing all possible fractional-second positions within a local second.

3. **Pick the midpoint** of the interval. Time a new request so that it arrives at the server at this fractional-second position (again, by waiting until `midpoint − half_median_RTT` within the local second, then sending).

4. **Compare** the new server date to the previous one:
   - If the difference in server dates equals the elapsed wall-clock time (rounded to whole seconds), **the second boundary was not crossed** at this probe point. The boundary must be later → move the **left** bound to the midpoint.
   - If the difference is larger than expected, **the second boundary was crossed** — the server ticked over between the previous probe and this one. The boundary must be earlier → move the **right** bound to the midpoint.

5. **Repeat** until the interval is narrower than 1 millisecond.

6. The **sub-second offset** is derived from where the boundary was found. Combined with the whole-second offset from Phase 2, this gives the total offset to millisecond precision.

To put it simply: the algorithm is "listening" for the click of the server's second hand, and by probing from different angles, it triangulates the exact moment that click happens relative to the local clock.

---

## Phase 4 — Verification

To confirm the result, the algorithm performs a sanity check. It sends requests deliberately timed to arrive **half a second before** and **half a second after** the predicted second boundary (adjusted by the computed offset). In both cases, it predicts what the server's `Date` should be. If the predictions match the actual responses across multiple trials, the offset is confirmed valid. If any prediction fails, the offset is flagged as unreliable.

---

## Summary

| Phase | What it determines | Precision |
|---|---|---|
| Latency profiling | Typical request travel time | Statistical distribution |
| Whole-second offset | How many full seconds the server differs | ±1 second |
| Binary search | The fractional-second component | ~1 millisecond |
| Verification | Whether the combined offset is trustworthy | Pass/fail |

The elegance of this approach is that it extracts millisecond-precision timing from a data source (the `Date` header) that only provides one-second granularity — purely by carefully controlling *when* requests are sent and observing *when* the server's reported second changes.
