from __future__ import annotations

import hashlib
import json
import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from backend.artifacts.filesystem import UploadStore, sanitize_segment
from backend.storage.sqlite import SQLiteRepository

DEFAULT_MAX_SINGLE_FILE_SIZE_BYTES = 25 * 1024 * 1024
DEFAULT_MAX_FILES_PER_REQUEST = 40
DEFAULT_MAX_TOTAL_REQUEST_SIZE_BYTES = 200 * 1024 * 1024

MAX_SINGLE_FILE_SIZE_ENV = "UPLOAD_MAX_SINGLE_FILE_SIZE_BYTES"
MAX_FILES_PER_REQUEST_ENV = "UPLOAD_MAX_FILES_PER_REQUEST"
MAX_TOTAL_REQUEST_SIZE_ENV = "UPLOAD_MAX_TOTAL_REQUEST_SIZE_BYTES"

TEXT_EXTENSIONS = {".txt"}
MARKDOWN_EXTENSIONS = {".md", ".markdown"}
PYTHON_EXTENSIONS = {".py"}
NOTEBOOK_EXTENSIONS = {".ipynb"}
PDF_EXTENSIONS = {".pdf"}

TEXT_MEDIA_TYPES = {"text/plain"}
MARKDOWN_MEDIA_TYPES = {"text/markdown", "text/x-markdown"}
PYTHON_MEDIA_TYPES = {"text/x-python", "text/x-python-script", "application/x-python-code"}


@dataclass(frozen=True)
class UploadLimits:
    max_single_file_size_bytes: int = DEFAULT_MAX_SINGLE_FILE_SIZE_BYTES
    max_files_per_request: int = DEFAULT_MAX_FILES_PER_REQUEST
    max_total_request_size_bytes: int = DEFAULT_MAX_TOTAL_REQUEST_SIZE_BYTES


@dataclass(frozen=True)
class UploadCandidate:
    original_name: str
    content_type: str | None
    content: bytes


class UploadError(Exception):
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


def upload_error_envelope(exc: UploadError) -> dict[str, object]:
    error: dict[str, object] = {"code": exc.code, "message": exc.message}
    if exc.fields:
        error["fields"] = exc.fields
    return {"error": error}


def upload_limits_from_env() -> UploadLimits:
    return UploadLimits(
        max_single_file_size_bytes=_positive_int_env(
            MAX_SINGLE_FILE_SIZE_ENV,
            DEFAULT_MAX_SINGLE_FILE_SIZE_BYTES,
        ),
        max_files_per_request=_positive_int_env(
            MAX_FILES_PER_REQUEST_ENV,
            DEFAULT_MAX_FILES_PER_REQUEST,
        ),
        max_total_request_size_bytes=_positive_int_env(
            MAX_TOTAL_REQUEST_SIZE_ENV,
            DEFAULT_MAX_TOTAL_REQUEST_SIZE_BYTES,
        ),
    )


def persist_uploads(
    repo: SQLiteRepository,
    *,
    current_user: dict[str, Any],
    files: list[UploadCandidate],
    workspace_root: str | None,
    limits: UploadLimits,
) -> dict[str, list[dict[str, Any]]]:
    _validate_file_count(files, limits)
    store = UploadStore(workspace_root)
    total_size = 0
    uploads: list[dict[str, Any]] = []

    for file in files:
        original_name = sanitize_original_name(file.original_name)
        content = file.content
        size_bytes = len(content)
        if size_bytes > limits.max_single_file_size_bytes:
            raise UploadError(413, "upload_too_large", "Upload exceeds the file size limit.")

        total_size += size_bytes
        if total_size > limits.max_total_request_size_bytes:
            raise UploadError(413, "upload_too_large", "Upload request exceeds the total size limit.")

        media_type = detect_media_type(
            original_name=original_name,
            declared_content_type=file.content_type,
            content=content,
        )
        if not media_type:
            raise UploadError(415, "unsupported_media_type", "Upload type is not supported.")

        upload_id = f"upl_{uuid.uuid4().hex}"
        stored_path = store.write_upload(
            user_label=str(current_user["email"]),
            upload_id=upload_id,
            original_name=original_name,
            content=content,
        )
        row = repo.create_upload(
            id=upload_id,
            user_id=str(current_user["id"]),
            original_name=original_name,
            media_type=media_type,
            stored_path=str(stored_path.resolve()),
            sha256=hashlib.sha256(content).hexdigest(),
            size_bytes=size_bytes,
        )
        uploads.append(serialize_upload(row))

    return {"uploads": uploads}


def get_upload_metadata_for_user(
    repo: SQLiteRepository,
    *,
    upload_id: str,
    user_id: str,
) -> dict[str, Any]:
    upload = repo.get_upload_for_user(upload_id, user_id)
    if not upload:
        raise UploadError(404, "not_found", "Upload was not found.")
    return serialize_upload(upload)


def serialize_upload(upload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": upload["id"],
        "original_name": upload["original_name"],
        "media_type": upload.get("media_type"),
        "size_bytes": upload["size_bytes"],
        "sha256": upload["sha256"],
        "created_at": upload["created_at"],
    }


def sanitize_original_name(value: str | None) -> str:
    basename = (value or "upload").replace("\\", "/").split("/")[-1]
    return sanitize_segment(basename, fallback="upload")


def detect_media_type(
    *,
    original_name: str,
    declared_content_type: str | None,
    content: bytes,
) -> str | None:
    extension = Path(original_name).suffix.lower()
    declared = _normalize_media_type(declared_content_type)

    if content.startswith(b"%PDF-"):
        return "application/pdf"

    if extension in NOTEBOOK_EXTENSIONS:
        return "application/json" if _looks_like_notebook(content) else None

    if not _is_utf8_text(content):
        return None

    if extension in PYTHON_EXTENSIONS or declared in PYTHON_MEDIA_TYPES:
        return "text/x-python"
    if extension in MARKDOWN_EXTENSIONS or declared in MARKDOWN_MEDIA_TYPES:
        return "text/markdown"
    if extension in TEXT_EXTENSIONS or declared in TEXT_MEDIA_TYPES:
        return "text/plain"

    return None


def _validate_file_count(files: list[UploadCandidate], limits: UploadLimits) -> None:
    if not files:
        raise UploadError(
            400,
            "validation_error",
            "At least one upload file is required.",
            [{"field": "files", "rule": "required"}],
        )
    if len(files) > limits.max_files_per_request:
        raise UploadError(413, "upload_too_large", "Upload request includes too many files.")


def _normalize_media_type(value: str | None) -> str | None:
    if not value:
        return None
    return value.split(";", 1)[0].strip().lower() or None


def _looks_like_notebook(content: bytes) -> bool:
    try:
        payload = json.loads(content.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return False
    return isinstance(payload, dict) and "cells" in payload and "nbformat" in payload


def _is_utf8_text(content: bytes) -> bool:
    try:
        content.decode("utf-8")
    except UnicodeDecodeError:
        return False
    return True


def _positive_int_env(name: str, fallback: int) -> int:
    try:
        value = int(os.getenv(name, ""))
    except ValueError:
        return fallback
    return value if value > 0 else fallback
