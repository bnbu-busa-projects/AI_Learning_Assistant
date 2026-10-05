<!--
Owner: project-maintainer
Last Reviewed: 2026-06-01
Status: Active
-->

# Contract: Visual Assets And Product Aesthetic

## Purpose

Prevent the rebuilt UI from drifting into a generic SaaS dashboard. The product should feel like a refined consumer artifact studio for academic work: calm, precise, premium, visually memorable, and clearly built around a conversation-plus-preview workbench.

## Asset Locations

```text
frontend/src/assets/
  brand/
  icons/
  motion/
  textures/
  previews/
docs/ASSET_PROMPTS/
  README.md
  <asset-name>.md
```

Generated bitmap assets belong in `frontend/src/assets/` when they are part of the product UI. Prompts, generation notes, and source references belong in `docs/ASSET_PROMPTS/`.

## Naming Rules

Use lowercase kebab-case names:

```text
artifact-studio-hero.png
context-budget-dial-idle.png
context-budget-dial-warning.png
latex-preview-paper-texture.png
pipeline-stage-code.svg
pipeline-stage-latex.svg
run-status-orbit.json
preview-hydration.json
revision-swap.json
```

Asset names should describe product meaning, not generation technique.

## Visual System

- UI should be premium and consumer-grade, not admin-heavy.
- The visual language is warm editorial artifact studio: warm graphite/ink shell, parchment/ivory preview surfaces, clay/terracotta primary accent, sage/olive secondary support, amber warning, coral failure.
- The product may be inspired by warm literary AI interfaces, including Claude-like restraint and serif warmth, but must not copy proprietary brand assets, proprietary typefaces, exact brand color systems, or distinctive layouts.
- Serif typography is part of the product identity. Generated visual references should leave room for serif headings and CJK serif fallbacks in the UI rather than baking readable text into images.
- Avoid one-note dark blue/slate SaaS styling.
- Avoid neon, glow-heavy, cyberpunk, blue-purple sci-fi, and generic dashboard styling.
- Use restrained but distinctive color contrast across surfaces, controls, previews, and status.
- Use visual assets to reveal the actual product state: documents, code, slides, context budget, run status, output files.
- Preview assets should look like actual artifact surfaces: syntax-highlighted code, notebook cells, rendered pages, Beamer decks, and dense A4 sheets.
- Do not use decorative gradient blobs, vague abstract background art, generic AI waves, stock classroom photos, or giant marketing hero sections as the primary experience.
- Keep cards limited to tools, repeated items, modals, or previews. Do not nest cards inside cards.
- Motion should support workbench state changes: generating, preview hydration, compile/validation failure, and revision replacement. It should not become ambient decoration.
- Existing frontend visual assets, placeholder cards, style tokens, and layout motifs are not protected. Replace them when they do not match this visual system.

## Typography In Assets

- Asset prompts should assume UI text is rendered by the frontend, not embedded in images.
- If an image needs pseudo-text, use fictional unreadable microtext or blurred glyph texture only.
- Leave safe whitespace for localized UI labels in English, Simplified Chinese, and Traditional Chinese.
- Do not include real assignment text, real course material, university marks, student names, or readable private content.

## Preview Surfaces

- Code previews use dark editor-like surfaces with multicolor syntax, file tabs, stable gutters, copy affordances, and terminal/status accents.
- PDF previews use warm paper surfaces, visible pagination, shadows/bounds that reveal page scale, and fallback states that preserve open/reveal/source access.
- Slides previews communicate deck structure through page thumbnails, slide position, or stacked-page composition.
- Cheat-sheet previews communicate A4 density and target page count without using real course material.
- Placeholder previews should be believable product states, not generic illustrations.

## Motion Rules

- Use CSS transitions for common interactions and named motion assets only for reusable generation/preview states.
- Respect `prefers-reduced-motion`.
- Motion files must have prompt/brief notes under `docs/ASSET_PROMPTS/` when they are nontrivial assets.
- Loading or transition motion must never hide errors, block copy/reveal actions, or make layout dimensions unstable.
- Prefer CSS transitions and Web Animations for common UI motion. Use Lottie/Rive/JSON motion assets only for reusable, product-state-specific sequences such as preview hydration, revision swap, or stage progress.
- Motion should last roughly 700-1200 ms for major state transitions and should not loop unless representing an active running state.

## Context Dial

The context budget indicator is a signature visual element.

Default state:

- graphical dial, ring, or compact gauge
- no large numeric panel
- color/status conveys `ok`, `warning`, or `critical`

Hover/focus state:

- show exact estimated input, output, total, limit, utilization, warning level, and source
- do not resize surrounding layout

## Asset Prompt Format

Each generated asset prompt file should include:

```markdown
# Asset: <filename>

## Purpose
<where it appears and what it communicates>

## Prompt
<prompt to use in the image/video/motion generation tool>

## Constraints
- size/aspect ratio
- transparent or opaque background
- color/style notes
- forbidden motifs

## Output
- target path
- target format
```

## Visual QA

Before a UI task is complete:

- build must pass
- desktop and mobile-width layouts must avoid text overlap
- context dial hover/focus must reveal numbers without moving layout
- uploaded/generated preview areas must show real product state or deliberate placeholders
- code preview states must show syntax-highlighted or deliberately skeletonized code, never an unstyled textarea as the final state
- PDF-like preview states must preserve page geometry and not collapse into a plain file list

## Compatibility

- Additive: new named assets, new state variants, new prompt briefs, new non-blocking motion assets.
- Breaking (review required): renaming an asset already referenced in code, or changing the context-dial state vocabulary (`ok`/`warning`/`critical`), which must stay aligned with `generation-pipeline.md`.

## Acceptance Checks

- Every committed nontrivial generated asset has a matching prompt note.
- Prompt notes under `docs/ASSET_PROMPTS/` list expected manually generated bitmap assets, filenames, target paths, and constraints.
- Workbench UI uses the visual system instead of default dashboard composition.
- Context dial states are visually distinct and contract-compatible.
- Asset names are stable and meaningful.
- Artifact preview surfaces look like generated work product rather than marketing artwork.
- The shipped workbench appearance is recognizably rebuilt around the visual system, not a light restyle of the old frontend.
- Visual assets do not contain readable UI copy that would block English/Simplified Chinese/Traditional Chinese localization.

## Open Questions

- Whether motion assets (`.json`/Lottie/Rive) are in phase-1 scope or deferred until the static visual system is validated.
