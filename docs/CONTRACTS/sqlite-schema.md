<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: SQLite Schema

## Purpose

Define local metadata persistence for the Electron plus Docker Desktop runtime.

## Database File

Default path inside the Docker runtime should be mounted from the host, for example:

```text
data/app.sqlite
```

The exact host path may change, but it must be stable across restarts and included in packaging docs.

## Tables

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | UUID or ULID |
| `email` | text unique not null | Supported institutional email |
| `role` | text not null | `teacher` or `student` |
| `password_hash` | text not null | local auth hash |
| `created_at` | text not null | ISO timestamp |

### `sessions`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | token/session id |
| `user_id` | text not null | references `users.id` |
| `token_hash` | text not null | never store raw token if avoidable |
| `expires_at` | text nullable | ISO timestamp |
| `created_at` | text not null | ISO timestamp |

### `model_profiles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | stable profile id |
| `user_id` | text nullable | null for machine default |
| `display_name` | text not null | user visible |
| `provider` | text not null | initially `openai_compatible` |
| `base_url` | text not null | provider endpoint |
| `model` | text not null | model id |
| `api_key_ref` | text nullable | secret reference, not raw key |
| `context_window_hint` | integer nullable | token estimate hint |
| `supports_streaming` | integer not null | 0/1 |
| `is_default` | integer not null | 0/1 |
| `created_at` | text not null | ISO timestamp |
| `updated_at` | text not null | ISO timestamp |

### `projects`

Phase 1 surfaces `projects` as lightweight course containers. The name stays `projects` in SQLite to avoid a breaking table rename; APIs and UI may call these rows courses.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | UUID or ULID |
| `user_id` | text not null | owner |
| `title` | text not null | user visible |
| `root_path` | text not null | artifact filesystem root |
| `is_default` | integer not null | 0/1; exactly one undeletable default "Just Asking" course per user |
| `is_archived` | integer not null | 0/1 soft-delete flag; archived courses are hidden from normal frontend lists |
| `context_enabled` | integer not null | 0/1; default course must be 0, ordinary courses default to 1 |
| `context_path` | text nullable | filesystem path to compact `course_context.md` when present |
| `context_updated_at` | text nullable | ISO timestamp for the latest context summary update |
| `created_at` | text not null | ISO timestamp |
| `updated_at` | text not null | ISO timestamp |

### `runs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | run id used in output path |
| `project_id` | text nullable | selected course/project id; null allowed only for legacy rows or migration fallback |
| `user_id` | text not null | requester |
| `intent` | text not null | see generation contract |
| `task_text` | text not null | original user task |
| `search_mode` | text not null | `auto`, `on`, `off` |
| `status` | text not null | `queued`, `running`, `succeeded`, `failed`, `cancelled` |
| `model_profile_id` | text nullable | selected profile |
| `revision_of_run_id` | text nullable | prior run id when this run is a follow-up/revision |
| `output_root` | text nullable | folder path |
| `error_message` | text nullable | sanitized |
| `created_at` | text not null | ISO timestamp |
| `updated_at` | text not null | ISO timestamp |

### `uploads`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | upload id |
| `user_id` | text nullable | owner; required for API-created uploads, nullable only for legacy migration compatibility |
| `run_id` | text nullable | may be linked after upload |
| `original_name` | text not null | sanitized on write |
| `media_type` | text nullable | detected type |
| `stored_path` | text not null | filesystem path |
| `sha256` | text not null | dedupe/audit |
| `size_bytes` | integer not null | upload size |
| `created_at` | text not null | ISO timestamp |

### `artifacts`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | artifact id |
| `run_id` | text not null | parent run |
| `kind` | text not null | `source`, `pdf`, `notebook`, `script`, `manifest`, `log` |
| `path` | text not null | filesystem path |
| `media_type` | text nullable | MIME or semantic type |
| `created_at` | text not null | ISO timestamp |

### `citations`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | text primary key | citation id |
| `run_id` | text not null | parent run |
| `title` | text nullable | source title |
| `url` | text nullable | source URL |
| `snippet` | text nullable | short snippet |
| `created_at` | text not null | ISO timestamp |

## Migration Rules

- Use explicit migrations once the schema exists.
- SQLite schema changes must have a rollback or compatibility note.
- Course archive semantics are soft-delete only in phase 1; do not hard-delete project/course rows as the default behavior.
- Do not couple SQLAlchemy models directly to UI response shapes.

## Versioning

- A `schema_version` is recorded (e.g. SQLite `PRAGMA user_version` or a `meta` row) and bumped by each migration.
- Migrations are forward-only; a downgrade is a new forward migration.

## Compatibility

- Additive: new nullable columns, new tables, new indexes, new non-null columns with safe defaults/backfills.
- Breaking (ADR required): dropping/renaming a column or table, changing a column type, or changing a primary/foreign key relationship.

## Acceptance Checks

- A new database can be created without Postgres or Mongo.
- Users, sessions, profiles, runs, uploads, artifacts, and citations can be inserted in isolation.
- A revision run can reference a prior run without overwriting or mutating the prior run row/folder.
- A new user can receive one default context-disabled project/course row, ordinary courses can be archived without deleting linked runs, and runs can record their selected course via `project_id`.
- Large file contents are absent from SQLite rows.
- `api_key_ref` never contains a raw key or recoverable ciphertext (see `model-settings.md`).

## Open Questions

- Whether to add soft-delete/retention columns for runs and uploads, or rely on filesystem cleanup tasks.
- Whether `projects` should be renamed to `courses` in a later breaking migration if course context becomes the dominant long-term product concept.
