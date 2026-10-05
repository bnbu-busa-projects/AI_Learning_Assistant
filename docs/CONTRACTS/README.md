<!--
Owner: project-maintainer
Last Reviewed: 2026-06-10
Status: Active
-->

![AI Learning Assistant — Production Console](../../Preview.png)

# Contracts Index

Stable interfaces that implementation agents must preserve during the rebuild. Update each file in the same task as the implementation it covers. Legacy code is useful evidence but is not authoritative when it conflicts with these files.

| Contract | File | Owner | Consumers | Status |
| --- | --- | --- | --- | --- |
| Canonical error envelope | `errors.md` | project-maintainer | all API clients, Electron shell, pipelines | Active |
| Auth and identity | `auth.md` | project-maintainer | web UI, Electron, protected APIs | Active |
| Model settings | `model-settings.md` | project-maintainer | settings UI, model provider, pipelines | Active |
| Upload ingestion | `uploads.md` | project-maintainer | web UI, context builder, pipelines | Active |
| SQLite schema | `sqlite-schema.md` | project-maintainer | storage layer, run service | Active |
| Artifact filesystem | `artifact-filesystem.md` | project-maintainer | artifact writer, Electron reveal, pipelines | Active |
| Artifact access API | `artifact-access.md` | project-maintainer | web UI, preview renderers, backend API | Active; authenticated generated-file metadata and bytes |
| Generation pipeline | `generation-pipeline.md` | project-maintainer | run API, context builder, pipelines, UI | Active |
| Course context | `course-context.md` | project-maintainer | web UI, run API, context builder, SQLite storage | Active; optional course memory with context-disabled default course |
| Electron + Docker runtime | `runtime-electron-docker.md` | project-maintainer | Electron shell, compose, launchers | Active |
| UI workbench | `ui-workbench.md` | project-maintainer | web frontend | Active; split production console plus artifact preview; old frontend appearance is disposable |
| Visual assets | `visual-assets.md` | project-maintainer | web frontend, asset prompts | Active; preview-first visual/motion system; replace legacy visual assets as needed |

## Contract Rules

- Any change to a file here requires a matching code change and test update in the same task.
- Treat every change as breaking unless it is explicitly additive under the file's `## Compatibility` section.
- Breaking changes require an ADR under `docs/DECISIONS/` and a migration note.
- Every API error response and run failure uses the envelope in `errors.md`.
- Run `scripts/check-governance.sh` before push to detect contract/code drift.

## Adding A New Contract

1. Copy the section shape used by the closest existing contract.
2. Fill the required sections: Purpose, Schema/API Surface, Examples, Errors, Validation Rules, Compatibility, Versioning, Acceptance Checks, Open Questions.
3. Add a row to the index above.
4. Reference the new contract from `docs/ARCH.md` (`## Interfaces` or the module table).

## Open Contract Questions

- Whether the model provider needs a public contract beyond `model-settings.md` once a second provider type is introduced.
