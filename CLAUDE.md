@AGENTS.md

# Claude Code Adapter

Follow `AGENTS.md` as the canonical project instruction source.

When reviewing or implementing, pay special attention to:

- The product uses HTML-native artifact generation with Playwright HTML-to-PDF.
  There is no LaTeX dependency. See `docs/DECISIONS/009-html-native-artifact-generation.md`.
- Whether changes preserve the Docker + browser development surface and Electron
  packaging target.
- Whether local auth and API key storage can later be replaced by stronger equivalents.
- Whether generated artifacts remain portable filesystem outputs, not trapped in
  the database.
- Whether frontend changes preserve the split production-console + artifact-preview
  workbench and keep generated artifacts preview-only.
- Whether generated HTML is self-contained (inline CSS, no external resources) for
  reliable Playwright PDF conversion.
