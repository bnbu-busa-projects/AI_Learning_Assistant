<!--
Owner: project-maintainer
Last Reviewed: 2026-06-05
Status: Active
-->

# Contract: Course Context

## Purpose

Add optional course-level memory to the artifact workbench without returning to the legacy course/assignment/chat product model.

A course is a lightweight context container. It can be selected for a run, and non-default courses may contribute a compact Markdown summary of prior questions, uploaded-material summaries, and course-specific preferences. The default course exists for uncategorized "just asking" work and does not contribute context.

## Terms

| Term | Meaning |
| --- | --- |
| Default course | The undeletable, always-present "Just Asking" container for runs not assigned to a real course. |
| Ordinary course | A user-created, named course that can contribute compact context. |
| Archived course | A course hidden from normal frontend lists without hard-deleting its row, runs, uploads, or context file. |
| Course context | A small `course_context.md` file summarized from successful course runs and optional uploaded materials. |

The frontend may localize the default course label, including Chinese labels such as `随便问问`, but the backend behavior is keyed by `is_default` and `context_enabled = false`, not by display text.

## Storage Mapping

Phase 1 maps user-visible courses to the existing `projects` table:

- `projects.id` is used as `course_id` in the API.
- `runs.project_id` stores the selected course id.
- The default course is one `projects` row per user with `is_default = 1` and `context_enabled = 0`.
- Ordinary courses have `is_default = 0` and `context_enabled = 1`.
- Soft deletion is represented by `is_archived = 1`.
- `context_path` points to the course's compact Markdown context file when one exists.

Do not recreate the legacy course/assignment/chat schema during phase 1.

## API Surface

### `GET /api/courses`

Returns the authenticated user's non-archived courses, always including the default course.

```json
{
  "courses": [
    {
      "id": "course-default",
      "title": "Just Asking",
      "is_default": true,
      "is_archived": false,
      "context_enabled": false,
      "context_updated_at": null
    },
    {
      "id": "course-ml",
      "title": "Machine Learning",
      "is_default": false,
      "is_archived": false,
      "context_enabled": true,
      "context_updated_at": "2026-06-05T10:00:00Z"
    }
  ]
}
```

### `POST /api/courses`

Creates an ordinary course for the authenticated user.

Request:

```json
{"title": "Machine Learning"}
```

### `PATCH /api/courses/{course_id}`

Renames or archives an ordinary course.

Request examples:

```json
{"title": "Machine Learning II"}
```

```json
{"is_archived": true}
```

The default course cannot be archived, deleted, or converted into a context-enabled course.

### Generation Request Field

`POST /api/runs` accepts optional `course_id`:

```json
{
  "task_text": "Create a cheat sheet for lecture 3.",
  "intent": "cheat_sheet",
  "course_id": "course-ml",
  "upload_ids": ["upload-1"],
  "options": {"target_pages": 2}
}
```

If `course_id` is absent, the backend uses the default course for metadata grouping but does not add course context.

## Context Summary Rules

- `course_context.md` is a compact Markdown file, not a transcript.
- Default target size: about 8 KB UTF-8 Markdown per course. Implementations may treat this as a tunable cap.
- Include only low-risk, reusable learning context: key topics, recurring assessment signals, summarized uploaded materials, user preferences, and previous question categories.
- Do not store raw API keys, auth tokens, full prompts, private uploaded document text, or long verbatim slide excerpts.
- Context updates should happen after successful runs for non-default courses.
- Course context is optional, low-priority model input. The context builder may skip it when the selected intent or budget makes it irrelevant.
- The context estimate must count included course context text.

Example summary shape:

```markdown
# Course Context

## Concepts
- Logistic regression: user asked about decision boundaries and regularization.
- Tree models: user focused on splitting criteria and overfitting.

## Assessment Signals
- Short quiz/homework style questions; concise derivations are preferred.

## Materials
- Lecture slide uploads emphasize supervised learning and neural network basics.
```

## Errors

Uses the canonical envelope (`errors.md`):

| Scenario | HTTP | Code |
| --- | --- | --- |
| Missing/invalid token | 401 | `unauthorized` |
| Empty or too-long course title | 400 | `validation_error` |
| Course not found, archived when selection is disallowed, or not owned | 404 | `not_found` |
| Attempt to archive/delete/enable context on the default course | 409 | `conflict` |

## Validation Rules

- Course titles are user-visible strings and must be trimmed before storage.
- Archived ordinary courses are hidden from normal frontend selectors.
- Existing runs remain linked to archived courses.
- Hard deletion is out of scope unless a future task adds explicit retention and cleanup rules.
- A run may reference only a course owned by the authenticated user.

## Compatibility

- Additive: context metadata fields, archived-course management views, import/export of course summaries.
- Breaking (ADR required): hard-deleting courses by default, making every run require a non-default course, enabling context for the default course, or replacing explicit artifact intents with course-specific chat inference.

## Versioning

The course API is versioned with the rest of `/api`. SQLite schema changes are governed by `sqlite-schema.md`.

## Acceptance Checks

- A new authenticated user always has a default course.
- The default course is visible, selectable, and context-disabled.
- Ordinary courses can be created, renamed, selected for runs, and archived without hard deletion.
- Runs without an explicit course use the default course and include no course context.
- Runs with a non-default course may include the compact `course_context.md` as low-priority reference.
- Course context stays compact and does not store raw uploads or full conversation transcripts.

## Open Questions

- Whether users should manually edit `course_context.md` in a future phase or keep it generated-only.
