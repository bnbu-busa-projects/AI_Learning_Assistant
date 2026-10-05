<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: Artifact Access API

## Purpose

Let the authenticated workbench preview real generated artifacts without reading SQLite directly or dereferencing absolute host paths in the browser.

The artifact filesystem remains the source of truth for bytes. SQLite remains the metadata index. This API is a safe read boundary between those stores and frontend preview renderers.

## API Surface

### `GET /api/runs/{run_id}/artifacts`

Returns artifact metadata for a run owned by the authenticated user.

Response (`200`):

```json
{
  "run_id": "run-1",
  "status": "succeeded",
  "manifest": {
    "schema_version": 1,
    "run_id": "run-1",
    "intent": "essay_latex",
    "outputs": [{"path": "output/main.pdf", "kind": "pdf"}],
    "status": "succeeded"
  },
  "artifacts": [
    {
      "path": "output/main.pdf",
      "kind": "pdf",
      "media_type": "application/pdf",
      "size_bytes": 184320,
      "url": "/api/runs/run-1/artifacts/files/output/main.pdf"
    }
  ]
}
```

`manifest` may be absent or partial for failed/older runs where no manifest exists. `artifacts` should be built from SQLite artifact rows and/or the manifest outputs, but every returned `path` must be relative to the run folder.

### `GET /api/runs/{run_id}/artifacts/files/{relative_path:path}`

Streams one generated artifact file owned by the authenticated run owner.

Rules:

- `relative_path` must be relative to the run folder and must match a path recorded in `manifest.outputs`, `manifest.inputs`, or SQLite artifact rows.
- The resolved file must stay inside the run folder.
- PDF files are returned as `application/pdf` and may use `Content-Disposition: inline`.
- Text files are returned as UTF-8 text where feasible.
- Large generated files may be streamed; the endpoint must not load arbitrary unbounded files into memory.

## Security Rules

- Requires `Authorization: Bearer <token>`.
- A caller can access only artifacts from runs they own.
- Do not expose raw API keys, authorization tokens, raw provider errors, stack traces, or unrelated host paths.
- Do not serve arbitrary workspace files. Only files recorded for the run are eligible.
- Do not add unauthenticated static serving for generated workspaces.

## Errors

Uses the canonical envelope (`errors.md`):

| Scenario | HTTP | Code |
| --- | --- | --- |
| Missing/invalid token | 401 | `unauthorized` |
| Run not found or not owned | 404 | `not_found` |
| Relative path is missing, unsafe, or not recorded for the run | 404 | `not_found` |
| Recorded file no longer exists | 404 | `not_found` |
| Unexpected filesystem failure | 500 | `internal_error` |

## Validation Rules

- Reject absolute paths, `..`, empty path segments that escape the run root, and URL-decoded equivalents.
- Verify ownership before path resolution.
- Verify the final resolved path is under the run folder.
- Return relative paths and API URLs in metadata; absolute `output_root` may remain on run responses for reveal/copy affordances but is not the preview transport.

## Compatibility

- Additive: new metadata fields, new artifact kinds, cache headers, range-request support, thumbnail/page endpoints.
- Breaking (ADR required): unauthenticated artifact access, changing the path from run-relative to host-absolute, or removing the metadata endpoint.

## Versioning

The endpoint is versioned with the existing `/api` surface. `manifest.schema_version` remains governed by `artifact-filesystem.md`.

## Acceptance Checks

- An authenticated owner can list artifact metadata for a succeeded run.
- The owner can fetch generated source, logs, manifest, and PDF bytes through run-relative paths.
- Another authenticated user receives `not_found` for the same run/artifact.
- Path traversal attempts are rejected and do not reveal whether host files exist.
- The frontend can render code/source/log/manifest content without reading absolute host paths.

## Open Questions

- Whether to add HTTP range support for large PDFs in phase 1 or defer until PDF preview performance needs it.
