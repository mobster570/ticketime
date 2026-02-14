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
ticketime-app/
├── src/                  # Frontend (React + TypeScript)
│   ├── components/       # Reusable UI components
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
│   │   ├── main.rs       # Tauri entry point
│   │   └── lib.rs        # Library root
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

## Key Architecture Notes

- **Tauri IPC**: Frontend communicates with Rust backend via Tauri's `invoke()` command system
- **Plugin isolation**: Plugins run as separate processes connected via WebSocket (localhost only)
- **REST API**: Localhost-bound API for external integrations
- **SQLite**: All persistent data (sync history, drift profiles, settings) stored with ACID guarantees
- **Timing precision**: Rust backend handles all HTTP timing for sub-millisecond accuracy
