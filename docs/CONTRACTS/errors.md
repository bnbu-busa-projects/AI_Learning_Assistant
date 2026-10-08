<!--
Owner: project-maintainer
Last Reviewed: 2026-05-31
Status: Active
-->

# Contract: Canonical Error Envelope

## Purpose

Define one error shape for every backend API and run failure so clients, the Electron shell, and pipelines handle errors uniformly instead of inventing per-endpoint shapes. See `docs/DECISIONS/005-canonical-error-envelope.md`.

## Schema

Every non-2xx API response and every failed run carries this body:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ErrorEnvelope",
  "type": "object",
  "required": ["error"],
  "additionalProperties": false,
  "properties": {
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "additionalProperties": false,
      "properties": {
        "code":    { "type": "string", "description": "stable machine code from the catalog below" },
        "message": { "type": "string", "description": "human-readable, safe to surface in UI; never contains secrets" },
        "fields": {
          "type": "array",
          "description": "present for validation_error; per-field reasons",
          "items": {
            "type": "object",
            "required": ["field", "rule"],
            "properties": {
              "field": { "type": "string" },
              "rule":  { "type": "string" }
            }
          }
        },
        "details": {
          "type": "object",
          "description": "optional, non-sensitive structured context (e.g. {\"run_id\": \"...\"})"
        }
      }
    }
  }
}
```

## Examples

Validation failure:

```json
{
  "error": {
    "code": "validation_error",
    "message": "target_pages is required for cheat_sheet intent.",
    "fields": [{ "field": "options.target_pages", "rule": "required" }]
  }
}
```

Provider auth failure during a run:

```json
{
  "error": {
    "code": "provider_auth_failed",
    "message": "The model provider rejected the API key. Update it in model settings.",
    "details": { "run_id": "01H...", "stage": "generate_source" }
  }
}
```

## Code Catalog

Generic codes (map to the listed HTTP status on synchronous responses):

| Code | HTTP | Meaning |
| --- | --- | --- |
| `validation_error` | 400 | Request failed schema/business validation; `fields` SHOULD be present |
| `unauthorized` | 401 | Missing or invalid token |
| `forbidden` | 403 | Authenticated but not allowed for a future role-restricted capability |
| `not_found` | 404 | Resource id does not exist or is not owned by the caller |
| `conflict` | 409 | State conflict (e.g. duplicate email registration) |
| `rate_limited` | 429 | Too many requests |
| `internal_error` | 500 | Unexpected server fault; message is generic, details are sanitized |

Domain codes (used in API responses and/or `runs.error_message` / status events):

| Code | Typical HTTP | Meaning |
| --- | --- | --- |
| `unknown_email_domain` | 400 | Email is not `@bnbu.edu.cn` |
| `secret_storage_unavailable` | 500 | API-key encryption storage missing, invalid, or unable to decrypt; restore the server encryption key |
| `missing_api_key` | 400 | No model API key configured for the selected profile |
| `provider_auth_failed` | 502 | Provider rejected credentials |
| `provider_unavailable` | 502 | Provider/network call failed |
| `context_overflow` | 422 | Estimated context exceeds the model window after compression |
| `unsupported_intent` | 400 | Intent is not one of the four supported pipelines |
| `compile_failed` | 200 (run `failed`) | LaTeX/notebook compilation failed; source/logs are preserved |
| `search_unavailable` | 200 (run note) | Web search failed; only fatal when `search_mode = on` |
| `upload_too_large` | 413 | Upload exceeds the size limit in `uploads.md` |
| `unsupported_media_type` | 415 | Upload type is not accepted |

## Validation Rules

- `code` MUST be from this catalog. Adding a code is a contract change (update this file in the same task).
- `message` MUST be safe for display: no API keys, tokens, raw prompts, stack traces, or absolute host paths.
- `validation_error` SHOULD include `fields`; each `rule` is a short token (`required`, `too_long`, `enum`, `pattern`).
- Run failures persist the same `code`/`message` in `runs` and surface it in the status event (`generation-pipeline.md`), even when the HTTP request that started the run already returned 202.

## Compatibility

- Additive only without a version bump: new optional `details` keys, new catalog codes.
- Breaking (requires an ADR): renaming `error`/`code`/`message`, changing the envelope nesting, removing a code that clients branch on.

## Versioning

- The envelope is unversioned but stable; the API itself is versioned by path (`/api`). A breaking envelope change ships behind a new path prefix and a migration note.

## Open Questions

- Whether to include a machine-readable `retryable: true/false` hint for transient provider/search failures.
