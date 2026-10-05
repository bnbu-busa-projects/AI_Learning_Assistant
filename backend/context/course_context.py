from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.artifacts.filesystem import ArtifactRun, sanitize_segment
from backend.context.extraction import UploadExtraction
from backend.storage.sqlite import SQLiteRepository
from backend.timing import RunTimingRecorder

COURSE_CONTEXT_FILENAME = "course_context.md"
COURSE_CONTEXT_MAX_CHARS = 8192
COURSE_CONTEXT_PRIOR_CHARS = 3600
COURSE_CONTEXT_CURRENT_CHARS = 3800
COURSE_CONTEXT_LINE_CHARS = 420
SENSITIVE_WORD_RE = re.compile(
    r"(?i)\b(api[_-]?key|authorization|bearer|password|secret|token)\b"
)
SENSITIVE_MARKERS = (
    "api_key",
    "apikey",
    "authorization",
    "bearer",
    "password",
    "secret",
    "token",
)
SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b(api[_-]?key|authorization|token|password|secret)\b\s*[:=]\s*[^,\s}\]]+"
)
OPENAI_STYLE_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")
BEARER_TOKEN_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
LONG_TOKEN_RE = re.compile(r"\b[A-Za-z0-9._~+/=-]{32,}\b")
COMMON_WORDS = {
    "about",
    "after",
    "assignment",
    "brief",
    "course",
    "create",
    "generate",
    "homework",
    "please",
    "problem",
    "question",
    "reference",
    "solution",
    "using",
    "write",
}


def load_course_context(course: dict[str, Any] | None) -> str | None:
    if not _course_can_use_context(course):
        return None
    path_value = course.get("context_path") if course else None
    if not isinstance(path_value, str) or not path_value.strip():
        return None
    path = Path(path_value)
    if not path.exists() or not path.is_file():
        return None
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    text = _compact_text(_redact_sensitive_text(text), COURSE_CONTEXT_MAX_CHARS)
    return text or None


def update_course_context_after_success(
    repo: SQLiteRepository,
    *,
    course: dict[str, Any] | None,
    user: dict[str, Any],
    run: dict[str, Any],
    artifact_run: ArtifactRun,
    uploads: tuple[UploadExtraction, ...],
    timing: RunTimingRecorder | None = None,
) -> dict[str, Any] | None:
    if not _course_can_use_context(course):
        return None

    with timing.measure("course_context_update") if timing else _null_context():
        path = _course_context_path(
            course=course or {},
            user_label=user.get("email") or user.get("id") or "local",
            artifact_run=artifact_run,
        )
        existing = ""
        if path.exists() and path.is_file():
            try:
                existing = path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                existing = ""

        summary = build_updated_course_context(
            existing_context=existing,
            course=course or {},
            run=run,
            artifact_run=artifact_run,
            uploads=uploads,
        )
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(summary, encoding="utf-8")
        return repo.update_project(
            str(course["id"]),
            context_path=str(path.resolve()),
            context_updated_at=_utc_now(),
        )


def build_updated_course_context(
    *,
    existing_context: str,
    course: dict[str, Any],
    run: dict[str, Any],
    artifact_run: ArtifactRun,
    uploads: tuple[UploadExtraction, ...],
) -> str:
    prior = _prior_context_body(existing_context)
    current = _current_run_summary(
        course=course,
        run=run,
        artifact_run=artifact_run,
        uploads=uploads,
    )
    parts = [
        "# Course Context",
        "",
        "Compact generated summary for low-priority generation reference. Do not treat it as a transcript.",
    ]
    if prior:
        parts.extend(["", "## Prior Summary", prior])
    parts.extend(["", "## Recent Successful Run", current])
    return _compact_text("\n".join(parts).strip() + "\n", COURSE_CONTEXT_MAX_CHARS)


def _course_can_use_context(course: dict[str, Any] | None) -> bool:
    return bool(
        course
        and not course.get("is_default")
        and not course.get("is_archived")
        and course.get("context_enabled")
    )


def _course_context_path(
    *,
    course: dict[str, Any],
    user_label: str,
    artifact_run: ArtifactRun,
) -> Path:
    existing = course.get("context_path")
    if isinstance(existing, str) and existing.strip():
        existing_path = Path(existing)
        try:
            resolved = existing_path.resolve()
            resolved.relative_to(artifact_run.root.resolve())
            return resolved
        except (OSError, ValueError):
            pass
    return (
        artifact_run.root
        / sanitize_segment(user_label, fallback="local")
        / sanitize_segment(str(course.get("title") or course.get("id") or "course"))
        / "context"
        / COURSE_CONTEXT_FILENAME
    )


def _prior_context_body(existing_context: str) -> str:
    sanitized = _redact_sensitive_text(existing_context)
    lines = [
        line.rstrip()
        for line in sanitized.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        if line.strip() and line.strip() != "# Course Context"
    ]
    return _compact_text("\n".join(lines), COURSE_CONTEXT_PRIOR_CHARS).strip()


def _current_run_summary(
    *,
    course: dict[str, Any],
    run: dict[str, Any],
    artifact_run: ArtifactRun,
    uploads: tuple[UploadExtraction, ...],
) -> str:
    output_lines = [
        f"- `{_safe_markdown(entry.get('path', 'output'))}` ({_safe_markdown(entry.get('kind', 'artifact'))})"
        for entry in artifact_run.outputs[:8]
    ]
    upload_lines = [
        "- "
        + _safe_markdown(upload.original_name)
        + f" ({_safe_markdown(upload.media_type or 'unknown')}, {upload.size_bytes} bytes)"
        for upload in uploads[:8]
    ]
    if not output_lines:
        output_lines = ["- No output file list was recorded."]
    if not upload_lines:
        upload_lines = ["- No uploaded materials were attached to this run."]

    parts = [
        f"- Course: {_safe_markdown(str(course.get('title') or 'Untitled course'))}",
        f"- Intent: `{_safe_markdown(str(run.get('intent') or 'unknown'))}`",
        f"- Search mode: `{_safe_markdown(str(run.get('search_mode') or 'auto'))}`",
        f"- Task keywords: {_safe_markdown(_task_keywords(str(run.get('task_text') or '')))}",
        "",
        "### Materials",
        *upload_lines,
        "",
        "### Outputs",
        *output_lines,
    ]
    return _compact_text("\n".join(parts), COURSE_CONTEXT_CURRENT_CHARS).strip()


def _task_keywords(task_text: str) -> str:
    words: list[str] = []
    for match in re.finditer(r"[A-Za-z][A-Za-z0-9_+-]{3,}", task_text):
        word = match.group(0).lower()
        if word in COMMON_WORDS or _contains_sensitive_marker(word):
            continue
        if word not in words:
            words.append(word)
        if len(words) >= 12:
            break
    return ", ".join(words) if words else "general artifact request"


def _safe_markdown(text: str) -> str:
    return _redact_sensitive_text(text).replace("`", "'").replace("\n", " ").strip()


def _redact_sensitive_text(text: str) -> str:
    redacted = BEARER_TOKEN_RE.sub("Bearer [redacted-token]", text)
    redacted = OPENAI_STYLE_KEY_RE.sub("[redacted-key]", redacted)
    redacted = SECRET_ASSIGNMENT_RE.sub(lambda match: f"{match.group(1)}=[redacted]", redacted)
    redacted = LONG_TOKEN_RE.sub("[redacted-token]", redacted)
    lines = []
    for raw_line in redacted.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if _contains_sensitive_marker(raw_line):
            lines.append("[redacted sensitive line]")
        elif SENSITIVE_WORD_RE.search(raw_line):
            lines.append(SENSITIVE_WORD_RE.sub("[redacted]", raw_line))
        else:
            lines.append(raw_line)
    return "\n".join(lines)


def _contains_sensitive_marker(text: str) -> bool:
    normalized = text.lower().replace("-", "_")
    return any(marker in normalized for marker in SENSITIVE_MARKERS)


def _compact_text(text: str, max_chars: int) -> str:
    normalized_lines = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        stripped = line.rstrip()
        if len(stripped) > COURSE_CONTEXT_LINE_CHARS:
            stripped = stripped[:COURSE_CONTEXT_LINE_CHARS] + " [truncated line]"
        normalized_lines.append(stripped)
    normalized = "\n".join(normalized_lines).strip()
    if len(normalized) <= max_chars:
        return normalized
    suffix = f"\n\n[Truncated course context to {max_chars} characters.]"
    return normalized[: max(0, max_chars - len(suffix))].rstrip() + suffix


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


class _null_context:
    def __enter__(self):
        return None

    def __exit__(self, _exc_type, _exc, _tb):
        return False
