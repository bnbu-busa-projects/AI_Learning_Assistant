from __future__ import annotations

import json
import re
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

from backend.context.budget import (
    ContextEstimate,
    ContextSection,
    DEFAULT_CONTEXT_WINDOW_LIMIT,
    estimate_context_budget,
    estimate_text_tokens,
    normalize_context_window_limit,
    output_token_budget,
    section_kind_for_upload,
)
from backend.context.course_context import load_course_context
from backend.context.extraction import UploadExtraction, extract_upload
from backend.context.search_policy import SearchPolicyDecision, decide_search_policy
from backend.storage.sqlite import SQLiteRepository

REVISION_TARGET_UTILIZATION_RATIO = 0.60
BASE_REVISION_MANIFEST_CHARS = 8000
BASE_REVISION_SOURCE_FILE_CHARS = 12000
BASE_REVISION_SOURCE_TOTAL_CHARS = 24000
MAX_REVISION_SOURCE_FILE_CHARS = 64000
MAX_REVISION_SOURCE_TOTAL_CHARS = 200000
BASE_REVISION_LOG_FILE_CHARS = 4000
BASE_REVISION_LOG_TOTAL_CHARS = 8000
MAX_REVISION_LOG_FILE_CHARS = 8000
MAX_REVISION_LOG_TOTAL_CHARS = 16000
REVISION_CODE_CHARS_PER_TOKEN = 3
REVISION_SOURCE_EXTRA_CONTEXT_TOKEN_RATIO = 0.15
REVISION_LOG_EXTRA_CONTEXT_TOKEN_RATIO = 0.01
REVISION_SOURCE_KINDS = {"source", "script", "notebook"}
REVISION_SOURCE_SUFFIXES = {".py", ".ipynb", ".html", ".htm", ".css", ".svg"}
REVISION_LOG_PATHS = ("logs/generation.log", "logs/convert.log")
POSIX_HOST_PATH_RE = re.compile(
    r"(?<![:A-Za-z0-9])/(?:Users|private|var|tmp|Volumes|home)(?:/[^\s\"'`<>]+)+"
)
WINDOWS_HOST_PATH_RE = re.compile(r"\b[A-Za-z]:\\[^\s\"'`<>]+")
BEARER_TOKEN_RE = re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+")
SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b(api[_-]?key|authorization|token|password|secret)\b\s*[:=]\s*[^,\s}\]]+"
)
OPENAI_STYLE_KEY_RE = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")


class ContextBuildError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        fields: list[dict[str, str]] | None = None,
    ):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields or []
        super().__init__(message)


@dataclass(frozen=True)
class RevisionContextBudget:
    manifest_chars: int
    source_file_chars: int
    source_total_chars: int
    log_file_chars: int
    log_total_chars: int


@dataclass(frozen=True)
class PreparedContext:
    context_bundle: str
    estimate: ContextEstimate
    uploads: tuple[UploadExtraction, ...]
    search_policy: SearchPolicyDecision
    revision: dict[str, Any] | None = None
    course_context: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        payload = {
            "context_bundle_chars": len(self.context_bundle),
            "estimate": self.estimate.to_dict(),
            "uploads": [upload.to_summary_dict() for upload in self.uploads],
            "search_policy": self.search_policy.to_dict(),
        }
        if self.revision:
            payload["revision"] = self.revision
        if self.course_context:
            payload["course_context"] = self.course_context
        return payload


def build_run_context(
    repo: SQLiteRepository,
    *,
    task_text: str,
    intent: str,
    search_mode: str,
    upload_ids: list[str] | None = None,
    options: dict[str, Any] | None = None,
    context_window_limit: int | None = None,
    revision_of_run_id: str | None = None,
    user_id: str | None = None,
    course: dict[str, Any] | None = None,
) -> PreparedContext:
    uploads = tuple(_load_upload_contexts(repo, upload_ids or [], user_id=user_id))
    sections = [ContextSection(name="task_text", text=task_text, kind=_task_kind(intent))]
    bundle_parts = ["[Task]\n" + task_text]
    course_context_text = load_course_context(course)

    if course_context_text:
        course_id = str(course.get("id") or "selected")
        sections.append(
            ContextSection(
                name=f"course_context:{course_id}",
                text=course_context_text,
                kind="prose",
            )
        )
        bundle_parts.append(
            "[Course Context]\n"
            "Use this compact course summary as low-priority reference only.\n"
            + course_context_text
        )

    for upload in uploads:
        upload_kind = section_kind_for_upload(upload.original_name, upload.media_type)
        sections.append(
            ContextSection(
                name=f"upload:{upload.id}",
                text=upload.as_context_text(),
                kind=upload_kind,
            )
        )
        bundle_parts.append(upload.as_context_text())

    if options:
        option_text = json.dumps(options, sort_keys=True)
        sections.append(ContextSection(name="options", text=option_text, kind="prose"))
        bundle_parts.append("[Options]\n" + option_text)

    revision = (
        _load_revision_context(
            repo,
            revision_of_run_id=revision_of_run_id,
            user_id=user_id,
            budget=_revision_context_budget(
                context_window_limit=context_window_limit,
                intent=intent,
                options=options,
                base_sections=sections,
            ),
        )
        if revision_of_run_id
        else None
    )

    if revision:
        sections.append(
            ContextSection(
                name=f"revision:{revision['run_id']}",
                text=revision["context_text"],
                kind="code",
            )
        )
        bundle_parts.append(revision["context_text"])

    estimate = estimate_context_budget(
        sections,
        intent=intent,
        options=options,
        context_window_limit=context_window_limit,
    )
    search_policy = decide_search_policy(
        search_mode=search_mode,
        intent=intent,
        task_text=task_text,
        upload_count=len(uploads),
    )

    return PreparedContext(
        context_bundle="\n\n".join(bundle_parts),
        estimate=estimate,
        uploads=_uploads_with_token_estimates(uploads),
        search_policy=search_policy,
        revision=revision["summary"] if revision else None,
        course_context=(
            {
                "course_id": course.get("id"),
                "included": True,
                "chars": len(course_context_text),
            }
            if course and course_context_text
            else None
        ),
    )


def _load_upload_contexts(
    repo: SQLiteRepository,
    upload_ids: list[str],
    *,
    user_id: str | None = None,
) -> list[UploadExtraction]:
    contexts: list[UploadExtraction] = []
    for upload_id in upload_ids:
        upload = (
            repo.get_upload_for_user(upload_id, user_id)
            if user_id
            else repo.get_upload(upload_id)
        )
        if not upload:
            raise ContextBuildError(
                400,
                "not_found",
                "A referenced upload was not found.",
                [{"field": "upload_ids", "rule": "exists"}],
            )
        contexts.append(extract_upload(upload))
    return contexts


def _uploads_with_token_estimates(
    uploads: tuple[UploadExtraction, ...]
) -> tuple[UploadExtraction, ...]:
    estimated: list[UploadExtraction] = []
    for upload in uploads:
        kind = section_kind_for_upload(upload.original_name, upload.media_type)
        estimated.append(
            replace(
                upload,
                estimated_tokens=estimate_text_tokens(upload.as_context_text(), kind=kind),
            )
        )
    return tuple(estimated)


def _task_kind(intent: str) -> str:
    if intent == "code_homework":
        return "code"
    if intent in {"essay_latex", "beamer_slides", "cheat_sheet"}:
        return "markup"
    return "prose"


def _revision_context_budget(
    *,
    context_window_limit: int | None,
    intent: str,
    options: dict[str, Any] | None,
    base_sections: list[ContextSection],
) -> RevisionContextBudget:
    limit = normalize_context_window_limit(context_window_limit)
    base_input_tokens = sum(
        estimate_text_tokens(section.text, kind=section.kind) for section in base_sections
    )
    target_total_tokens = int(limit * REVISION_TARGET_UTILIZATION_RATIO)
    available_tokens = max(
        0,
        target_total_tokens - base_input_tokens - output_token_budget(intent, options),
    )
    available_chars = available_tokens * REVISION_CODE_CHARS_PER_TOKEN

    manifest_chars = min(BASE_REVISION_MANIFEST_CHARS, available_chars)
    remaining_chars = max(0, available_chars - manifest_chars)

    source_total_chars = min(_scaled_source_total_chars(limit), remaining_chars)
    remaining_chars = max(0, remaining_chars - source_total_chars)

    log_total_chars = min(_scaled_log_total_chars(limit), remaining_chars)

    return RevisionContextBudget(
        manifest_chars=manifest_chars,
        source_file_chars=_per_file_budget(
            source_total_chars,
            base_file_chars=BASE_REVISION_SOURCE_FILE_CHARS,
            max_file_chars=MAX_REVISION_SOURCE_FILE_CHARS,
        ),
        source_total_chars=source_total_chars,
        log_file_chars=_per_file_budget(
            log_total_chars,
            base_file_chars=BASE_REVISION_LOG_FILE_CHARS,
            max_file_chars=MAX_REVISION_LOG_FILE_CHARS,
        ),
        log_total_chars=log_total_chars,
    )


def _scaled_source_total_chars(context_window_limit: int) -> int:
    if context_window_limit <= DEFAULT_CONTEXT_WINDOW_LIMIT:
        return BASE_REVISION_SOURCE_TOTAL_CHARS
    extra_tokens = context_window_limit - DEFAULT_CONTEXT_WINDOW_LIMIT
    extra_chars = int(
        extra_tokens
        * REVISION_SOURCE_EXTRA_CONTEXT_TOKEN_RATIO
        * REVISION_CODE_CHARS_PER_TOKEN
    )
    return min(MAX_REVISION_SOURCE_TOTAL_CHARS, BASE_REVISION_SOURCE_TOTAL_CHARS + extra_chars)


def _scaled_log_total_chars(context_window_limit: int) -> int:
    if context_window_limit <= DEFAULT_CONTEXT_WINDOW_LIMIT:
        return BASE_REVISION_LOG_TOTAL_CHARS
    extra_tokens = context_window_limit - DEFAULT_CONTEXT_WINDOW_LIMIT
    extra_chars = int(
        extra_tokens * REVISION_LOG_EXTRA_CONTEXT_TOKEN_RATIO * REVISION_CODE_CHARS_PER_TOKEN
    )
    return min(MAX_REVISION_LOG_TOTAL_CHARS, BASE_REVISION_LOG_TOTAL_CHARS + extra_chars)


def _per_file_budget(
    total_chars: int,
    *,
    base_file_chars: int,
    max_file_chars: int,
) -> int:
    if total_chars <= 0:
        return 0
    return min(total_chars, min(max_file_chars, max(base_file_chars, total_chars // 2)))


def _load_revision_context(
    repo: SQLiteRepository,
    *,
    revision_of_run_id: str,
    user_id: str | None,
    budget: RevisionContextBudget,
) -> dict[str, Any]:
    prior_run = repo.get_run(revision_of_run_id)
    if not prior_run or not user_id or prior_run.get("user_id") != user_id:
        raise ContextBuildError(404, "not_found", "Run was not found.")

    run_root = _safe_existing_run_root(prior_run.get("output_root"))
    manifest = _read_prior_manifest(run_root)
    outputs = _manifest_outputs(manifest)
    if not outputs and run_root:
        outputs = _artifact_outputs(repo, run_id=prior_run["id"], run_root=run_root)

    source_blocks = _read_revision_sources(run_root, outputs, budget=budget)
    log_blocks = _read_revision_logs(run_root, budget=budget)
    manifest_summary = _manifest_summary(manifest)
    output_filenames = [entry["path"] for entry in outputs]
    context_text = _format_revision_context(
        prior_run=prior_run,
        manifest_summary=manifest_summary,
        output_filenames=output_filenames,
        source_blocks=source_blocks,
        log_blocks=log_blocks,
        budget=budget,
    )

    return {
        "run_id": prior_run["id"],
        "context_text": context_text,
        "summary": {
            "run_id": prior_run["id"],
            "intent": prior_run.get("intent"),
            "status": prior_run.get("status"),
            "output_count": len(output_filenames),
            "source_file_count": len(source_blocks),
            "log_file_count": len(log_blocks),
        },
    }


def _safe_existing_run_root(output_root: str | None) -> Path | None:
    if not output_root:
        return None
    root = Path(output_root)
    if not root.exists() or not root.is_dir():
        return None
    return root.resolve()


def _read_prior_manifest(run_root: Path | None) -> dict[str, Any] | None:
    if not run_root:
        return None
    manifest_path = run_root / "manifest.json"
    if not manifest_path.exists() or not manifest_path.is_file():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def _manifest_outputs(manifest: dict[str, Any] | None) -> list[dict[str, str]]:
    outputs = []
    for entry in (manifest or {}).get("outputs") or []:
        if not isinstance(entry, dict):
            continue
        path = entry.get("path")
        kind = entry.get("kind")
        if isinstance(path, str) and isinstance(kind, str):
            outputs.append({"path": path, "kind": kind})
    return outputs


def _artifact_outputs(
    repo: SQLiteRepository,
    *,
    run_id: str,
    run_root: Path,
) -> list[dict[str, str]]:
    outputs: list[dict[str, str]] = []
    for row in repo.list_artifacts_for_run(run_id):
        path = _relative_artifact_path(row.get("path"), run_root=run_root)
        kind = row.get("kind")
        if path and isinstance(kind, str) and path.startswith("output/"):
            outputs.append({"path": path, "kind": kind})
    return outputs


def _relative_artifact_path(path_value: Any, *, run_root: Path) -> str | None:
    if not isinstance(path_value, str):
        return None
    try:
        path = Path(path_value).resolve()
        return path.relative_to(run_root).as_posix()
    except (OSError, ValueError):
        return None


def _manifest_summary(manifest: dict[str, Any] | None) -> dict[str, Any] | None:
    if not manifest:
        return None
    search = manifest.get("search") if isinstance(manifest.get("search"), dict) else {}
    model = manifest.get("model") if isinstance(manifest.get("model"), dict) else {}
    citations = []
    for citation in search.get("citations") or []:
        if not isinstance(citation, dict):
            continue
        citations.append(
            {
                "title": citation.get("title"),
                "url": citation.get("url"),
                "snippet": citation.get("snippet"),
            }
        )

    return {
        "schema_version": manifest.get("schema_version"),
        "run_id": manifest.get("run_id"),
        "revision_of_run_id": manifest.get("revision_of_run_id"),
        "intent": manifest.get("intent"),
        "status": manifest.get("status"),
        "model": {
            "provider": model.get("provider"),
            "model": model.get("model"),
        },
        "search": {
            "mode": search.get("mode"),
            "used": search.get("used"),
            "citations": citations,
        },
        "outputs": _manifest_outputs(manifest),
    }


def _read_revision_sources(
    run_root: Path | None,
    outputs: list[dict[str, str]],
    *,
    budget: RevisionContextBudget,
) -> list[dict[str, str]]:
    if not run_root:
        return []
    blocks: list[dict[str, str]] = []
    total_chars = 0
    for entry in outputs:
        path = entry["path"]
        kind = entry["kind"]
        if kind not in REVISION_SOURCE_KINDS and Path(path).suffix.lower() not in REVISION_SOURCE_SUFFIXES:
            continue
        text = _read_relative_text(run_root, path)
        if text is None:
            continue
        remaining = budget.source_total_chars - total_chars
        if remaining <= 0:
            break
        sanitized = _truncate_text(
            _sanitize_revision_text(text),
            min(budget.source_file_chars, remaining),
            "prior generated source",
        )
        total_chars += len(sanitized)
        blocks.append({"path": path, "kind": kind, "text": sanitized})
    return blocks


def _read_revision_logs(
    run_root: Path | None,
    *,
    budget: RevisionContextBudget,
) -> list[dict[str, str]]:
    if not run_root:
        return []
    blocks: list[dict[str, str]] = []
    total_chars = 0
    for path in REVISION_LOG_PATHS:
        text = _read_relative_text(run_root, path)
        if text is None:
            continue
        remaining = budget.log_total_chars - total_chars
        if remaining <= 0:
            break
        sanitized = _truncate_text(
            _sanitize_revision_text(text),
            min(budget.log_file_chars, remaining),
            "prior sanitized log",
        )
        total_chars += len(sanitized)
        blocks.append({"path": path, "text": sanitized})
    return blocks


def _read_relative_text(run_root: Path, relative_path: str) -> str | None:
    candidate = run_root / Path(relative_path)
    try:
        resolved = candidate.resolve()
        resolved.relative_to(run_root)
    except (OSError, ValueError):
        return None
    if not resolved.exists() or not resolved.is_file():
        return None
    try:
        return resolved.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


def _format_revision_context(
    *,
    prior_run: dict[str, Any],
    manifest_summary: dict[str, Any] | None,
    output_filenames: list[str],
    source_blocks: list[dict[str, str]],
    log_blocks: list[dict[str, str]],
    budget: RevisionContextBudget,
) -> str:
    prior_summary = {
        "run_id": prior_run["id"],
        "intent": prior_run.get("intent"),
        "status": prior_run.get("status"),
        "search_mode": prior_run.get("search_mode"),
        "outputs": output_filenames,
    }
    parts = [
        "[Revision Context]\n"
        "Use the prior run only as reference. Produce a complete new artifact for this run.",
        "[Prior Run Summary]\n" + json.dumps(prior_summary, indent=2, sort_keys=True),
    ]
    if manifest_summary:
        manifest_text = json.dumps(manifest_summary, indent=2, sort_keys=True)
        parts.append(
            "[Prior Manifest Summary]\n"
            + _truncate_text(manifest_text, budget.manifest_chars, "prior manifest")
        )
    if source_blocks:
        parts.append(
            "[Prior Generated Source]\n"
            + "\n\n".join(
                f"[File: {block['path']}]\n{block['text']}" for block in source_blocks
            )
        )
    if log_blocks:
        parts.append(
            "[Prior Sanitized Logs]\n"
            + "\n\n".join(f"[Log: {block['path']}]\n{block['text']}" for block in log_blocks)
        )
    return "\n\n".join(parts)


def _sanitize_revision_text(text: str) -> str:
    lines: list[str] = []
    in_traceback = False
    for raw_line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        line = raw_line.rstrip()
        if "Traceback (most recent call last)" in line:
            lines.append("[redacted traceback]")
            in_traceback = True
            continue
        if in_traceback and (line.startswith((" ", "\t")) or line.lstrip().startswith("File ")):
            continue
        in_traceback = False
        lines.append(_redact_sensitive_text(line))
    return "\n".join(lines).strip()


def _redact_sensitive_text(text: str) -> str:
    redacted = POSIX_HOST_PATH_RE.sub("[redacted-path]", text)
    redacted = WINDOWS_HOST_PATH_RE.sub("[redacted-path]", redacted)
    redacted = BEARER_TOKEN_RE.sub("Bearer [redacted-token]", redacted)
    redacted = OPENAI_STYLE_KEY_RE.sub("[redacted-key]", redacted)
    redacted = SECRET_ASSIGNMENT_RE.sub(lambda match: f"{match.group(1)}=[redacted]", redacted)
    return redacted


def _truncate_text(text: str, max_chars: int, label: str) -> str:
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n\n[Truncated {label} to {max_chars} characters.]"
