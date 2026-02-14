# Ticketime — Product Requirements Document

**Version:** 1.0
**Date:** 2026-02-14
**Status:** Draft
**Author:** John Doe

---

## 1. Purpose

This document defines the product requirements for Ticketime, a desktop application that provides high-precision server time synchronization. It translates the Ticketime Planning Document (v1.0) into a structured set of requirements to guide design, development, and testing.

---

## 2. Product Overview

Ticketime enables users to determine the exact current time according to a specific web server by analyzing HTTP response headers. The primary use cases involve time-critical actions such as ticket reservations, limited-edition product purchases, and course registrations, where the go-live moment is determined by the target server's internal clock rather than a generic time source.

The application runs as a desktop program on Windows, macOS, and Linux, and exposes a local plugin architecture for extensible automation.

---

## 3. Target Users

| Persona | Description |
|---|---|
| **Ticket Buyer** | Needs to act at the exact moment a ticketing server opens sales (e.g., concert tickets, event reservations). |
| **Limited-Edition Shopper** | Needs precise server time for product drops on e-commerce platforms. |
| **Student / Registrant** | Needs accurate server time for course registration or appointment booking systems. |
| **Developer / Power User** | Wants programmatic access to server time offsets via API or plugin system for custom workflows. |
| **Trader** | Requires precise time awareness for time-sensitive operations. |

---

## 4. Functional Requirements

### 4.1 Time Synchronization Engine

| ID | Requirement | Priority |
|---|---|---|
| SYNC-01 | The user shall be able to enter an arbitrary server URL and initiate synchronization against that server. | P0 |
| SYNC-02 | The system shall send HTTP requests to the target URL, parse the `Date` response header, and compute the offset between the server clock and the local clock. | P0 |
| SYNC-03 | The system shall use a time-based binary search algorithm to converge on the exact second-boundary transition of the server's `Date` header, achieving sub-millisecond precision. | P0 |
| SYNC-04 | A single synchronization operation may take approximately 10+ seconds. The system shall provide real-time progress feedback during this process. | P0 |
| SYNC-05 | A minimum interval of 500 ms between consecutive HTTP requests shall be enforced during binary search to avoid overloading the target server. | P0 |
| SYNC-06 | When CDN signatures are detected in response headers (e.g., `cf-ray`, `server: cloudflare`, `x-served-by`, `x-cache`), the system shall display a notice informing the user that the measured time may reflect a CDN edge node. | P1 |
| SYNC-07 | If the target server does not return a valid `Date` header, the system shall fall back to a trusted external time source (NTP or similar) and clearly inform the user of the indirect synchronization. | P1 |
| SYNC-08 | The system shall persist per-server offset profiles locally. Each profile records the time difference between a trusted standard time server (e.g., NTP) and the target server, along with drift rate data, and applies mathematical interpolation for offset correction between synchronizations. | P1 |
| SYNC-09 | A future "Rate Limit Override" advanced setting shall allow users to customize the minimum request interval. | P2 |

### 4.2 Statistics & Analytics

| ID | Requirement | Priority |
|---|---|---|
| STAT-01 | The system shall compute a five-number summary (min, Q1, median, Q3, max) of RTT data collected during synchronization. | P1 |
| STAT-02 | The system shall visualize RTT distribution using box plots or equivalent charts. | P1 |
| STAT-03 | The system shall compute a real-time Health Score based on time elapsed since last sync, network stability, and drift rate consistency. | P1 |
| STAT-04 | When the Health Score falls below a configurable threshold, the system shall recommend re-synchronization. | P1 |

### 4.3 Local Integration & Plugin Architecture

| ID | Requirement | Priority |
|---|---|---|
| PLUG-01 | The application shall run a built-in WebSocket server on localhost for bidirectional communication with external processes. | P0 |
| PLUG-02 | The WebSocket server shall broadcast real-time offset updates and trigger signals when configured event times are reached. | P0 |
| PLUG-03 | The application shall expose a Local REST API for server management, synchronization control, event scheduling, and health monitoring (see Section 5 for endpoint specification). | P0 |
| PLUG-04 | Plugins shall run as separate processes and connect as WebSocket clients. Plugin crashes must not affect core application stability. | P0 |
| PLUG-05 | Plugin connections shall require token-based authentication. | P1 |
| PLUG-06 | Per-plugin CPU and memory usage caps shall be enforceable. | P2 |

### 4.4 User Interface

| ID | Requirement | Priority |
|---|---|---|
| UI-01 | The main screen shall include a URL input field and a list view of registered servers showing offset, Health Score, and last sync time. | P0 |
| UI-02 | Users shall be able to pin frequently used servers as favorites. | P2 |
| UI-03 | A Sync Progress Panel shall display real-time feedback on synchronization progress, including current search interval and precision convergence. | P0 |
| UI-04 | A floating overlay shall provide a transparent, always-on-top clock window. | P1 |
| UI-05 | The application shall support system tray mode, maintaining offset values and awaiting scheduled events in the background. The tray icon shall indicate Health Score status via color. | P1 |
| UI-06 | Millisecond display on the clock face shall be toggleable. | P1 |
| UI-07 | The user shall be able to configure millisecond precision from 1 to 3 decimal places. | P2 |
| UI-08 | An option to display the target server's timezone and UTC offset shall be available. | P2 |

### 4.5 Alert System

| ID | Requirement | Priority |
|---|---|---|
| ALERT-01 | The system shall support visual and auditory alarms at user-configurable intervals before a scheduled event (e.g., 10s, 5s, 1s). | P1 |
| ALERT-02 | A countdown visualization (progress bar or numeric counter) shall display remaining time until an event. | P1 |
| ALERT-03 | A toast popup shall warn the user when local clock drift exceeds a configurable threshold (default: 1 second). | P1 |
| ALERT-04 | The drift warning popup shall include an "NTP Sync" button for one-click system time correction. | P2 |

### 4.6 OS-Level Interactions

| ID | Requirement | Priority |
|---|---|---|
| OS-01 | Global hotkeys shall support instant re-synchronization and overlay toggle when the application is not focused. | P1 |
| OS-02 | Outgoing webhooks shall call an external API when a configured event time is reached, with configurable retry policies (max attempts, intervals). | P2 |

---

## 5. API Specification

### 5.1 Server Management

| Endpoint | Method | Description |
|---|---|---|
| `/servers` | GET | Returns all registered servers with summary status (offset, Health Score, last sync time). |
| `/servers` | POST | Registers a new target server. Body: `{ "url": "<server_url>" }` |
| `/servers/:id` | GET | Returns detailed info for a specific server (offset, drift rate, sync history, Health Score). |
| `/servers/:id` | DELETE | Removes a registered server. |

### 5.2 Synchronization Control

| Endpoint | Method | Description |
|---|---|---|
| `/servers/:id/sync` | POST | Triggers synchronization for a specific server. |
| `/servers/:id/offset` | GET | Returns the current corrected offset in real time. |

### 5.3 Events & Application Status

| Endpoint | Method | Description |
|---|---|---|
| `/events` | GET | Retrieves the list of registered scheduled events. |
| `/events` | POST | Registers a new event (target server, trigger time, action). |
| `/health` | GET | Returns application status, connected plugin count, and system information. |

---

## 6. Non-Functional Requirements

### 6.1 Performance

| ID | Requirement |
|---|---|
| PERF-01 | Synchronization shall achieve sub-1ms precision against the target server. |
| PERF-02 | WebSocket trigger signal latency shall be minimized to support ultra-low-latency event delivery. |
| PERF-03 | The application shall handle multiple registered servers without degradation. |

### 6.2 Security

| ID | Requirement |
|---|---|
| SEC-01 | The WebSocket server and REST API shall bind to `localhost` only by default. |
| SEC-02 | Plugin connections shall be authenticated via tokens. |
| SEC-03 | Synchronization history and offset data shall be stored with checksums to prevent tampering. |
| SEC-04 | A journaling mechanism shall enable automatic recovery to the last valid state after abnormal termination. |

### 6.3 Reliability

| ID | Requirement |
|---|---|
| REL-01 | Plugin process isolation shall prevent plugin errors from propagating to the core application. |
| REL-02 | Synchronization shall enforce timeout and retry policies to handle network failures gracefully. |

### 6.4 Platform Support

| ID | Requirement |
|---|---|
| PLAT-01 | The application shall provide platform-specific installers for Windows, macOS, and Linux to support cross-platform environments. |

---

## 7. Technology Candidates

| Area | Options | Notes |
|---|---|---|
| Runtime | Electron or Tauri | Tauri for lightweight builds; Electron for ecosystem maturity. |
| Frontend | React or Svelte + TypeScript | Reactive UI with real-time data binding. |
| Backend | Rust or Node.js | WebSocket server and REST API implementation. |
| Data Persistence | SQLite or JSON files | Sync history, drift data, user settings. |
| Visualization | D3.js or Chart.js | Box plots, Health Score gauges, countdown displays. |

Final technology selections will be confirmed after prototyping validation.

---

## 8. Future Roadmap

| Phase | Feature | Description |
|---|---|---|
| 1 | Multi-Server Monitoring | Compare and manage multiple servers' times on a single screen. |
| 2 | Mobile Companion App | Share desktop precision time data with mobile devices in real time. |
| 3 | Plugin Marketplace | Ecosystem for sharing and distributing user-created automation plugins. |
| 4 | CLI Tool | Synchronization and scripting support for headless environments. |
| 5 | Team Sync | Collaboration features for organizations to share synchronization profiles. |

---

## 9. Glossary

| Term | Definition |
|---|---|
| **Offset** | Time difference between the local clock and the target server clock (ms). |
| **RTT** | Round-Trip Time — total time from sending a request to receiving the response. |
| **Drift / Drift Rate** | Gradual clock deviation from actual time, and the rate of that deviation. |
| **Five-Number Summary** | Distribution summary: minimum, Q1, median, Q3, maximum. |
| **Health Score** | Trust rating for current time data based on sync recency, network stability, and drift consistency. |
| **NTP** | Network Time Protocol — standard protocol for clock synchronization over a network. |

---

> **End of Document** · Ticketime PRD v1.0
