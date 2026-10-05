<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: UI Workbench

## Purpose

Define the primary user experience for the rebuilt product: a conversational production workbench with a persistent artifact preview panel.

The workbench borrows proven patterns from artifact-generation tools and browser IDEs without copying a single proprietary interface: chat sits beside the artifact, chat behaves like a production console, and generated code/PDF/slides are rendered with professional preview affordances.

The existing frontend appearance is not part of this contract. This contract defines the target behavior and experience; implementation may replace old frontend components, CSS, layout, and visual assets wholesale.

## First Screen

After auth, the user lands directly in a split artifact studio:

- production console for prompts, run commands, follow-up refinements, status, and warnings
- explicit artifact type selector
- optional file upload area
- lightweight course selector with an undeletable default "Just Asking" course
- model/search controls
- run button
- visual context budget indicator
- persistent artifact preview panel
- output file list and open/reveal/copy affordances

Do not make course administration, a marketing page, or a generic chat transcript the primary first screen.

## Product Reference Model

The target feel is:

- Chat plus artifact side panel: current output is always visible beside the conversation.
- Chat as production console: user asks, system runs, stages update, preview changes, user asks for a revision.
- Code-product professionalism: code output looks like it belongs in a modern developer tool, not a textarea.
- Warm editorial artifact studio: serif-led headings, paper-like preview surfaces, warm graphite/ink shell, clay/terracotta emphasis, and restrained academic tone.

These are pattern references, not brand-copy instructions. The UI should be original, aligned with this product, and constrained by `visual-assets.md`.

## Layout Contract

The authenticated workbench must provide three stable regions:

| Region | Owns | Notes |
| --- | --- | --- |
| Production console | prompt composer, artifact type, uploads, search/model controls, run button, follow-up requests, run history, stage messages | May look chat-like, but messages should read as commands, progress, warnings, and refinement history. |
| Artifact preview panel | current generated artifact, placeholder/running/succeeded/failed preview states, tabs/files, copy/open/reveal affordances | Must be visually independent from the console so output is not buried in the transcript. |
| Utility/status surface | context dial, model status, run status, lightweight errors | Can be part of either pane as long as it stays visible during generation. |

The course selector belongs in the production console or utility/status surface. It must stay lightweight: default "Just Asking" is always available and context-disabled, ordinary courses can be selected/renamed/archived, and archived courses do not clutter the primary selector.

Responsive behavior:

- Desktop and Electron window widths should favor side-by-side console and preview.
- Narrow widths may stack panes, but preview must remain reachable through a persistent tab/segmented control, not after a long scroll through chat history.
- Pane transitions should preserve state and avoid layout jumps.

## Frontend Rebuild Policy

The next frontend implementation should be a full appearance rebuild, not a light skin over the existing UI.

- Keep: backend API usage, authenticated flow, model settings behavior, upload behavior, search mode, run creation/status flow, context budget semantics, artifact file affordances, and canonical error handling.
- Keep or refactor carefully: existing API/auth/run-status logic may be retained if it already follows documented contracts.
- Replace freely: component hierarchy, layout grid, CSS architecture, design tokens, locale catalog structure, local view models, placeholder previews, icons, textures, animations, copy placement, and visual styling.
- Avoid: carrying over legacy dashboard/course/chat surfaces solely because they already exist.
- Backend boundary: do not change backend code or API contracts during appearance rebuild. If a backend gap blocks the desired UI, document it and create a separate task.

Recommended partial-refactor path for task 018:

- Preserve working API clients, token/session handling, run submission, polling/SSE handling, model settings behavior, upload behavior, and error-envelope parsing unless they violate contracts.
- Introduce a locale catalog or equivalent module before moving large amounts of UI copy. New user-facing text should come from that boundary for `en`, `zh-Hans`, and `zh-Hant`.
- Replace `design-tokens.css` with the warm editorial token set before component polish, so panes, controls, previews, and motion share the same visual source of truth.
- Refactor the current shell in place if that keeps the task smaller: first rebuild header/pane chrome, then artifact selector/composer, then preview surfaces, then history/refinement, then motion.
- Split render helpers/components only where it clarifies ownership between production console, artifact preview, utility/status, model settings, auth, and localization.

## Preview-Only Rule

Phase 1 does not support direct editing of generated artifacts inside the workbench.

- Allowed: preview, copy, open, reveal in folder, download, regenerate, ask for a refinement, inspect raw source/log/manifest.
- Not allowed: editing source in the preview and treating that frontend state as the saved artifact.
- A follow-up request creates a new run or revision. The backend/artifact filesystem remains the source of truth.

## Artifact Preview Modes

| Intent | Primary Preview | Required Affordances |
| --- | --- | --- |
| `code_homework` | syntax-highlighted code or notebook-like preview | file tabs, copy button, line/gutter treatment when useful, run/status output area, validation/error card, raw file access |
| `essay_latex` | rendered PDF or PDF-like page preview | page navigation/count, compile status, open/reveal PDF, inspect `.tex` and logs |
| `beamer_slides` | slide/deck preview from PDF pages | slide thumbnails or position indicator, open/reveal PDF, inspect `.tex` and logs |
| `cheat_sheet` | dense A4 PDF-like page preview | target page count visibility, zoom/fit affordance, open/reveal PDF, inspect source/logs |

Fallback order for PDF-producing artifacts:

1. Render generated PDF pages in-app when available.
2. Show PDF-like page preview from available metadata/source while running.
3. If rendering fails, show a clear preview error and keep file/source/log affordances visible.

Raw LaTeX is an advanced inspection view, not the default preview for essay, slides, or cheat-sheet artifacts.

Current implementation assessment from 2026-06-05: true PDF page rendering is moderate engineering difficulty. The Vite frontend currently has no PDF renderer dependency and no authenticated artifact-byte endpoint. A safe implementation should first add artifact access, then render PDFs through PDF.js display APIs or an equivalent safe blob/canvas renderer with correct worker/static asset handling.

## Run Status Presentation

The workbench may consume canonical backend stage values such as `queued`, `compose`, `route`, `context`, `generate`, `validate`, and `manifest`, but it must not present them as an unexplained row of bare technical words.

- Stage status must have a visible label or structure that makes it read as progress/status, not as unlabeled navigation.
- User-facing stage names must come from the locale catalog and use human-readable copy in English, Simplified Chinese, and Traditional Chinese.
- Canonical stage identifiers may appear as secondary technical detail, but the primary label should explain the work being performed.
- If a stage item is clickable, it must reveal a real detail panel, log excerpt, or status explanation. If it is not interactive, it must not use visual treatment that implies tabs or buttons.
- Status labels such as `Idle`, `Ready`, and `Running` must be visually grouped with their meaning and localized; they must not float near unrelated stages in a way that suggests a broken control strip.
- Idle, ready, succeeded, failed, and cancelled indicators must be static. Only active queued/running generation may use looping spinner or progress motion.
- Long-running queued/running generation should show an approximate comfort progress bar where the composer/run note would otherwise say that a task brief is required. The progress bar must match the warm editorial visual system and must not claim exact provider, token, or compile percentage unless such progress is truly measured.

## Preview Tabs And File Views

Preview tabs or file-view controls such as Code, Source, Logs, and Manifest must never be silent no-ops.

- Selecting an enabled tab must visibly change the preview surface.
- Before generated files exist, each enabled tab must show useful purpose-specific placeholder content, a short demo/skeleton, or a running-state message that matches the selected artifact type.
- A tab with no possible content for the current artifact/run state may be disabled, but the disabled state must be visually clear and explainable through tooltip or accessible description.
- Manifest views should show a compact manifest skeleton or metadata summary before real `manifest.json` content is available.
- Logs views should show pending/run log state before logs exist, and real sanitized logs or a clear empty-log message after a run.
- Source/code views should show generated content when available; otherwise they should show a demo snippet, expected output description, or waiting state rather than leaving the old panel unchanged.
- After a run succeeds, enabled primary/source/log/manifest views must read real generated files through the artifact access API. Static demo code or skeleton PDF pages must not remain the apparent output when the corresponding artifact exists.

## Visual Direction

- Polished, modern, and artifact-focused rather than generic SaaS dashboard.
- Workbench composition may feel like a creative editor, browser IDE, or academic document studio, but the first action remains generation from a prompt.
- The product should feel warm, elegant, and scholarly rather than sci-fi. Use warm graphite and ink surfaces, parchment/ivory preview pages, clay/terracotta as the primary chromatic accent, and sage/amber/coral for secondary state.
- Serif typography must be visible in the product voice. Use it for brand, pane titles, preview titles, empty states, and artifact-adjacent explanatory prose. Use sans-serif for compact controls and monospace for code, file paths, run stages, model IDs, and numeric context details.
- Avoid default chat bubbles as the main visual language; use cards/rows sparingly for command history, stage status, and revision boundaries.
- Use real product-state surfaces: code, pages, slides, file tabs, terminal-like output, run stages, context budget.
- Avoid text-heavy explanations of how the app works inside the UI.
- Do not copy Claude/Anthropic or any other product's proprietary typefaces, assets, iconography, exact color values as a brand system, or distinctive composition. Use references only for broad qualities such as warmth, restraint, and editorial tone.

## Localization And Copy

The workbench must support:

| Locale | Purpose |
| --- | --- |
| `en` | English UI copy |
| `zh-Hans` | Simplified Chinese UI copy |
| `zh-Hant` | Traditional Chinese UI copy |

Rules:

- User-facing UI strings belong in a locale catalog or equivalent localization boundary. Avoid hard-coded strings in redesigned view components.
- API enum values, route names, artifact filenames, metadata keys, model IDs, error machine codes, and stored run statuses remain canonical and untranslated.
- Chinese copy must be serious written language, not casual chat slang.
- Prefer concise labels for controls, tabs, segmented buttons, chips, and colored state blocks. Put longer explanations in secondary text or tooltips.
- At 100% browser zoom, English, Simplified Chinese, and Traditional Chinese strings must fit desktop and narrow layouts without overflow, clipping, or incoherent wrapping.
- Use `lang` or equivalent locale markers so Chinese text can receive the correct Simplified or Traditional font fallback. Avoid font stacks that render Chinese with Japanese glyphs.

## Motion And Interaction

- Use purposeful transitions for run start, stage changes, preview hydration, preview replacement, pane focus, and revision completion.
- Animations should feel smooth and high-quality but must not block input or obscure errors.
- Respect `prefers-reduced-motion`.
- Keep dimensions stable for toolbars, file tabs, preview headers, status chips, and code gutters so content changes do not cause jarring layout shifts.

## Context Indicator

Default state:

- compact graphical dial/gauge
- no large numeric panel
- color/state communicates safe/warning/critical

Hover/focus state:

- estimated input tokens
- estimated output tokens
- estimated total tokens
- context window limit
- utilization percentage
- source: local estimate or backend estimate

## Required Controls

- Auth/register/login views for weak institutional email auth.
- Locale switch or settings control for English, Simplified Chinese, and Traditional Chinese.
- Model settings editor for base URL, model, and API key.
- Model settings editor must prefill all non-secret defaults from `model-settings.md`; the API key is the only required field that starts empty.
- Explicit artifact type control: `code_homework`, `essay_latex`, `beamer_slides`, `cheat_sheet`.
- Code output preference control for `.py` vs `.ipynb` when `code_homework` is selected.
- Search mode: `auto`, `on`, `off`.
- Upload control supporting multiple files for cheat sheets.
- Course selector/management control supporting the default context-disabled "Just Asking" course and ordinary user-created courses.
- Prompt composer with a clear run/regenerate action.
- Follow-up/refinement composer once a run exists.
- Run status display with stage-level progress.
- Output file list with reveal/open/copy affordances.

The UI may suggest an artifact type from the user's text later, but the request sent to the backend must carry an explicit canonical `intent`. There is no phase-1 `auto` artifact intent.

## API Expectations

The UI consumes:

- Auth endpoints from `auth.md`.
- Model settings endpoints from `model-settings.md`.
- Generation run endpoints/events from `generation-pipeline.md`.
- Artifact path/manifest outputs from `artifact-filesystem.md`.
- Artifact byte and metadata endpoints from `artifact-access.md`.
- Course list/selection behavior from `course-context.md`.

The UI must not:

- read local secrets directly
- read or write SQLite directly
- require backend changes for purely visual or layout work
- execute generated JavaScript, notebooks, shell commands, or arbitrary HTML in the main renderer
- display raw API keys, tokens, stack traces, or unredacted provider errors

## Error And Empty States

- The UI reads the canonical error envelope (`errors.md`) and shows `error.message`; it must never display raw API keys, tokens, or stack traces.
- `validation_error` maps `fields[*]` back to the offending inputs (e.g. highlight the missing `target_pages`).
- A `failed` run shows the failure `code`/`message` and still links any preserved source/logs.
- Empty states (no runs yet, no output yet) are deliberate preview surfaces, not blank panels.
- A preview renderer failure should be distinct from a generation failure; if files exist, the user can still open/reveal them.

## Compatibility

- Additive: new preview tabs, new read-only artifact views, new non-blocking animation states, new output file affordances, replacement frontend component structure that preserves this contract.
- Breaking (ADR required): removing the split console/preview structure, making direct editing the default phase-1 artifact model, adding generated-code execution in the renderer, or reintroducing prompt-only backend intent inference.

## Acceptance Checks

- First authenticated screen shows a production console beside a persistent artifact preview panel on desktop/Electron width.
- The workbench does not visually depend on the old frontend dashboard/chat composition.
- UI can submit a run without required uploads.
- UI can submit multiple PDFs for cheat-sheet intent.
- UI sends an explicit canonical artifact `intent` and never relies on backend prompt-only inference.
- Context dial updates from local estimate before run and backend events during run.
- Exact context numbers are hidden until hover/focus.
- Run status/stage presentation is clearly status or clearly interactive, with localized human-readable labels instead of an unexplained bare technical word strip.
- Code/Source/Logs/Manifest controls either render meaningful selected content or are visibly disabled; no enabled preview control is inert.
- Code output previews with syntax highlighting, file affordances, copy action, and status/error treatment.
- PDF-producing outputs preview as rendered/PDF-like pages when possible and keep source/log/file access visible when rendering fails.
- Succeeded output states are backed by real generated artifacts; placeholder/demo previews are limited to no-output, running, or renderer-failure states.
- Status motion is truthful: idle and completed are static; queued/running can animate and show approximate comfort progress.
- The workbench exposes the default context-disabled "Just Asking" course and ordinary course selection without making course administration the main navigation model.
- Follow-up requests create a visible revision/run history and refresh the preview without losing access to the previous output.
- A failed run surfaces a human-readable message without leaking secrets.
- Layout works at desktop and narrow widths without text overlap or incoherent pane stacking.
- English, Simplified Chinese, and Traditional Chinese UI modes are available from a locale catalog or equivalent boundary.
- At 100% zoom, desktop and narrow-width layouts do not overflow, clip, or overlap labels in artifact controls, command buttons, status chips, tabs, preview headers, auth forms, and model settings.
- Serif typography is visible in the final workbench and paired with appropriate CJK serif fallbacks for Chinese locales.

## Open Questions

- Exact PDF rendering dependency for the web renderer is still open.
- Exact syntax-highlighting/editor renderer is still open; prefer a proven lightweight dependency over a plain textarea.
