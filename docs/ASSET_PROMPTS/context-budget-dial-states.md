# Asset: context-budget-dial-{ok,warning,critical}.png

## Purpose

State references for the compact context budget dial. These images guide the visual language for `ok`, `warning`, and `critical`; the final implementation may build the dial in CSS/SVG/canvas using the same colors and proportions.

## Prompt

Create three compact gauge/dial visuals for an AI artifact studio context budget indicator. Each dial should be a precise circular instrument, like a tiny drafting compass crossed with a token meter. Use clean geometry, thin arcs, tiny tick marks, and a calm inner surface. The product style is warm editorial: warm graphite, ink, parchment, clay/terracotta, muted sage, amber, and coral. Make the states visually distinct without changing layout: `ok` uses muted sage/olive, `warning` uses warm amber, and `critical` uses coral red. The dial should feel premium, useful, and product-state-driven, not decorative. No numbers, no labels, no logos, no glow-heavy sci-fi treatment, no dashboard speedometer cliche.

## Constraints

- 512 x 512 px per state
- transparent background preferred
- same dial geometry for all states; only state color and intensity change
- reserve center area for future dynamic text or icon
- colors should align with the warm editorial tokens in `frontend/src/design-tokens.css`
- forbidden motifs: car speedometer, neon cyberpunk rings, gradient orbs, emoji faces, readable text

## Output

- target paths:
  - `frontend/src/assets/previews/context-budget-dial-ok.png`
  - `frontend/src/assets/previews/context-budget-dial-warning.png`
  - `frontend/src/assets/previews/context-budget-dial-critical.png`
- target format: PNG
