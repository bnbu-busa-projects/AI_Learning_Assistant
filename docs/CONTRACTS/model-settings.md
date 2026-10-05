<!--
Owner: project-maintainer
Last Reviewed: 2026-06-10
Status: Active
-->

# Contract: Model Settings

## Purpose

Allow users to bring their own Qwen/OpenAI-compatible API credentials while keeping local development credentials untracked.

The model settings experience must prefill every non-secret default needed for a first successful setup. The API key is the only field that remains empty by default.

## Model Profile

```json
{
  "id": "default-qwen",
  "display_name": "Qwen Default",
  "provider": "openai_compatible",
  "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "model": "qwen3.6-flash",
  "api_key_ref": "local-secret-reference",
  "context_window_hint": 1000000,
  "supports_streaming": true,
  "is_default": true
}
```

## Default Qwen Values

Verified on 2026-06-03 against Alibaba Cloud Model Studio OpenAI-compatible Qwen documentation and the human-confirmed release API-key region:

| Field | Default | Notes |
| --- | --- | --- |
| `provider` | `openai_compatible` | Canonical provider adapter for phase 1. |
| `base_url` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | China (Beijing) OpenAI-compatible endpoint. This matches the human-confirmed phase-1 Qwen API key region. Users with international/Singapore keys may change this to `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`. |
| `model` | `qwen3.6-flash` | Cost-efficient Qwen3.6 flash model for China-site OpenAI-compatible calls; near-flagship quality with lower output cost. |
| `context_window_hint` | `1000000` | Qwen3.6-Flash advertises a 1M-token context window in the model list. Treat this as a hint, not exact billing/accounting. |
| `supports_streaming` | `true` | The OpenAI-compatible Chat API supports streaming for current Qwen3.6 models. |
| API key | none | Never default, guess, store in tracked source, or display after save. |

Reference URLs:

- `https://www.alibabacloud.com/help/en/model-studio/use-qwen-by-calling-api`
- `https://www.alibabacloud.com/help/en/model-studio/getting-started/quick-start/`
- `https://www.alibabacloud.com/help/en/model-studio/models`

The UI and backend default-profile creation path must use these values whenever no saved local profile or untracked environment override exists. A user-supplied profile or `MODEL_*` environment value takes precedence.

## Secret Handling

The concrete phase-1 storage mechanism is pinned in `docs/DECISIONS/004-local-secret-storage.md`. Summary:

- Tracked files may contain placeholder defaults but never real API keys.
- Development credentials belong in `.env`, `.env.local`, or another untracked local settings file.
- The actual secret lives in an untracked local secret store (file or environment), not in SQLite. The `model_profiles.api_key_ref` column holds only a key name/handle into that store, never the raw key or a recoverable ciphertext.
- A request may submit a raw API key; the backend resolves it into the secret store and persists only the `api_key_ref`. No endpoint echoes the raw key back.
- Logs must redact API keys and `Authorization` headers.

## Environment Inputs

Supported local development variables:

```text
MODEL_PROVIDER=openai_compatible
MODEL_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.6-flash
MODEL_API_KEY=<secret>
MODEL_CONTEXT_WINDOW=1000000
MODEL_SUPPORTS_STREAMING=true
```

Legacy `BIANXIE_*` variables should not be the new canonical names.

`context_window_hint` is an estimate used for backend and frontend budgeting. It must reflect the selected model profile when known instead of assuming all Qwen/OpenAI-compatible profiles are 128k. Modern provider profiles may advertise larger windows such as 256k or 1M; the backend still treats the value as a hint and keeps safety margins, output budgets, and privacy bounds.

## API Surface

### `GET /api/settings/model-profiles`

Returns saved profiles without raw secrets.

### `PUT /api/settings/model-profiles/default`

Creates or updates the default local profile. Request may include a raw API key, but response must not echo it.

### `POST /api/settings/model-profiles/test`

Runs a minimal provider connectivity check using the submitted or saved profile.

## Provider Rules

- First implementation should use an OpenAI-compatible adapter for Qwen unless official docs require otherwise.
- Default Qwen endpoint/model/context values are pinned in `## Default Qwen Values`; future changes must be re-verified against current official documentation before editing tracked defaults.
- Pipelines depend on the provider interface, not on environment variables directly.
- Context budgeting, including revision-context inclusion, uses `context_window_hint` from the resolved profile. A missing or invalid hint falls back to the backend default, but code should not hard-code revision prompt size solely around that fallback.

## Errors

Uses the canonical envelope (`errors.md`). Failure cases:

| Scenario | HTTP | Code |
| --- | --- | --- |
| Save profile with malformed `base_url`/missing `model` | 400 | `validation_error` |
| `test` with no resolvable key | 400 | `missing_api_key` |
| `test` where provider rejects the key | 502 | `provider_auth_failed` |
| `test` where provider/network is unreachable | 502 | `provider_unavailable` |

## Validation Rules

- `base_url` must be an absolute `https`/`http` URL; `model` must be non-empty.
- Empty model/base URL fields in the settings editor should reset to the documented non-secret defaults rather than saving blank values.
- Exactly one profile may have `is_default = true`.
- The `test` endpoint performs a single minimal completion/models call and must time out quickly.

## Compatibility

- Additive: new optional profile fields (e.g. extra capability hints), new providers behind `provider`.
- Breaking (ADR required): renaming `api_key_ref` semantics, returning raw keys, or changing the `MODEL_*` env contract.

## Versioning

- Settings endpoints live under `/api/settings`. The `model_profiles` shape is versioned with `sqlite-schema.md`.

## Acceptance Checks

- A user can set base URL, model, and API key.
- A new user sees non-secret defaults for provider, base URL, model, context window, and streaming support before entering an API key.
- The API key is not returned by any settings endpoint.
- A missing key gives a clear `missing_api_key` error.
- Provider calls can be mocked in tests.

## Open Questions

- Whether to support multiple named profiles per user in phase 1 or only one default profile.
