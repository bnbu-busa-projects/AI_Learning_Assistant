<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: Electron Plus Docker Runtime

## Purpose

Define the first distributable runtime: an Electron desktop shell that depends on Docker Desktop for backend services.

## Host Requirement

Docker Desktop must be installed and running. Python, Node, LaTeX, Postgres, and Mongo must not be required on the host for the packaged build.

## Desktop Shell Responsibilities

- Detect whether Docker Desktop is available.
- Start the Docker Compose project for the app when needed.
- Wait for backend health.
- Open the workbench window.
- Show actionable error states when Docker or backend startup fails.
- Preserve user data volumes across restarts.
- Provide a way to reveal generated artifact folders.

## Backend Runtime Responsibilities

- Expose `GET /health`.
- Serve API under `/api`.
- Serve the web workbench or allow Electron to load the local renderer bundle.
- Mount a data volume for SQLite.
- Mount a workspace volume for generated artifacts.
- Store local model secret files under the mounted data volume, not in the container's ephemeral filesystem.
- Include LaTeX/PDF runtime dependencies inside the container.

## Compose Requirements

First-phase compose should include:

- backend API/runtime service
- persistent data volume/path
- persistent workspace volume/path

It should not include Postgres or Mongo for the rebuilt local runtime.

The root `compose.yml` is the canonical local runtime file for phase 1. Electron starts it with the Compose project name `ai-learning-assistant` so containers and networks do not depend on the checkout folder name. Development smoke scripts may override the host data/workspace mount paths with temporary folders and may override the host port through `AILA_BACKEND_PORT` to avoid conflicts with a running product container. The default product host port remains `14242`; the in-container paths stay `/app/data` and `/app/workspace`, and the in-container backend port stays `14242`.

## Startup States

| State | Meaning |
| --- | --- |
| `checking_docker` | Shell is detecting Docker availability |
| `starting_services` | Compose project is being started |
| `waiting_for_backend` | Health endpoint not ready yet |
| `ready` | UI can load |
| `failed` | User-visible remediation required |

## Failure Modes

| Failure | Shell Behavior | User-Visible Outcome |
| --- | --- | --- |
| Docker Desktop not installed | Stop at `checking_docker` | Actionable message with install/start guidance |
| Docker installed but not running | Offer to start, then poll | `starting_services` with a retry affordance |
| Compose up fails (port/image) | Capture sanitized log tail | `failed` with the failing service named |
| Backend `/health` never ready within timeout | Stop polling, show diagnostics | `failed` with a "view logs" affordance |
| Backend crashes after ready | Surface health-lost state | Non-destructive prompt to restart services |

Shell errors are presented to the user and also written to the launching terminal/stdout-stderr stream when one exists. They are not the API error envelope (that governs backend HTTP responses).

## Launcher Scripts

`.command` and `.bat` launchers may remain as quasi-double-click entry points. The macOS development workflow separates the browser-only product surface from the Electron wrapper:

- `run_web.command` starts the Docker Compose runtime, waits for `/health`, and opens `/ui/` in the browser. It is the preferred entry for web-first functional QA and must not require Electron dependencies.
- `run_desktop.command` starts the Electron shell. Electron owns Docker detection, Compose startup, backend health polling, and window loading. It is the preferred entry for packaging/runtime QA after the browser product passes human review.
- `run_desktop.bat` may continue to serve the Windows desktop launcher path until Windows-specific QA is prioritized.

Development launchers must not write real model credentials.

## Acceptance Checks

- With Docker Desktop running, Electron can start services and load the workbench.
- Without Docker Desktop, Electron shows a clear failure state.
- Restarting the app preserves SQLite data and workspace files.
- Compose no longer requires Postgres or Mongo for the rebuilt runtime.

## Open Questions

- None for the phase-1 Compose project name; it is pinned to `ai-learning-assistant`.
