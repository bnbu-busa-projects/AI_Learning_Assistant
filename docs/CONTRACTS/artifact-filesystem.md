<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: Artifact Filesystem

## Purpose

Generated work must be visible, portable, and inspectable as normal files.

## Root

First-phase default:

```text
workspace/
```

Future tasks may introduce a user-selectable project root. Any root must be mounted into Docker and accessible from Electron.

## Run Folder Shape

```text
workspace/
  <safe-user-or-local>/
    <safe-project-title>/
      context/
        course_context.md
      runs/
        <run-id>/
          input/
            task.md
            uploads/
          output/
            main.html
            main.pdf
            solution.py
            solution.ipynb
            slides.html
            slides.pdf
            cheat-sheet.html
            cheat-sheet.pdf
          logs/
            generation.log
            convert.log
          manifest.json
```

Only files relevant to a run need to exist.

`context/course_context.md` exists only for non-default course containers that have compact course context. The default "Just Asking" course must not contribute context and does not need this file.

## `manifest.json`

```json
{
  "schema_version": 1,
  "run_id": "01H...",
  "revision_of_run_id": null,
  "intent": "essay_latex",
  "created_at": "2026-05-31T00:00:00Z",
  "model": {
    "provider": "openai_compatible",
    "model": "qwen-plus"
  },
  "search": {
    "mode": "auto",
    "used": true,
    "citations": [
      {"title": "Source title", "url": "https://example.com"}
    ]
  },
  "inputs": [
    {"path": "input/task.md", "kind": "task"},
    {"path": "input/uploads/reference.pdf", "kind": "upload"}
  ],
  "outputs": [
    {"path": "output/main.html", "kind": "source"},
    {"path": "output/main.pdf", "kind": "pdf"}
  ],
  "timings": {
    "total_ms": 45210,
    "stages": [
      {"name": "generate_source", "duration_ms": 39200},
      {"name": "compile_pdf", "duration_ms": 4100}
    ]
  },
  "status": "succeeded"
}
```

`timings` is optional and additive. When present, it is approximate wall-clock instrumentation for local QA and user-facing diagnostics, not a billing or provider-token accounting source.

## Filename Rules

- Sanitize path segments.
- Preserve original upload extension when safe.
- Avoid overwriting by using run-specific folders.
- Revision runs always create a new run-specific folder and may reference the prior run id in `manifest.json`; they never overwrite previous output.
- Never write outside the configured root.
- Keep `.html` source even if PDF conversion fails.

## Artifact Kinds

| Intent | Required Output | Optional Output |
| --- | --- | --- |
| `code_homework` | `.py` or `.ipynb` | README, tests |
| `essay_latex` | `main.html` | `main.pdf`, references |
| `beamer_slides` | `slides.html` | `slides.pdf`, speaker notes |
| `cheat_sheet` | `cheat-sheet.html` | `cheat-sheet.pdf`, extraction notes |

Course context files are not run artifacts and are not listed in `manifest.outputs`. If a run used course context, the manifest may include an additive metadata key such as `context.course_id` or `context.used_course_context`.

## Errors

Filesystem failures are surfaced through the run, not as a separate transport. Uses the canonical envelope (`errors.md`):

- A path-traversal or unsafe-segment attempt is refused and the run fails with `internal_error` (sanitized message; never echoes the offending absolute path).
- A `convert_failed` run still writes `output/*.html` and `logs/convert.log`, plus a `manifest.json` with `status: failed`.

## Validation Rules

- All writes stay within the configured workspace root; `..` and absolute segments are rejected.
- `manifest.json` is written last for a succeeded run so its presence implies completeness.
- Every path listed in `manifest.json` `inputs`/`outputs` exists on disk when `status` is `succeeded`.

## Compatibility

- Additive: new optional `manifest.json` keys, new artifact `kind` values, new optional output files.
- Breaking (ADR required): bumping `schema_version`, renaming the `input/`/`output/`/`logs/` layout, or changing the run-folder path scheme.

## Versioning

- `manifest.json` carries `schema_version` (currently `1`). Readers must tolerate unknown additive keys.

## Acceptance Checks

- Every succeeded run has `manifest.json`.
- Failed conversion runs still keep HTML source and logs.
- Electron can reveal the run folder in the host filesystem.
- SQLite artifact rows point to files that exist.
- Course context Markdown, when present, stays under the owning course/project folder and is not stored in SQLite as large text.

## Open Questions

- Whether to support a user-selectable project root in phase 1 or keep `workspace/` fixed until the desktop shell lands.
