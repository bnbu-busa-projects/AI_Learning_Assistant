![AI Learning Assistant — Production Console](../../Preview.png)

# Desktop Shell

Electron shell for the phase-1 Docker Desktop runtime.

The shell owns Docker Desktop detection, Compose startup, backend health polling, window lifecycle, and reveal-in-folder IPC. It communicates with the backend only through HTTP/SSE.

The shell looks for a root Compose file in this order: `compose.yaml`, `compose.yml`, `docker-compose.yaml`, `docker-compose.yml`. The current rebuilt runtime uses the root `compose.yml` and starts only the backend container with mounted `data/` and `workspace/` paths.

## Commands

- `npm --prefix apps/desktop run build`
- `npm --prefix apps/desktop run smoke`
- `npm --prefix apps/desktop run start`

The `start` command requires the Electron package to be installed locally. The build and smoke scripts are pure Node checks so they can run before packaging is wired up.

## Runtime Inputs

- `AILA_BACKEND_URL`: backend origin, default `http://127.0.0.1:14242`.
- `AILA_WORKBENCH_URL`: optional explicit workbench URL; otherwise `${AILA_BACKEND_URL}/ui/`.

## Launchers

- `run_desktop.command`: macOS double-click entry point. It checks Docker Desktop, starts Electron when local Electron dependencies are installed, and otherwise starts the rebuilt Docker runtime directly.
- `run_desktop.bat`: Windows double-click entry point with the same behavior.

Neither launcher writes real model credentials. Local model settings should come from untracked `.env` values or the in-app settings flow.

When Electron dependencies are missing, the launchers fall back to direct Docker startup and wait for backend `/health` before opening the workbench. This keeps first Docker builds from opening `/ui/` before the backend is ready.
