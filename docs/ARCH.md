<!--
Owner: project-maintainer
Last Reviewed: 2026-06-10
Status: Complete
-->

# Architecture

## Architecture Summary

The system uses a local-first architecture: a web renderer provides the conversational artifact workbench, Docker Desktop runs the backend/runtime container, SQLite stores local metadata, and generated artifacts are written to explicit filesystem folders. Electron is the desktop shell and packaging wrapper.

The web renderer is the product center. It presents a production console beside a persistent preview panel, so generation history, run status, and follow-up instructions stay adjacent to the current artifact instead of burying outputs in chat text.

Future frontend work may replace visual assets, styles, and components inside `frontend/`, provided backend HTTP/SSE contracts and product capabilities remain stable.

The system is intentionally portable. The same API, storage interfaces, and artifact contracts should later support a native no-Docker desktop build or a hosted server deployment without rewriting product logic. The shell talks to the backend only over HTTP/SSE so the runtime underneath can change.

```text
[Browser at /ui/] ------------------> [Docker Desktop]
                                            |
                                            | docker compose up
                                            v
[Web Workbench: console + preview] --HTTP/SSE--> [Backend API container]
                                   |--> SQLite file (metadata)
                                   |--> workspace/ (artifact bytes)
                                   |--> Qwen / OpenAI-compatible API
                                   |--> optional web search
                                   |--> Playwright/Chromium (HTML-to-PDF)

[Electron shell] wraps the same Docker-backed workbench in the final packaging phase.
```

## Technology Stack

Major versions below are the supported baseline; exact patch versions live in lockfiles (`backend/requirements*.txt`, `frontend/package-lock.json`, `apps/desktop/package-lock.json`).

- Runtime/language: Python 3.12 (backend), Node.js 22 LTS (frontend build + Electron).
- Backend framework: FastAPI with Uvicorn; Pydantic v2 for request/response models.
- Storage: SQLite via SQLAlchemy 2.x (stdlib `sqlite3` driver). No Postgres/Mongo in the local runtime.
- Frontend: Vite 6 + vanilla/lightweight component layer (no heavy admin-dashboard kit); CSS-driven visual system.
- Desktop shell: Electron 42 (Chromium renderer + Node main process), packaging via electron-builder (future-phase).
- Model client: `openai` Python SDK in OpenAI-compatible mode, pointed at a configurable Qwen base URL.
- Document tooling: Playwright (headless Chromium) inside the container for HTML-to-PDF conversion; KaTeX for math rendering in generated HTML; `nbformat` for `.ipynb` validation; `pypdf` for PDF text extraction (OCR/scanned PDFs are out of scope). The `slides_html/shared/deck.css` layout system is the reference for generated slide decks. No LaTeX/TeX Live dependency; the LaTeX toolchain was replaced by HTML-native generation (see `docs/DECISIONS/009-html-native-artifact-generation.md`).
- Web search: pluggable provider behind an adapter; concrete provider is an open question (see below).
- Container runtime: Docker Desktop (Compose v2) as the only host prerequisite for the packaged build.

## Module Boundaries

| Module | Owns | Must Not Own | Initial Location | Key Contracts |
| --- | --- | --- | --- | --- |
| Desktop Shell | Electron startup, Docker Desktop detection, backend health polling, window lifecycle, reveal-in-folder | Backend business logic, Python imports, SQLite access, model calls | `apps/desktop/` | `runtime-electron-docker.md` |
| Web Workbench | Production console, artifact type controls, lightweight course selector, upload controls, model settings UI, context dial, stage status, comfort progress, preview-only artifact renderers, client state, locale catalog, warm editorial design tokens | Local secrets, direct filesystem/SQLite access, token-generation internals, editing generated source as source-of-truth, executing generated code/HTML, backend-owned translation or auth behavior | `frontend/` | `ui-workbench.md`, `visual-assets.md`, `course-context.md`, `artifact-access.md` |
| API Backend | HTTP routes, auth/session, run orchestration, request validation, static serving | SQL details, LaTeX internals, Electron lifecycle, raw secret persistence | `backend/` | `auth.md`, `generation-pipeline.md`, `errors.md` |
| Storage Layer | SQLite repositories, migrations, transactions for users/sessions/settings/runs/uploads/artifacts/citations | HTTP shapes, business rules, artifact bytes, prompt content | backend storage package | `sqlite-schema.md` |
| Artifact Filesystem | Run/project folder creation, safe filenames, manifests, PDF/source persistence | Metadata-of-record (rows), HTTP concerns, model calls | backend artifact package | `artifact-filesystem.md` |
| Artifact Access | Authenticated metadata and byte access for generated artifacts owned by the current user | Writing artifacts, inferring generation success, direct unauthenticated filesystem serving | backend API/core package | `artifact-access.md`, `artifact-filesystem.md` |
| Model Provider | OpenAI-compatible client, profile validation, secret loading, redaction | Pipeline/business logic, HTTP routes, SQLite schema | backend provider package | `model-settings.md` |
| Course Context | User-visible course containers, undeletable context-disabled default course, soft archive, compact `course_context.md` summary policy | Primary navigation shell, raw upload storage, hard deletion by default, forcing context into every run | backend API/core/context package, `frontend/` selector | `course-context.md`, `sqlite-schema.md`, `generation-pipeline.md` |
| Context Builder | File extraction, context-budget estimation, adaptive revision context budgeting, web-search policy decision | Artifact generation, model-call orchestration, UI rendering | backend context package | `generation-pipeline.md`, `uploads.md` |
| Artifact Pipelines | Code/essay/slides/cheat-sheet generation via HTML-native rendering, Playwright HTML-to-PDF conversion, intent routing | Secret loading, Electron internals, HTTP transport, raw SQL | backend pipeline package | `generation-pipeline.md`, `artifact-filesystem.md` |

Legacy modules under `backend/` and `frontend/` are not authoritative if they conflict with these boundaries. They may be deleted, moved, or mined for useful patterns during scoped tasks. Frontend UI modules, styling, placeholder assets, and layout code should be treated as replaceable rather than inherited design constraints.

## Canonical Phase-1 Layout

The project uses `backend/` and `frontend/` roots with Electron as the only additional app root.

```text
backend/            FastAPI API/runtime and backend modules
frontend/           Vite web workbench renderer
apps/desktop/       Electron shell
scripts/            dev/QA helpers and macOS launcher logic invoked by the .command stubs
workspace/          generated artifacts
data/               local SQLite and runtime metadata when mounted on host
docs/               governance, contracts, task queue, decisions, asset briefs
```

Do not create `apps/web/` or `services/api/` during phase 1. If a later task wants that layout, it must add a decision record and update this file, `AGENTS.md`, and affected task verification commands first.

The two macOS launcher files at the project root (`run_web.command`, `run_desktop.command`) are intentionally thin stubs that only `exec /bin/zsh` on the real logic under `scripts/launcher-*.sh`. This split exists so the `.command` files stay free of the `com.apple.provenance` xattr that macOS attaches to any file a GUI app writes, which would otherwise cause `AppleSystemPolicy` to block double-click execution. See `docs/DECISIONS/008-launcher-stub-split.md`.

## Data Model

- `users`, `sessions` -- identity and weak local auth.
- `model_profiles` -- provider profile metadata; secret material is referenced, never stored raw (see `model-settings.md` and `docs/DECISIONS/004-local-secret-storage.md`).
- `projects`, `runs` -- user-visible course containers and generation requests/lifecycle/status. In phase 1, `projects` are surfaced as courses; the default "Just Asking" project/course is undeletable and context-disabled.
- `uploads` -- references to user-supplied input bytes on disk.
- `artifacts`, `citations` -- references to generated output files and recorded sources.
- Compact course context files -- one small Markdown summary per non-default course, stored on disk and referenced from SQLite metadata.

Source of truth for metadata is the SQLite file. Source of truth for bytes (uploads, generated source, PDFs, notebooks, logs, manifests) is the artifact filesystem. See `docs/CONTRACTS/sqlite-schema.md` and `docs/CONTRACTS/artifact-filesystem.md`.

## Interfaces

- Internal: pipelines depend on the Model Provider interface and Artifact Filesystem writer, never on env vars or HTTP objects directly.
- External APIs: REST under `/api`, SSE/polling for run status. See `docs/CONTRACTS/auth.md`, `docs/CONTRACTS/model-settings.md`, `docs/CONTRACTS/generation-pipeline.md`, `docs/CONTRACTS/uploads.md`, `docs/CONTRACTS/artifact-access.md`, and `docs/CONTRACTS/course-context.md`.
- Error envelope: every API error uses the canonical shape in `docs/CONTRACTS/errors.md`.
- Files/artifacts: run folder shape and `manifest.json` per `docs/CONTRACTS/artifact-filesystem.md`.
- Desktop/runtime: Electron-to-backend handshake and startup states per `docs/CONTRACTS/runtime-electron-docker.md`.
- Frontend UX: split production console, artifact preview panel, preview states, and motion expectations per `docs/CONTRACTS/ui-workbench.md` and `docs/CONTRACTS/visual-assets.md`.

## Workbench Interaction Model

The workbench is a preview-first conversational editor, not a direct editor in phase 1.

- The left production console owns prompts, explicit artifact-type selection, uploads, search/model controls, run commands, status messages, warnings, and follow-up refinement requests.
- The right artifact panel owns the current preview, file tabs, generated file list, copy/reveal/open affordances, and preview-specific status such as PDF compile failure or code validation notes.
- The course selector is a lightweight context control inside the workbench, not a return to the old course/assignment/chat dashboard. The default "Just Asking" course receives uncategorized runs and never contributes course context; ordinary archived courses are hidden from the primary selector but remain in storage.
- The frontend owns user-facing locale selection and localized UI strings for English, Simplified Chinese (`zh-Hans`), and Traditional Chinese (`zh-Hant`). Canonical backend values, API enums, error machine codes, artifact filenames, and metadata keys stay untranslated.
- The frontend owns design-token application for the warm editorial visual system: serif display typography, warm graphite/ink surfaces, parchment preview surfaces, clay/terracotta primary accents, restrained sage/amber/coral states, and mono code/run chrome.
- A user follow-up creates a new generation run or revision. It must not mutate generated files only in frontend memory.
- Code previews are rendered with syntax highlighting and editor-grade chrome, but generated code is not executed by the browser unless a later task adds a sandboxed execution contract.
- PDF, slide, and cheat-sheet previews use generated HTML directly or rendered PDFs when available; while a run is in progress, they show skeleton/pages rather than raw source as the default view.
- Raw `.html` source, logs, and manifests remain inspectable through file affordances, but preview surfaces should lead with the rendered artifact.

## Frontend Rebuild Boundary

The frontend rebuild boundary is intentionally asymmetric:

- Stable side: backend routes, auth/session behavior, model settings endpoints, upload APIs, run creation/events, artifact manifests, and canonical error envelope.
- Disposable side: existing frontend layout, component hierarchy, CSS, visual assets, placeholder previews, dashboard/chat composition, hard-coded English UI strings, and local UI state shape.
- Adaptation rule: when the redesigned frontend meets an existing backend endpoint, adapt the frontend client to the documented contract instead of changing the backend.
- Escalation rule: if the current backend contract is insufficient for the desired appearance, create or update a separate task and contract before touching backend code.
- Partial-refactor rule: implementation may preserve working API/auth/run logic while replacing the visual shell, design tokens, localized copy boundary, console presentation, preview panel composition, and motion styles. Do not require a total frontend rewrite if a staged refactor can meet the same contracts.

## Dependency Rules

- Electron may depend on Docker CLI/Compose availability and backend HTTP health endpoints; it must not import backend Python code.
- Web UI may call backend APIs and consume server-sent events or polling; it must not read local secrets directly.
- Web UI must read generated artifact bytes through authenticated backend artifact-access APIs, not by dereferencing absolute host paths. Absolute output paths may remain available for copy/reveal affordances.
- Web UI may render generated source and PDFs, but it must not treat editable frontend state as the source of truth for artifacts.
- Web UI must not execute generated JavaScript, notebooks, shell commands, or arbitrary HTML in the main renderer. Any future execution feature needs a sandbox contract and a new task.
- Frontend appearance tasks may freely replace frontend implementation details, but must not require backend code changes to pass.
- Backend owns SQLite, filesystem artifacts, model provider calls, web search, and HTML-to-PDF conversion.
- SQLite stores metadata only. Large uploads, generated source, notebooks, PDFs, logs, and manifests stay on disk.
- Model provider code must depend on an abstract provider profile, not hard-coded Bianxie/OpenAI/Qwen constants.
- Pipeline code may call context builder, artifact writer, and model provider; it must not know Electron internals.
- Context Builder may read uploads through the storage/filesystem layer; it must not generate final artifacts.
- Revision context budgeting is profile-aware: the builder may include more prior generated source when the selected model profile advertises a larger context window, while keeping logs and secret-prone content tightly bounded and sanitized.

## Runtime Topology

```text
Electron shell
  -> starts/checks Docker Desktop
  -> docker compose up local services
  -> opens Web Workbench window
Web Workbench
  -> HTTP/SSE calls to Backend API
Backend API container
  -> SQLite volume/file
  -> workspace/output volume
  -> Qwen/OpenAI-compatible remote API
  -> optional web search
  -> Playwright/Chromium for HTML-to-PDF
```

Future runtimes must preserve the same contracts:

- Native desktop may replace Docker with bundled backend binaries.
- Hosted server may replace SQLite repositories with Postgres repositories.
- Signed macOS `.app` may reuse Electron shell and artifact contracts.

## Operational Concerns

- Configuration: backend reads runtime config from environment variables; local development values live in untracked `.env`/`.env.local`. Model variables use the `MODEL_*` names in `model-settings.md` (legacy `BIANXIE_*` names are not canonical). Tracked source may contain only the documented non-secret Qwen defaults from `docs/CONTRACTS/model-settings.md`; API keys and other secrets are never defaulted or committed.
- Observability: structured logs to stdout from the container; run progress is exposed via the status event shape in `generation-pipeline.md`. API keys, Authorization headers, raw prompts, and uploaded document contents are never logged by default.
- Failure handling: web-search and PDF-conversion failures are non-fatal unless the user forced the behavior; failures are recorded in run metadata and `manifest.json` with a sanitized message. `.html` source is always preserved even when PDF conversion fails.
- Performance: run-stage timing must be measured before optimization work. If the external model provider accounts for more than half of live run wall time, local optimization should stop at reporting and small obvious fixes unless a separate local bottleneck is demonstrated.
- Backups/migrations: SQLite uses explicit, forward-only schema migrations with a `schema_version`; the database file and `workspace/` are the two artifacts a user must back up. Both must survive container/app restarts.
- Security: weak BNBU institutional email auth is local/teaching only and isolated behind middleware so stronger auth can replace it; tokens are opaque to clients; secret storage follows `docs/DECISIONS/004-local-secret-storage.md`.
- Launcher hygiene: the macOS launchers at the project root are stub-plus-script: `run_web.command` and `run_desktop.command` are stable stubs and `scripts/launcher-web.sh` and `scripts/launcher-desktop.sh` hold the real logic. The stubs must not be rewritten by Cursor or any other GUI app; if they are, `AppleSystemPolicy` will SIGKILL the script on Finder double-click and `scripts/bless-launchers.sh` must be re-run from the human's Terminal.app. See `docs/DECISIONS/008-launcher-stub-split.md` and `.cursor/rules/launcher-stability.mdc`.

## Development History

The system was built through a structured migration from an archived MVP:

1. Governance files (spec, architecture, rules, contracts) established first.
2. SQLite storage, weak auth, model provider, and artifact filesystem foundations.
3. Four artifact pipelines built one at a time against generation contracts.
4. Frontend rebuilt as a conversational preview workbench.
5. Revision-run support and profile-aware context budgeting.
6. Electron shell and Docker runtime management.
7. Whole-product QA: agent module → human E2E → post-E2E repairs.
8. HTML-native migration: replaced LaTeX with Playwright HTML-to-PDF (ADR 009).

## Tradeoffs

- **SQLite over Postgres/Mongo**: chosen for the local desktop product because it removes Docker services, improves portability, and matches single-user/offline usage. Hosted scale is deferred. See `docs/DECISIONS/001-local-sqlite-default.md`.
- **Electron + Docker Desktop over native bundling**: accepted for speed and runtime consistency even though it is not the final native distribution. See `docs/DECISIONS/002-electron-docker-first.md`.
- **OpenAI-compatible Qwen client over native SDK**: keeps provider code small and portable. See `docs/DECISIONS/003-qwen-provider-default.md`.
- **Artifact-specific pipelines over one generic endpoint**: trades more pipeline code for reliable, intent-shaped outputs.
- **Preview-only conversational workbench over direct editing**: gives the product a modern artifact-generation feel while keeping phase-1 persistence and safety simple. See `docs/DECISIONS/006-conversational-preview-workbench.md`.
- **Full frontend appearance rebuild over incremental polish**: the existing frontend UI is not a compatibility target; backend contracts are. See `docs/DECISIONS/007-full-frontend-appearance-rebuild.md`.
- **Soft-archived course containers over hard deletion**: matches the human preference to avoid fragile database deletion paths while keeping the frontend tidy. The default "Just Asking" course is context-disabled and cannot be archived.
- **PDF.js-style browser rendering over path-only previews**: real in-app PDF preview is feasible but requires an authenticated artifact byte endpoint plus worker/static-asset handling in the Vite frontend, so it is split into a bounded frontend task after artifact access exists.

Rejected alternatives:

- Keeping the legacy role/course/chat model as the product center -- rejected because artifact generation, not classroom administration, is the product.
- Storing generated PDFs/notebooks in the database -- rejected because artifacts must stay portable on disk.

## Open Technical Questions

- Future edits to the default Qwen model id, base URL, or context hint must be verified against current official documentation before implementation. The phase-1 default endpoint targets China (Beijing) DashScope because the human-confirmed release API key belongs to the China site.
- Concrete web-search provider and its rate/cost limits are undecided; the adapter boundary lets the choice land later.
- Whether SQLite secret columns should be encrypted at rest in phase 1 or deferred to an OS keychain in a later phase (see `docs/DECISIONS/004-local-secret-storage.md`).
- Background execution model for runs (in-process tasks vs a worker) may evolve; the status event contract must stay stable regardless.
