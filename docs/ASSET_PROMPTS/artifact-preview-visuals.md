# Asset: artifact-preview-{code,essay,slides,cheat-sheet}.png

## Purpose

Preview placeholders for the four artifact modes before real generated files are available. They should look like inspectable academic outputs inside the right-side artifact panel, not marketing cards.

## Prompt

Create four coherent preview images for an academic AI artifact studio, each showing a realistic generated output surface inside a persistent artifact preview panel. Use the same camera angle, lighting, and visual system across all four. The system is warm, elegant, and editorial: warm graphite shell, parchment/ivory paper, clay/terracotta accents, muted sage support, restrained amber/coral states, and serif-like title areas without readable text. `code` shows a compact Python/notebook workspace with multicolor syntax blocks, file tabs, a copy affordance, and a small terminal/status strip. `essay` shows a rendered LaTeX report/PDF page with section structure and bibliography hints. `slides` shows a Beamer slide stack with a title slide and dense diagram slide. `cheat-sheet` shows an A4 dense multi-column study sheet with formulas, tables, compact diagrams, and visible page scale. Use fictional unreadable microtext only; no real course content, no private data, no university branding. The previews should be crisp, product-state-oriented, and usable inside a workbench preview panel.

## Constraints

- 1600 x 1000 px per artifact type
- opaque background
- same layout family and lighting across all four previews
- content should be plausible but not readable enough to imply real private material
- do not include readable UI labels because real UI copy must localize to English, Simplified Chinese, and Traditional Chinese
- include file/source cues through shapes and layout, not visible explanatory text
- forbidden motifs: stock students, campus photos, admin dashboards, generic charts, sci-fi glow, real assignments, real logos

## Output

- target paths:
  - `frontend/src/assets/previews/artifact-preview-code.png`
  - `frontend/src/assets/previews/artifact-preview-essay.png`
  - `frontend/src/assets/previews/artifact-preview-slides.png`
  - `frontend/src/assets/previews/artifact-preview-cheat-sheet.png`
- target format: PNG
