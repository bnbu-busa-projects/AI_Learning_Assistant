<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: Generation Pipeline

## Purpose

Route user intent to reliable artifact-specific generation instead of one generic answer endpoint.

## Intents

| Intent | User Goal | Primary Outputs |
| --- | --- | --- |
| `code_homework` | Write assignment code from task/reference code | `.py` or `.ipynb` |
| `essay_latex` | Write essay/report style assignment | `.html`, `.pdf` |
| `beamer_slides` | Create presentation slides | `.html` (slide deck), `.pdf` |
| `cheat_sheet` | Compress course slides into N dense A4 pages | `.html`, `.pdf` |

## Request Shape

```json
{
  "task_text": "Write a two-page essay about ...",
  "intent": "essay_latex",
  "output_preference": "pdf",
  "search_mode": "auto",
  "model_profile_id": "default-qwen",
  "revision_of_run_id": null,
  "course_id": "course-ml",
  "upload_ids": ["upload-1"],
  "options": {
    "target_pages": 2,
    "paper_size": "A4",
    "density": "dense"
  }
}
```

`intent` is selected by the UI through an explicit artifact-type control. The backend must not infer the pipeline solely from `task_text` in phase 1.

For `code_homework`, `output_preference` defaults to `py` and may be either `py` or `ipynb`. The backend may normalize UI-friendly aliases such as `.py`, `python`, `script`, `.ipynb`, `notebook`, or `jupyter` into those canonical values. Unsupported code output preferences fail request validation with `validation_error`.

`revision_of_run_id` is optional. When present, the new run is a follow-up to a prior run owned by the same authenticated user. The backend may use the prior manifest, generated source, and output metadata as context for the revision, but the new run still produces its own run folder and manifest.

`course_id` is optional. When absent, the backend uses the user's default "Just Asking" course for grouping and must not include course context. When present and owned by the user, a non-default course may contribute compact `course_context.md` content as low-priority reference input. See `course-context.md`.

## Run Lifecycle

```text
queued -> running -> succeeded
queued -> running -> failed
queued -> cancelled
```

## Phase-1 Execution Semantics

`POST /api/runs` currently validates the request, creates a persisted run, emits the initial `queued` status event, creates the artifact folder, applies the selected search policy, and then executes the selected pipeline request-synchronously before returning the `202` response.

Because execution is synchronous in phase 1, the create-run response may already contain a terminal status such as `succeeded` or `failed`. The `queued` and `running` lifecycle states are still part of the contract: they are emitted during execution, may be observed by injected test executors, and remain the compatibility surface for a future background worker or job queue.

Clients must not rely on the create-run response being terminal. After a successful `POST /api/runs`, clients should continue to fetch the status/event endpoint until `status` is `succeeded`, `failed`, or `cancelled`. A later background executor may return from `POST /api/runs` while the run is still `queued` or `running` without changing the response envelope.

## Stages

1. Validate request and auth.
2. Resolve revision context if `revision_of_run_id` is present.
3. Resolve model profile.
4. Resolve selected course and compact course context when applicable.
5. Extract uploaded context.
6. Use the explicit selected intent to choose a pipeline.
7. Decide web search if `search_mode = auto`.
8. Estimate context budget and compress or reject if needed.
9. Generate artifact source.
10. Validate/repair source when feasible.
11. Compile PDF or notebook when applicable.
12. Write manifest, artifacts, citations, timings, and logs.

## Status Event Shape

For SSE or polling responses:

```json
{
  "run_id": "01H...",
  "status": "running",
  "stage": "compile_pdf",
  "message": "Compiling LaTeX",
  "context": {
    "estimated_input_tokens": 12000,
    "estimated_output_tokens": 4000,
    "estimated_total_tokens": 16000,
    "context_window_limit": 1000000,
    "utilization_ratio": 0.016,
    "warning_level": "ok",
    "source": "heuristic"
  },
  "timings": {
    "elapsed_ms": 12000,
    "stage_ms": 9000
  }
}
```

Phase-1 status/polling compatibility surface:

- `GET /api/runs/{run_id}/events` returns the latest status event object for the authenticated run owner.
- Clients poll this endpoint until `status` is `succeeded`, `failed`, or `cancelled`.
- When the in-memory event history is unavailable, the endpoint falls back to the persisted run status; `context` may be absent in that fallback case.
- `timings` is optional and approximate. Clients may use it for diagnostics or comfort-progress calibration, but must not present it as exact provider progress unless the emitting stage supplies real measured progress.

## Context Estimation

The context dial and the `context` block in the status event are driven by an estimator, not by exact provider accounting.

- Method: use the provider tokenizer when one is available for the selected model; otherwise fall back to a heuristic (`ceil(chars / 4)` for prose, with a higher factor for code/LaTeX). Estimates are explicitly approximate.
- `utilization_ratio = estimated_total_tokens / context_window_limit`, where the limit comes from the profile `context_window_hint`.
- Warning levels are fixed thresholds on `utilization_ratio`:

| Level | Range |
| --- | --- |
| `ok` | `< 0.70` |
| `warning` | `0.70`–`0.85` |
| `critical` | `> 0.85` |

- Guardrail: at `warning`, the builder may compress/summarize low-priority context before sending; at `critical`, it compresses aggressively and, if still over the window, fails the run with `context_overflow` rather than silently truncating required input.
- The estimator backend (`provider` vs `heuristic`) is reported as `context.source` so the UI can label estimates honestly.

## Revision Context Budgeting

When `revision_of_run_id` is present, prior-run context is low-priority input. The builder may include prior manifest summary, output filenames, generated source, and sanitized logs, but must not use a single fixed prompt dump for every model.

- The selected model profile's `context_window_hint` drives the revision budget. The budget should preserve room for the new task, current uploads/options, and the expected output tokens.
- Prior generated source may scale upward for larger windows, but it remains bounded by a policy cap and is still included only from owned prior runs.
- Logs remain much more tightly capped than generated source because they are higher-risk and lower-value; sanitization must run before truncation.
- When the profile hint is missing or small, the current conservative fallback is acceptable. When the hint is large, the default revision source budget should be meaningfully larger than the legacy 24k-character cap while still keeping the context dial below warning thresholds for ordinary follow-ups.
- The status/context estimate must count the revision text that is actually included.
- The status/context estimate must count included course context text when a non-default course contributes `course_context.md`.

## Web Search Policy

- `off`: no search.
- `on`: search unless provider/config failure prevents it; a failure here is fatal and recorded as `search_unavailable`.
- `auto`: classifier decides and records `used = true/false`; a search failure is non-fatal.

Search citations must be stored in metadata and manifest when used.

## Pipeline Rules

- Pipelines produce source files first; compiled/rendered outputs are secondary.
- Code generation should prefer runnable, complete files over snippets.
- Code generation writes either `solution.py` or `solution.ipynb`; notebook output must validate as nbformat JSON.
- Essay, slides, and cheat-sheet pipelines generate self-contained HTML documents and convert them to PDF via Playwright (headless Chromium) inside the Docker container.
- Generated HTML must be self-contained: inline CSS, inline KaTeX for math, no external stylesheet links or remote image URLs. This ensures reliable headless rendering.
- Slides HTML must follow the `slides_html/shared/deck.css` layout vocabulary: 960×540 px slides in `<section class="slide">` containers, with CSS print pagination at `@page { size: 10in 5.625in; margin: 0; }`. No institutional branding or logos in generated output.
- When HTML-to-PDF conversion fails, the pipeline persists the `.html` source and fails with `convert_failed`. No model-assisted repair pass is needed because HTML rendering is inherently tolerant.
- Generated HTML must not include remote HTTP(S) image URLs. Use inline SVG, CSS-based diagrams, or uploaded local images only. Headless Chromium does not fetch external URLs during PDF generation.
- Cheat-sheet layout may use aggressive CSS typography, multi-column grid layouts, and small fonts, but must target the requested A4 page count using `@page { size: A4; }` and CSS break controls.
- Revision runs must be independent persisted runs. They may reference prior run metadata and files, but must not overwrite the prior run folder.
- Model calls must be mockable in tests.

## Errors

Uses the canonical envelope (`errors.md`). `POST /api/runs` validation errors are synchronous; failures discovered while a run executes are reported through the status event with `status = failed` and the same `code`/`message`, and persisted to `runs.error_message`.

| Scenario | Surfaced as | Code |
| --- | --- | --- |
| Missing/unknown/unsupported `intent` | 400 sync | `unsupported_intent` |
| Unsupported `code_homework.output_preference` | 400 sync | `validation_error` |
| `cheat_sheet` without `options.target_pages` | 400 sync | `validation_error` |
| Referenced `upload_ids` missing | 400 sync | `not_found` |
| `revision_of_run_id` missing or not owned by caller | 404 sync | `not_found` |
| `course_id` missing, archived/unselectable, or not owned by caller | 404 sync | `not_found` |
| No usable model key | run `failed` | `missing_api_key` |
| Provider rejects key / unreachable | run `failed` | `provider_auth_failed` / `provider_unavailable` |
| Context too large after compression | run `failed` | `context_overflow` |
| HTML-to-PDF conversion or notebook compile fails | run `failed` (source kept) | `convert_failed` |
| Forced `search_mode = on` but search fails | run `failed` | `search_unavailable` |

## Validation Rules

- `intent` is one of `code_homework`, `essay_latex`, `beamer_slides`, `cheat_sheet`.
- `search_mode` is one of `auto`, `on`, `off`.
- `code_homework.output_preference` is `py` or `ipynb` after normalization.
- `cheat_sheet` requires `options.target_pages` (positive integer).
- `revision_of_run_id`, when present, references a run owned by the authenticated user.
- `course_id`, when present, references a selectable course owned by the authenticated user. When absent, the backend assigns the default context-disabled course.
- Students and teachers can both create generation runs in phase 1.

## Compatibility

- Additive: new optional request fields such as `course_id`, new optional `options.*`, new status `stage` strings, new `context` fields, new optional timing fields.
- Breaking (ADR required): adding/removing an intent, changing the run lifecycle states, or changing the status event envelope.

## Versioning

- Run endpoints live under `/api/runs`. `manifest.json` carries its own `schema_version` (`artifact-filesystem.md`).

## Acceptance Checks

- A request records the explicitly selected intent in run metadata.
- Each intent has a pipeline entrypoint with mocked model tests.
- Failed generation records sanitized error metadata and any partial source/logs.
- Context stats can be consumed by the UI context dial.
- Timing stats can distinguish local preparation, provider generation, HTML-to-PDF conversion, and artifact persistence well enough for bottleneck triage.
- Course context, when used, is counted in context estimates and recorded in metadata without forcing the default "Just Asking" course to contribute context.
- The Docker runtime includes Playwright and Chromium for HTML-to-PDF conversion.
- Generated PDFs render all content visible in the HTML source; diagrams use inline SVG or CSS layouts rather than external image references.

## Open Questions

- None for prompt-based intent inference; phase 1 requires explicit artifact type selection.
