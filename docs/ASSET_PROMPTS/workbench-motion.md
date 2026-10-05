# Asset: preview-hydration.json and revision-swap.json

## Purpose

Reusable motion briefs for the conversational artifact workbench. Motion should make generation and refinement feel smooth without becoming decorative or blocking. Prefer CSS/Web Animations for ordinary transitions; use these assets only when a reusable motion file is genuinely helpful.

## Prompt

Create two subtle UI motion assets for a warm editorial academic AI artifact workbench.

`preview-hydration` shows a right-side artifact preview panel moving from skeleton state into rendered content: code lines gain syntax color, paper pages sharpen, and a small status strip settles into a complete state.

`revision-swap` shows a generated artifact updating after a follow-up instruction: the previous preview compresses slightly into history while the new preview slides into focus, preserving the sense that revisions are deliberate runs rather than direct editing.

Use a restrained warm graphite, parchment, clay/terracotta, sage, amber, and coral palette. The motion should feel premium, precise, scholarly, and tool-like. No mascots, no floating blobs, no confetti, no sci-fi glow, no readable course content, no university branding.

## Constraints

- target format: Lottie JSON or equivalent lightweight motion format
- duration: 700-1200 ms each
- loop: false, except a reduced idle segment may loop for running state if implementation needs it
- must have a reduced-motion fallback in code
- must not change layout dimensions or hide errors/actions
- forbidden motifs: celebratory confetti, abstract orb animations, fake marketing charts, neon/cyberpunk trails, real assignment text, real logos

## Output

- target paths:
  - `frontend/src/assets/motion/preview-hydration.json`
  - `frontend/src/assets/motion/revision-swap.json`
- target format: JSON motion asset
