Status: Active
Last Reviewed: 2026-06-10

# Agent Instructions

This repository is a teaching-oriented academic artifact studio. Phase-1
development is complete: all four generation pipelines (code homework, essay,
slides, cheat sheet) are functional with HTML-native PDF generation via Playwright.

Read these files before implementing or reviewing:

- `docs/SPEC.md` for product intent and acceptance criteria.
- `docs/ARCH.md` for module boundaries and technology stack.
- `docs/RULES.md` for coding, testing, security, and review rules.
- `docs/CONTRACTS/` for stable API and data interfaces.
- `docs/DECISIONS/` for architecture decision records.
- `docs/IMPLEMENTATION_SUMMARY.md` for the completed development ledger.

## Current State

- Phase-1 development, QA, and the HTML-native migration are all complete.
  The task queue (`docs/TASKS/`) is empty.
- All PDF-producing pipelines use HTML-native generation with Playwright
  HTML-to-PDF conversion. There is no LaTeX/TeX Live dependency.
- The product ships as Docker Desktop (backend) + browser or Electron (frontend).
- BNBU weak auth (`@bnbu.edu.cn`) is isolated for
  future replacement by stronger auth.
- Model provider uses the OpenAI-compatible abstraction pointed at Qwen by default.
  API keys are never committed; they live in untracked `.env` or the in-app editor.
- SQLite stores metadata; generated artifacts live on disk under `workspace/`.
- The frontend is a conversational preview workbench with English, Simplified
  Chinese, and Traditional Chinese locale support.

## Commands

- Backend dev env: `python3 -m venv .venv && .venv/bin/python -m pip install --upgrade pip && .venv/bin/python -m pip install -r backend/requirements-dev.txt`
- Backend tests: `.venv/bin/python -m pytest backend/tests -q`
- Frontend tests: `npm --prefix frontend run test`
- Frontend build: `npm --prefix frontend run build`
- Frontend dev: `npm --prefix frontend run dev`
- Desktop checks: `npm --prefix apps/desktop run build && npm --prefix apps/desktop run smoke`
- Desktop launch smoke: `npm --prefix apps/desktop run launch-smoke`
- Docker config check: `docker compose -p ai-learning-assistant config`
- Docker runtime smoke: `docker compose -p ai-learning-assistant up --build -d && curl -fsS http://localhost:14242/health`
- Web browser launch (macOS): `./run_web.command` (stable stub; real logic in `scripts/launcher-web.sh`)
- End-to-end smoke: `./scripts/smoke_e2e.sh`
- Electron launch (macOS): `./run_desktop.command` (stable stub; real logic in `scripts/launcher-desktop.sh`)
- Launcher re-bless (from human Terminal.app only): `bash scripts/bless-launchers.sh`

## Project Layout

- `backend/`: FastAPI API, SQLite storage, artifact pipelines, model provider, context builder.
- `frontend/`: Vite web workbench (production console + artifact preview).
- `apps/desktop/`: Electron shell (Docker detection, window lifecycle).
- `scripts/`: macOS launcher logic, E2E smoke, bless utility.
- `workspace/`: generated artifact output (gitignored).
- `data/`: SQLite database and model secrets (gitignored).
- `docs/`: governance files, contracts, decisions, QA reports.
- `slides_html/`: reference slide deck layout vocabulary.

## Sensitive Surfaces

- Auth/session behavior is isolated for replacement; changes need explicit task scope.
- API keys and secrets are never committed. Model provider defaults include only
  non-secret values from `docs/CONTRACTS/model-settings.md`.
- Filesystem writes under `workspace/` follow `docs/CONTRACTS/artifact-filesystem.md`.
- The macOS launcher stubs `run_web.command` and `run_desktop.command` MUST NOT be
  edited from Cursor or any GUI app. Edit `scripts/launcher-*.sh` instead. See
  `docs/DECISIONS/008-launcher-stub-split.md` and `.cursor/rules/launcher-stability.mdc`.

## Working With This Repo

- If new tasks exist in `docs/TASKS/`, work from one at a time.
- Keep changes bounded; prefer contracts and tests before broad rewrites.
- Do not treat the chat UI as a support widget. The frontend is a conversational
  artifact workbench: production console, artifact preview, explicit type selection.
- Generated HTML must be self-contained (inline CSS, no external resources) for
  reliable Playwright PDF conversion.
- Do not add new dependencies without justification matching the architecture.

## Handoff Notes

Every change handoff should state: files changed, verification commands and results,
any contract or governance updates required, and remaining human decisions.
