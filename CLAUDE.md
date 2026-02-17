# CLAUDE.md — Ticketime App

## Project Overview

Ticketime is a **Tauri v2 desktop application** for high-precision server time synchronization. Built with React 19 + TypeScript frontend and Rust backend.

See `docs/Ticketime_PRD.md` for full requirements and `docs/Ticketime_Synchronization_Algorithm.md` for algorithm details.

## Technology Stack

| Area | Choice |
|---|---|
| Runtime | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Backend | Rust |
| Data | SQLite (rusqlite) |
| Charts | Recharts |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Routing | React Router v7 |
| Icons | Lucide React |
| Package Manager | pnpm |

## Project Structure

```
ticketime/
├── src/                  # Frontend (React + TypeScript)
│   ├── components/       # Reusable UI components
│   │   ├── server-detail/ # Server detail page components (10 files)
│   ├── pages/            # Route-level page components
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand state stores
│   ├── lib/              # Utility functions (cn, etc.)
│   ├── types/            # TypeScript type definitions
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   └── index.css         # Tailwind CSS entry
├── src-tauri/            # Backend (Rust)
│   ├── src/
│   │   ├── main.rs           # Tauri entry point
│   │   ├── lib.rs            # Library root + module registration
│   │   ├── error.rs          # Unified AppError (thiserror + Serialize)
│   │   ├── models.rs         # Server, SyncResult, SyncEvent types
│   │   ├── db.rs             # SQLite (Mutex<Connection>, WAL mode)
│   │   ├── sync_engine.rs    # 4-phase sync algorithm
│   │   ├── timing.rs         # Precision timing (busy-wait tail)
│   │   ├── time_extractor.rs # TimeExtractor trait + DateHeaderExtractor
│   │   ├── state.rs          # AppState (DB + active syncs)
│   │   └── commands.rs       # Tauri IPC commands (7 commands)
│   ├── Cargo.toml        # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── docs/                 # Project documentation
│   ├── Ticketime_PRD.md                    # Requirements (P0/P1/P2)
│   ├── Ticketime_Planning_Document.md      # Full product vision
│   ├── Ticketime_Synchronization_Algorithm.md  # 4-phase sync algorithm
│   ├── reference/ticketime_algorithm.py    # Python reference implementation
│   └── ui-examples/      # HTML mockup prototypes (6 screens)
├── vite.config.ts        # Vite + Tailwind config
├── tsconfig.app.json     # TypeScript config (with @/ alias)
└── package.json          # Node dependencies + scripts
```

## Development Commands

```bash
pnpm tauri:dev    # Run app in dev mode (hot reload frontend + Rust backend)
pnpm tauri:build  # Build production binary
pnpm build        # Build frontend only (TypeScript check + Vite)
pnpm lint         # ESLint
```

### Verification Commands

```bash
cd src-tauri && cargo check    # Rust type-check only (fast)
npx tsc --noEmit               # TypeScript check without emit
pnpm build                     # Full frontend build (tsc + vite)
```

## Path Aliases

- `@/` maps to `./src/` (configured in tsconfig.app.json + vite.config.ts)

## Commit Convention

Follow the Udacity Git Commit Message Style Guide.

```
type: subject

body (optional)

footer (optional)
```

**Type:**
- `feat`: new feature
- `fix`: bug fix
- `docs`: documentation changes
- `style`: formatting, no code meaning change (whitespace, semicolons, etc.)
- `refactor`: code change that neither fixes a bug nor adds a feature
- `test`: add or modify tests
- `chore`: build process, tooling, or dependency changes

**Rules:**
- Subject max 50 chars, lowercase start, no trailing period
- Body explains what and why, not how
- Use imperative mood (e.g. "add" not "added")
- Always write commit messages in English
- Always ask for user confirmation via AskUserQuestion before `git push`

## Tauri v2 Gotchas

- Tauri v2 plugins (dialog, fs, etc.) require a capabilities file at `src-tauri/capabilities/default.json` with permissions like `"dialog:default"`, `"fs:default"`
- Optional IPC params (`Option<T>` in Rust) must be explicitly passed as `null` from TypeScript, not omitted — omitting causes deserialization errors
- `use tauri::Manager;` is required for `app.manage()` — won't compile without it
- Use `tauri::ipc::Channel<T>` for streaming progress (not `app.emit()`)
- Spawned tasks access managed state via `AppHandle`: clone handle, then `handle.state::<T>()`
- SQLite uses `std::sync::Mutex<Connection>` — wrap DB ops in `spawn_blocking` when called from spawned async tasks
- Progress callbacks across async boundaries need `Send + Sync`: `Box<dyn Fn(T) + Send + Sync + 'static>`

## Frontend Gotchas

- Recharts v3: Tooltip `formatter` receives `number | undefined`, not `number` — use `Number(value)`
- Recharts v3: Tooltip `labelFormatter` receives `ReactNode`, not `number` — use `Number(label)` to convert
- Tailwind CSS v4: uses `@import "tailwindcss"` and `@theme {}` directive for custom properties
- Theme system: CSS custom properties in `:root` (light) / `.dark` (dark), toggled on `<html>` element
- Always use `MemoryRouter` (not `BrowserRouter`) — Tauri uses `tauri://localhost` protocol

## AI Tool Routing

- **IMPORTANT**: You **MUST** use Gemini (`ask_gemini`) for all vision, image generation, and design tasks.
- For UI/frontend work: use Gemini for initial design direction AND post-implementation review. Always close the loop with Gemini validation after UI changes are applied.

## Key Architecture Notes

- **Tauri IPC**: Frontend communicates with Rust backend via Tauri's `invoke()` command system
- **Plugin isolation**: Plugins run as separate processes connected via WebSocket (localhost only)
- **REST API**: Localhost-bound API for external integrations
- **SQLite**: All persistent data (sync history, drift profiles, settings) stored with ACID guarantees
- **Timing precision**: Rust backend handles all HTTP timing for sub-millisecond accuracy
