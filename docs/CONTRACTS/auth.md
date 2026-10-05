<!--
Owner: project-maintainer
Last Reviewed: 2026-05-31
Status: Active
-->

# Contract: Auth And Identity

## Purpose

Preserve teaching-product identity while keeping the implementation replaceable by stronger auth later.

## Roles

| Email Pattern | Role | First-Phase Capability |
| --- | --- | --- |
| `*@bnbu.edu.cn` | `teacher` | Full artifact generation |

Unknown domains must be rejected.

## API Surface

### `POST /api/auth/register`

Request:

```json
{
  "email": "xx@bnbu.edu.cn",
  "password": "user supplied password",
  "confirm_password": "user supplied password"
}
```

Response:

```json
{
  "status": "success",
  "email": "xx@bnbu.edu.cn",
  "role": "teacher"
}
```

### `POST /api/auth/login`

Request:

```json
{
  "email": "xx@bnbu.edu.cn",
  "password": "user supplied password"
}
```

Response:

```json
{
  "token": "opaque-session-token",
  "role": "teacher",
  "email": "xx@bnbu.edu.cn",
  "expires_at": "2026-06-07T00:00:00Z"
}
```

### `GET /api/auth/me`

Requires `Authorization: Bearer <token>`.

Response:

```json
{
  "email": "xx@bnbu.edu.cn",
  "role": "teacher"
}
```

## Token Rules

- First-phase tokens may remain weak and local, but client code must treat them as opaque.
- Do not expose implementation details such as `base64(email)` to the UI contract.
- Token verification must be isolated behind auth middleware/service code.
- Session storage must be replaceable by JWT/OAuth/session-cookie implementations later.

## Password Rules

- Do not store raw passwords.
- If the first pass uses simple hashing for speed, isolate it and mark it with tests and comments as local-only.
- Any hosted/server deployment must replace local-only hashing with a production-grade password strategy.

## Errors

All auth errors use the canonical envelope in `errors.md`:

```json
{ "error": { "code": "unknown_email_domain", "message": "Use a BNBU institutional email address to register." } }
```

Failure cases:

| Scenario | HTTP | Code |
| --- | --- | --- |
| Email not `@bnbu.edu.cn` | 400 | `unknown_email_domain` |
| Missing/short password, mismatch on register | 400 | `validation_error` (with `fields`) |
| Email already registered | 409 | `conflict` |
| Wrong password on login | 401 | `unauthorized` |
| Missing/expired/invalid bearer token | 401 | `unauthorized` |
| Authenticated user calling a future role-restricted capability | 403 | `forbidden` |

## Validation Rules

- Normalize email to lowercase before domain check and storage.
- Password minimum length is enforced server-side and reported via `validation_error` `fields`.
- Tokens are compared in constant time; expired tokens are treated as invalid, not as a distinct code.

## Compatibility

- Additive: new accepted institutional email domains, new optional response fields, new `403` capabilities.
- Breaking (ADR required): changing the token transport (`Authorization: Bearer`), changing role names, or exposing token internals.

## Versioning

- Auth endpoints live under `/api/auth`. Replacing weak auth with JWT/OAuth/session cookies must keep these paths and response shapes or ship a new versioned path with a migration note.

## Acceptance Checks

- BNBU email can register and log in.
- BNBU sessions can authenticate to phase-1 generation APIs.
- Unknown email domains are rejected with `unknown_email_domain`.
- Protected APIs reject missing or invalid token with `unauthorized`.
- UI and Electron never need to know how tokens are generated internally.

## Open Questions

- Whether sessions should support explicit logout/revocation in phase 1 or only natural expiry.
