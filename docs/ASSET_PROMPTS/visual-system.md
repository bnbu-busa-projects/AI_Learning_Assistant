# Visual System: Artifact Studio

## Purpose

This file gives implementation tasks a stable visual system before the workbench rebuild. Use it with `frontend/src/design-tokens.css` and the prompt briefs in this folder.

## Product Feel

The app is a focused artifact studio for academic work. It should feel tactile, precise, calm, and editorial: closer to a premium code editor plus a scholarly document studio than a course dashboard. The first screen should show usable creation controls, context state, and output previews, not a marketing hero.

The layout vocabulary is a conversational production console beside a persistent artifact preview panel. The console should feel like a place where the user gives generation/refinement commands and watches stages progress; the preview should feel like the current work product.

The current frontend appearance is not a design dependency. Replace old surfaces, placeholder previews, colors, component shapes, and layout decisions when they conflict with this system.

The system may be inspired by the warmth and restraint of Claude-like AI interfaces, but it must remain original. Do not copy Anthropic/Claude proprietary fonts, exact palette, icons, brand assets, or page composition.

## Palette

Use the CSS variables in `frontend/src/design-tokens.css` as the source of truth.

- Base: warm charcoal, graphite, and ink-black surfaces, not default slate-blue dashboard panels.
- Text: soft ivory for primary text, warm gray/sage for secondary text, and muted graphite for paper-surface text.
- Product accents: clay/terracotta for primary actions and selected artifact identity; sage/olive for calm secondary state; amber for warning; coral for critical/failure; restrained blue only for focus or text selection.
- Paper/code contrast: parchment or ivory paper for essay/PDF previews, warm dark editor surfaces for code and notebook previews.

Avoid single-hue palettes. A screen should never read as all blue, all purple, all beige, or all dark slate.

## Typography

- Serif: Source Serif 4, Newsreader, Georgia, or equivalent open/system serif for brand, pane titles, preview titles, empty states, and artifact-adjacent prose.
- CJK serif: Noto Serif SC/TC, Source Han Serif, Songti SC, PMingLiU, or equivalent locale-appropriate fallback for Simplified and Traditional Chinese.
- Sans: Inter or equivalent humanist/system sans for compact interface copy.
- Mono: JetBrains Mono for tokens, file paths, model ids, run stages, and code affordances.
- Keep labels compact and tool-like. Avoid large explanatory panels inside the app.
- Avoid support-chat language and marketing hero copy. Let controls, status, previews, and file affordances carry the experience.
- Do not use viewport-scaled type. Keep letter spacing at `0` except tiny uppercase metadata labels where existing UI requires it.
- UI copy must support English, Simplified Chinese (`zh-Hans`), and Traditional Chinese (`zh-Hant`). Chinese copy should be formal written language and fit controls at 100% zoom without overflow.

## Spacing And Shape

- Use 8px as the primary spacing rhythm.
- Cards and framed tools should use 6px or 8px radius by default; 12px is reserved for larger preview panes or modals.
- Do not nest cards inside cards.
- Keep controls dense enough for repeated work: segmented controls, icon buttons, menus, toggles, and compact file rows over decorative panels.

## Context Dial

The context dial is a signature product element.

- State vocabulary is fixed: `ok`, `warning`, `critical`.
- Geometry stays stable across states; color and intensity change.
- Default view is a compact dial/gauge with no large numeric table.
- Hover/focus reveals exact estimated input, output, total, limit, utilization, warning level, and source without resizing the layout.
- Use `--context-ok`, `--context-warning`, and `--context-critical`.

## Named Assets

- `textures/workbench-background-texture.png`
- `motion/preview-hydration.json`
- `motion/revision-swap.json`
- `previews/context-budget-dial-ok.png`
- `previews/context-budget-dial-warning.png`
- `previews/context-budget-dial-critical.png`
- `previews/artifact-preview-code.png`
- `previews/artifact-preview-essay.png`
- `previews/artifact-preview-slides.png`
- `previews/artifact-preview-cheat-sheet.png`
- `previews/auth-entry-preview.png`
- `previews/empty-workbench-preview.png`

## Artifact Preview Treatment

- Code: dark editor-like surface, multicolor syntax, file tabs, copy affordance, compact terminal/status strip, optional line gutter.
- Notebook: cell grouping and output blocks, but still read-only.
- Essay PDF: warm paper page with pagination and compile status.
- Beamer slides: visible slide stack or thumbnail rhythm, not a raw `.tex` default.
- Cheat sheet: dense A4 page geometry, clear target page count, zoom/fit affordance.
- Failed preview: preserve artifact access and show a distinct preview-rendering error separate from generation failure.

## Asset Discipline

- Prompt notes live in `docs/ASSET_PROMPTS/`.
- Generated UI assets live in `frontend/src/assets/`.
- Do not include private course materials, real student names, real university marks, API keys, or paid asset credentials.
- Prefer UI-native CSS/SVG/canvas for simple icons and state diagrams; use bitmap generation for textures, rich previews, and visual references.
