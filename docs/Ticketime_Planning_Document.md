# 🕒 Project Ticketime

## High-Precision Server Clock & Automation Platform — Planning Document

> **Version 1.0** · Last updated: 2026-02-14

Ticketime is a **high-precision time synchronization solution** designed for situations where knowing the exact time of a specific server is critical — such as **ticket reservations, limited-edition purchases, and course registrations**. Users enter the URL of a target web server (e.g., `tickets.interpark.com`, `www.naver.com`), and the application analyzes the server's HTTP response to calculate the offset from the local clock at millisecond (ms) precision. This enables users to know "what time is it right now, according to that server" in real time, while a plugin-based automation system reliably supports time-sensitive workflows.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Features](#2-core-features)
3. [Local Integration & Plugin Architecture](#3-local-integration--plugin-architecture)
4. [User Experience (UI/UX)](#4-user-experience-uiux)
5. [Technology Stack & Implementation Direction](#5-technology-stack--implementation-direction)
6. [Security & Reliability](#6-security--reliability)
7. [Future Expansion Roadmap](#7-future-expansion-roadmap)
8. [Glossary](#8-glossary)

---

## 1. Project Overview

| Item | Details |
|---|---|
| **Project Name** | Ticketime |
| **Platform** | Desktop only — Windows, macOS, Linux |
| **How It Works** | Sends HTTP requests to a **target server URL** entered by the user, analyzes the `Date` header in the response, and precisely calculates the offset between the server's current time and the local clock |
| **Target Users** | General users who need to act at exact server-time moments (ticket reservations, limited-edition purchases, course registrations), developers, traders, etc. |
| **Usage Scenario** | Register a ticketing server URL such as `tickets.interpark.com` or `www.melon.com` → check the exact time according to that server → act precisely at the opening moment |
| **Core Values** | ① Sub-1ms precision ② Data-driven time prediction ③ Safe and extensible automation |

---

## 2. Core Features

### 2-A. High-Precision Time Synchronization (Sync Logic)

**Target Server Designation — URL-Based Synchronization**

Users **directly enter the URL** of the server they wish to synchronize with (e.g., `tickets.interpark.com`, `www.naver.com`, `www.google.com`). The application sends HTTP requests to the entered URL, receives the `Date` header from the response, and calculates the offset between the server's current time and the local clock. This approach allows users to reference the time of **the actual service server they will be accessing**, rather than a generic time server like NTP. This is essential because, in scenarios such as ticket sales or purchase openings, the go-live moment is determined by the server's internal clock.

**Cost-Aware Synchronization Design**

Synchronization is a **high-cost operation** involving significant network load and computation (approximately 10+ seconds per run). To account for this, synchronization is performed intermittently — either on explicit user request or at user-configured intervals. This prevents unnecessary repeated synchronizations, conserving network resources and minimizing load on the target server.

**Time-Based Binary Search**

HTTP requests are repeatedly sent to the user-specified URL, and a binary search algorithm tracks the exact moment when the `Date` header transitions between second boundaries. By progressively halving the search interval to converge on the server time boundary, this method achieves millisecond (ms) precision with a minimal number of requests.

**Request Interval Control & Server Load Management**

To prevent excessive load on the target server during binary search, a minimum interval of 500ms between requests is enforced by default, with an average gap of approximately 1 second. This minimizes the risk of server-side rate limiting or IP blocking. A future advanced setting will allow users to adjust request intervals directly (Rate Limit Override mode).

**CDN Detection & Notification**

During synchronization, response headers are automatically inspected for CDN signatures (`cf-ray`, `server: cloudflare`, `x-served-by`, `x-cache`, etc.). If a CDN is detected, the UI displays a notice informing the user that the measured time may reflect the CDN edge node rather than the origin server. Since major CDNs typically maintain time differences of only a few milliseconds from origin servers through NTP synchronization, the practical impact is minimal — but transparency ensures users understand the full context of their measurements.

**External Time Source Fallback**

Some servers may not include a `Date` header in their HTTP responses, or may return it in a non-standard format, making normal synchronization impossible. In such cases, the application falls back to trusted external time sources — such as NTP standard time servers or Navyism — as alternative references. Users are clearly informed that this is an indirect synchronization based on an external source rather than a direct `Date` header-based synchronization, and the type of external source can be selected in settings.

**Server Drift Analysis & Persistence**

After synchronization, the precise offset between a trusted standard time server (e.g., NTP) and the target server is persisted locally. Independent offset profiles are maintained per server, so even when multiple URLs are registered, each server's time characteristics are tracked individually. The server's drift rate is then analyzed to apply mathematical interpolation for offset correction during the intervals between synchronizations.

### 2-B. Statistics & Data Analysis (Analytics)

**Five-Number Summary Visualization**

The RTT (Round-Trip Time) distribution collected during synchronization is analyzed using a five-number summary (minimum, Q1, median, Q3, maximum), and the reliability of the derived offset is visualized using box plots and similar charts.

**Health Score Analysis**

A real-time **Health Score** is computed by combining factors such as time elapsed since the last synchronization, network stability, and drift rate consistency. When the score falls below a configured threshold, the application automatically recommends re-synchronization.

---

## 3. Local Integration & Plugin Architecture

### 3-A. Core WebSocket Bridge

**Built-in Server:** A high-performance WebSocket server runs directly within the application, enabling bidirectional communication with external processes.

**Key Roles:**

- Real-time broadcasting of the latest offset values
- Ultra-low-latency trigger signal transmission when a configured event time is reached
- Management and status monitoring of connected clients (plugins)

### 3-B. Local HTTP API (Local REST API)

**Server Management**

| Endpoint | Method | Description |
|---|---|---|
| `/servers` | `GET` | Returns the full list of registered servers with summary status (Offset, Health Score, last sync time) for each |
| `/servers` | `POST` | Registers a new target server URL. Body: `{ "url": "tickets.interpark.com" }` |
| `/servers/:id` | `GET` | Returns detailed information for a specific server (Offset, Drift Rate, sync history, Health Score, etc.) |
| `/servers/:id` | `DELETE` | Removes a registered server |

**Synchronization Control**

| Endpoint | Method | Description |
|---|---|---|
| `/servers/:id/sync` | `POST` | Explicitly triggers a synchronization operation for a specific server |
| `/servers/:id/offset` | `GET` | Returns the current corrected offset for a specific server in real time |

**Events & App Status**

| Endpoint | Method | Description |
|---|---|---|
| `/events` | `GET` | Retrieves the list of registered scheduled events |
| `/events` | `POST` | Registers a new scheduled event, specifying target server, trigger time, and action |
| `/health` | `GET` | Returns the overall application status, including connected plugin count and system information |

### 3-C. Plugin System

**Definition:** Standalone extension modules that receive WebSocket signals from the core application and execute user-defined logic.

**How It Works:** Plugins connect as local WebSocket clients and stand by until they receive events such as a target time arrival signal or offset update. Plugins run in separate processes from the core application, so errors in a plugin do not affect core stability. Specific plugin types and action scopes will be defined in a separate design document.

### 3-D. OS-Level Interactions

- **Global Hotkey:** Enables instant re-synchronization, overlay toggle, and other operations even when the application is not focused.
- **Outgoing Webhook:** Calls an external API when a specific time is reached to trigger remote systems. Retry policies (maximum attempts, intervals) can be configured in case of call failure.

---

## 4. User Experience (UI/UX)

### 4-A. Server Management & Interface Design

- **Server URL Input & List Management:** A URL input field is placed at the top of the main screen for easy addition of target servers. Registered servers are managed in a list view, displaying each server's Offset, Health Score, and last synchronization time at a glance. Frequently used servers can be pinned as favorites.
- **Sync Progress Panel:** Provides real-time feedback on synchronization progress, current search interval, and precision convergence status for the 10+ second synchronization process.
- **Floating Overlay:** A transparent always-on-top clock window with click-through support, allowing users to check the time at all times during work.
- **System Tray Mode:** Transitions to a background state that maintains offset values and waits for scheduled events. The tray icon color indicates the Health Score status at a glance.

### 4-B. Visibility & Display Options

- **Millisecond (ms) Display Toggle:** Enables or disables millisecond display on the clock face.
- **Precision Control:** Allows fine-grained configuration of decimal places (1 to 3 digits).
- **Timezone Display:** Provides an option to display the target server's timezone and UTC offset side by side.

### 4-C. Multimodal Alert System

- **Visual/Auditory Scheduled Alarms:** Provides sound countdowns or screen flash signals at configurable moments before an event (e.g., 10 seconds, 5 seconds, 1 second before). Alert timing and methods are fully customizable by the user.
- **Countdown Visualization:** Visually emphasizes the remaining time until an event using a progress bar or numeric counter.

### 4-D. System Integrity Alerts

- **Local Clock Drift Warning (Toast Popup):** When the user's device time deviates from a standard time server (NTP) by more than a configured threshold (e.g., 1 second), a non-intrusive popup appears in the corner of the screen.
- **Immediate Action:** The popup includes an "NTP Sync" button that allows the user to correct the system time discrepancy with a single click.

---

## 5. Technology Stack & Implementation Direction

| Area | Candidate Technologies | Notes |
|---|---|---|
| **Runtime** | Electron / Tauri | Tauri favors lightweight builds; Electron has a more mature ecosystem |
| **Frontend** | React or Svelte + TypeScript | Reactive UI and real-time data binding |
| **Backend (Built-in Server)** | Rust or Node.js | WebSocket server and REST API |
| **Data Persistence** | SQLite / JSON files | Sync history, drift data, user settings storage |
| **Charts/Visualization** | D3.js / Chart.js | Five-number summary box plots, Health Score gauges, etc. |
| **Build/Deploy** | GitHub Actions + auto-signing | Windows (NSIS), macOS (DMG), Linux (AppImage) |

> **Note:** The technology stack may be adjusted based on prototyping validation results.

---

## 6. Security & Reliability

### 6-A. Local Communication Security

- The built-in WebSocket and REST API bind to `localhost` only by default, preventing external network exposure.
- Token-based authentication is applied for plugin connections to prevent unauthorized process access.

### 6-B. Data Integrity

- Synchronization history and offset data are stored with checksums to prevent tampering.
- A journaling mechanism is applied to automatically recover to the last valid state in case of abnormal termination.

### 6-C. Reliability Design

- Plugin Process Isolation: Plugins run in separate processes to prevent plugin errors from propagating to the core application.
- Sync Timeout: Timeout and retry policies are applied to prevent indefinite waiting during network failures.
- Resource Limits: Per-plugin CPU/memory usage caps are set to prevent system resource exhaustion.

---

## 7. Future Expansion Roadmap

| Phase | Feature | Description |
|---|---|---|
| **Phase 1** | Multi-Server Monitoring | Simultaneously compare and manage multiple target servers' times on a single screen |
| **Phase 2** | Mobile Companion App | Share desktop precision time data with mobile devices in real time |
| **Phase 3** | Plugin Marketplace | Build an ecosystem for sharing and distributing user-created automation plugins |
| **Phase 4** | CLI Tool | Support synchronization and scripting in headless environments |
| **Phase 5** | Team Sync | Collaboration features for multiple users within an organization to share synchronization profiles |

---

## 8. Glossary

| Term | Description |
|---|---|
| **Offset** | The time difference between the local clock and the target server clock (in milliseconds) |
| **RTT (Round-Trip Time)** | The total time elapsed from sending a request to receiving the response |
| **Drift / Drift Rate** | The phenomenon of a clock gradually deviating from actual time, and the rate of that deviation |
| **Five-Number Summary** | A data distribution summary consisting of minimum, Q1, median, Q3, and maximum |
| **Health Score** | A trust rating for current time data, computed from sync elapsed time, network stability, and other factors |
| **NTP (Network Time Protocol)** | A standard protocol for synchronizing computer clocks over a network |
| **Click-through** | A feature where an overlay window passes mouse click events through to the window beneath it |

---

> **End of Document** · Ticketime Planning Document v1.0
