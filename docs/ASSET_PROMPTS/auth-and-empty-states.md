# Asset: auth-entry-preview.png and empty-workbench-preview.png

## Purpose

Optional preview images for states before the user is fully inside a generated artifact: unauthenticated entry and empty workbench preview. They should support the warm editorial system without becoming marketing hero art.

## Prompt

`auth-entry-preview` shows an elegant split workbench silhouette in the background: production console on the left, artifact preview panel on the right, softly defocused and inactive. It leaves clear space where the real login/register form can be rendered by the frontend. The mood is secure, scholarly, calm, and warm.

`empty-workbench-preview` shows a ready right-side artifact preview panel before any generation run: faint stacked paper pages, subtle code/document tab rhythm, a small inactive status strip, and room for real UI copy to be rendered on top. It should feel like a prepared workspace, not a marketing illustration.

Use warm graphite, ink black, parchment/ivory, clay/terracotta, muted sage, subtle paper grain, and soft shadows. Use no readable text; real UI copy must be rendered by the frontend for English, Simplified Chinese, and Traditional Chinese.

## Constraints

- 1600 x 1000 px per asset
- opaque background
- warm editorial style, not sci-fi or generic SaaS
- no readable text, logos, stock people, campus imagery, confetti, generic AI waves, neon, or gradient orbs
- leave safe space for localized frontend text

## Output

- target paths:
  - `frontend/src/assets/previews/auth-entry-preview.png`
  - `frontend/src/assets/previews/empty-workbench-preview.png`
- target format: PNG
