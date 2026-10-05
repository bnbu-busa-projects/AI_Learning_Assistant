<!--
Owner: project-maintainer
Last Reviewed: 2026-05-31
Status: Active
-->

# Contract: Upload Ingestion

## Purpose

Define how user-supplied input files enter the system before a run. Uploads are first-class inputs (especially many slide PDFs for cheat sheets), are stored on disk, and are referenced by `upload_ids` in the generation request (`generation-pipeline.md`).

## API Surface

### `POST /api/uploads`

Multipart form upload of one or more files. Requires `Authorization: Bearer <token>`.

- Form field: `files` (repeatable).
- Each accepted file is written to the artifact filesystem and recorded in the `uploads` table (`sqlite-schema.md`).
- Upload metadata is owner-scoped; API-created upload rows record the authenticated `user_id`.

Response (`201`):

```json
{
  "uploads": [
    {
      "id": "upl_01H...",
      "original_name": "lecture-03.pdf",
      "media_type": "application/pdf",
      "size_bytes": 184320,
      "sha256": "9f2c...",
      "created_at": "2026-05-31T04:00:00Z"
    }
  ]
}
```

### `GET /api/uploads/{id}`

Returns the upload metadata (never the bytes) for the authenticated owner.

## Accepted Inputs

| Category | Media types / extensions | First-class use |
| --- | --- | --- |
| Plain text | `text/plain`, `.txt`, `.md` | task/reference text |
| Source code | `.py`, `text/x-python` | reference code for `code_homework` |
| Notebook | `.ipynb` (`application/json`) | reference notebook |
| PDF | `application/pdf`, `.pdf` | reference material, cheat-sheet slide decks |

OCR of scanned/image-only PDFs is out of scope in phase 1; such files are accepted but may yield empty extracted text (recorded as an extraction note).

## Limits

| Limit | Value | Rationale |
| --- | --- | --- |
| Max single file size | 25 MB | slide decks are large but bounded |
| Max files per request | 40 | supports multi-deck cheat sheets |
| Max total request size | 200 MB | protects the local container |

Limits are configurable but these are the phase-1 defaults; values live in backend config, not hard-coded at call sites.

## Validation Rules

- Reject unknown media types with `unsupported_media_type` (`errors.md`).
- Reject oversized files with `upload_too_large`.
- Sanitize `original_name` before writing; never write outside the configured workspace root (`artifact-filesystem.md`).
- Compute and store `sha256` for dedupe/audit; identical bytes may reuse a stored file.
- Detect `media_type` from content where feasible, not from the client-provided name alone.

## Errors

Uses the canonical envelope (`errors.md`). Failure cases:

- `unauthorized` -- missing/invalid token.
- `validation_error` -- no files provided, or `files` field missing.
- `unsupported_media_type` -- a file type is not in the accepted table.
- `upload_too_large` -- a file or the request exceeds the limits above.

## Compatibility

- Additive: new accepted media types, new optional response fields.
- Breaking (ADR required): removing an accepted type, changing the `upload_ids` reference shape consumed by `generation-pipeline.md`.

## Versioning

- Versioned with the rest of the API under `/api`. The stored-file layout follows `artifact-filesystem.md` (`input/uploads/`).

## Acceptance Checks

- A teacher can upload a single `.md` and receive an `id`.
- A teacher can upload multiple PDFs in one request for cheat-sheet intent.
- An unsupported type is rejected with `unsupported_media_type`.
- Upload metadata is retrievable; raw bytes are never returned by the API.

## Open Questions

- Whether uploads should expire/garbage-collect when no run references them after a retention window.
