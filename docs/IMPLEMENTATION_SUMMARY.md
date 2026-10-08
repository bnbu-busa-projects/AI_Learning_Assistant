<!--
Owner: project-maintainer
Last Reviewed: 2026-06-10
Status: Complete
-->

# Implementation Summary

## Purpose

This file is the development-completion ledger for the phase-1 product. It records
what the completed task queues implemented, how each capability was built, and which
repository artifacts carry the behavior.

## Completion Basis

- The phase-1 implementation queue (tasks 000–023) was completed on 2026-06-03 and
  moved into whole-product QA.
- Human E2E functional testing completed on 2026-06-05. All four generation
  capabilities passed; post-E2E repairs were completed for status/progress,
  previews, course context, and performance instrumentation.
- On 2026-06-09, all PDF-producing pipelines were migrated from LaTeX to
  HTML-native generation with Playwright HTML-to-PDF conversion (ADR 009).
- On 2026-06-10, the HTML-native migration queue (tasks 001–013) was completed
  and the task queue was cleared.

## Implemented Capabilities

| Capability | Implementation | Key Files |
| --- | --- | --- |
| Local-first Docker runtime | Docker Compose backend container with mounted `data/` and `workspace/`, macOS one-click launcher stubs, Electron shell wrapper | `compose.yml`, `Dockerfile`, `apps/desktop/`, `run_web.command`, `run_desktop.command`, `scripts/launcher-*.sh` |
| SQLite metadata store | Repository foundation with schema init and repos for users, sessions, model profiles, runs, uploads, artifacts, citations, courses | `backend/storage/sqlite.py`, `docs/CONTRACTS/sqlite-schema.md` |
| Artifact filesystem | Run folders, safe filenames, manifests, PDF/HTML source persistence; metadata in SQLite, bytes on disk | `backend/artifacts/filesystem.py`, `docs/CONTRACTS/artifact-filesystem.md` |
| BNBU weak auth | Registration/login for `@bnbu.edu.cn`; opaque bearer tokens; isolated for replacement | `backend/api/auth.py`, `backend/core/weak_auth.py`, `docs/CONTRACTS/auth.md` |
| Upload ingestion | Authenticated multipart uploads, phase-1 file types, owner-scoped metadata, size/type validation | `backend/api/uploads.py`, `backend/core/uploads.py`, `docs/CONTRACTS/uploads.md` |
| Model provider abstraction | OpenAI-compatible Qwen client, redacted profile metadata, local secret file/env boundary, mock provider for testing | `backend/providers/`, `backend/core/model_settings.py`, `docs/CONTRACTS/model-settings.md` |
| Generation run API | Authenticated run creation/status with explicit artifact intents, stage events, comfort progress | `backend/api/runs.py`, `backend/core/runs.py`, `backend/core/run_events.py`, `docs/CONTRACTS/generation-pipeline.md` |
| Context and search | Upload extraction, context-budget estimation, search-mode policy, profile-aware revision budgeting, course context summaries | `backend/context/`, `docs/CONTRACTS/uploads.md`, `docs/CONTRACTS/course-context.md` |
| Code homework pipeline | Direct `.py`/`.ipynb` generation through model provider | `backend/pipelines/code_homework.py` |
| Essay HTML pipeline | Self-contained HTML with inline styles and KaTeX math, converted to PDF via Playwright | `backend/pipelines/essay_html.py`, `backend/pipelines/html_to_pdf.py` |
| Slides HTML pipeline | Multi-slide HTML deck following `deck.css` layout vocabulary, converted to PDF via Playwright | `backend/pipelines/slides_html.py`, `backend/pipelines/deck_css.py` |
| Cheat sheet HTML pipeline | Dense multi-column HTML with CSS `@page` A4 targeting, converted to PDF via Playwright | `backend/pipelines/cheat_sheet_html.py` |
| HTML-to-PDF converter | Playwright headless Chromium with configurable page size, margins, and print media emulation | `backend/pipelines/html_to_pdf.py` |
| Artifact access API | Authenticated metadata and byte access for generated artifacts | `backend/core/artifact_access.py`, `docs/CONTRACTS/artifact-access.md` |
| Course context | User-visible course containers, undeletable default "Just Asking" course, soft archive, compact `course_context.md` summaries | `backend/api/courses.py`, `backend/core/courses.py`, `backend/context/course_context.py` |
| Conversational workbench | Split production console + artifact preview, explicit artifact type control, model settings editor, upload/search/run controls, context budget dial | `frontend/src/app.js`, `frontend/src/styles.css`, `frontend/src/design-tokens.css` |
| Locale boundary | English, Simplified Chinese, Traditional Chinese UI copy through locale catalog | `frontend/src/locales.js` |
| Run timing instrumentation | Per-stage timing for preparation, model calls, HTML-to-PDF conversion, and artifact persistence | `backend/timing.py` |
| Electron desktop shell | Docker detection, backend health polling, workbench window lifecycle | `apps/desktop/src/main.js`, `apps/desktop/src/runtime.js` |
| E2E smoke coverage | Mocked-provider end-to-end test exercising auth, settings, run creation, status events, manifest, and static serving | `scripts/smoke_e2e.sh` |

## Account-Specific API Keys (2026-10-08)

Personal API keys now use Fernet-encrypted SQLite storage, linked to the user.
The master key stays outside SQLite and persists in an owner-only runtime file
or an operator-supplied environment value. Shared developer keys remain compatible.
Schema v5 preserves existing accounts, sessions, and profiles. See ADR 011 and
`docs/CONTRACTS/model-settings.md`. Users must re-enter previously shared personal
keys once to make them independent. Verification is recorded in the corresponding
QA report under `docs/QA_REPORTS/`.

## Completed Task Ledger

### Phase-1 Implementation (2026-05-31 – 2026-06-03)

| Task | Summary |
| --- | --- |
| 000 | Established repo-local backend and frontend verification commands |
| 001 | Created canonical phase-1 layout |
| 002 | Introduced SQLite as local metadata foundation |
| 003 | Implemented weak institutional registration/login (now BNBU-only) |
| 004 | Added redacted model profile settings and provider connectivity |
| 005 | Implemented safe run-folder and manifest writer |
| 006 | Added authenticated run creation and status lookup |
| 007 | Added explicit intent routing and context estimation |
| 008 | Added search policy handling and citation boundary |
| 009 | Added code homework pipeline |
| 010 | Added essay LaTeX pipeline (later replaced by HTML) |
| 011 | Added Beamer slides pipeline (later replaced by HTML) |
| 012 | Added cheat-sheet pipeline (later replaced by HTML) |
| 013 | Added run-stage event/status support |
| 014 | Defined warm editorial visual system and asset prompts |
| 015 | Replaced product surface with artifact studio shell |
| 016 | Added graphical context budget dial |
| 017 | Added model settings UI with redacted key handling |
| 018 | Rebuilt visual shell, preview surfaces, locales, and motion |
| 019 | Added independent revision runs referencing prior outputs |
| 020 | Scaffolded Electron shell for Docker detection and startup |
| 021 | Updated Compose and launchers for rebuilt runtime |
| 022 | Added mocked E2E smoke coverage |
| 023 | Replaced fixed revision caps with profile-aware context budgeting |

### Post-Human-E2E Repairs (2026-06-05 – 2026-06-09)

Repairs were scoped from human E2E findings and completed as numbered tasks in the
post-E2E repair queue. Records are in `docs/QA_REPORTS/`.

- Truthful run status motion with comfort progress bar
- Real generated-output previews backed by artifact files
- LaTeX diagram-placeholder and complex-diagram avoidance
- PDF page preview renderer
- Run timing instrumentation
- Performance bottleneck triage
- Course container API and course context builder
- Course selector UI and compact course context
- Beamer slides compile guards
- Web browser QA baseline verification

### HTML-Native Migration (2026-06-09 – 2026-06-10)

Driven by ADR 009. Replaced LaTeX (TeX Live + latexmk) with Playwright HTML-to-PDF.

| Task | Summary |
| --- | --- |
| 001 | Removed TeX Live from Docker image (~400 MB savings) |
| 002 | Added Playwright/Chromium HTML-to-PDF infrastructure |
| 003 | Cleaned workspace and database for fresh start |
| 004 | Rewrote essay pipeline to generate self-contained HTML |
| 005 | Rewrote slides pipeline to generate HTML decks with `deck.css` |
| 006 | Rewrote cheat-sheet pipeline to generate dense multi-column HTML |
| 007 | Removed LaTeX sanitizer, repair, and TikZ fixup modules |
| 008 | Updated context builder and run orchestration for HTML |
| 009 | Updated frontend preview for inline HTML artifact rendering |
| 010 | Migrated pipeline unit tests to HTML expectations |
| 011 | Added integration tests for HTML-to-PDF conversion |
| 012 | Updated E2E smoke script for HTML-native pipelines |
| 013 | Verified Electron packaging with the HTML-native product |

## Resolved Blockers

- **Missing upload API** (2026-06-03): `POST /api/uploads` was required for
  phase-1 acceptance but absent. Implemented and verified before QA began.
- **LaTeX compile failures** (2026-06-05): LLM-generated LaTeX caused frequent
  syntax errors. A model-assisted repair pass was added as an interim fix.
  Permanently resolved by the HTML-native migration (ADR 009).
- **Docker image size**: TeX Live added ~400 MB. Eliminated by the migration;
  Playwright/Chromium is ~300 MB but serves additional use cases.

## Known Boundaries

- Default Qwen endpoint targets China (Beijing) DashScope. Users in other regions
  may need to change the base URL.
- The concrete web-search provider and its rate/cost limits remain undecided. The
  adapter boundary is ready.
- Native no-Docker packaging, signed macOS distribution, and hosted deployment are
  future work.
- Real model-provider smoke tests require untracked credentials. Automated tests
  use the mock provider.
