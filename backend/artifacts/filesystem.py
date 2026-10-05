from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.storage.sqlite import SQLiteRepository
from backend.timing import RunTimingRecorder, measure_stage

WORKSPACE_ROOT_ENV = "WORKSPACE_ROOT"
MANIFEST_SCHEMA_VERSION = 1
SAFE_SEGMENT_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


class ArtifactPathError(ValueError):
    pass


def sanitize_segment(value: str, fallback: str = "untitled") -> str:
    sanitized = SAFE_SEGMENT_PATTERN.sub("-", value.strip()).strip(".-")
    return sanitized[:120] if sanitized else fallback


def _created_at() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _safe_relative_parts(relative_path: str | os.PathLike[str]) -> list[str]:
    path = Path(relative_path)
    if path.is_absolute():
        raise ArtifactPathError("Absolute artifact paths are not allowed.")
    parts: list[str] = []
    for part in path.parts:
        if part in {"", "."}:
            continue
        if part == "..":
            raise ArtifactPathError("Parent path segments are not allowed.")
        parts.append(sanitize_segment(part))
    if not parts:
        raise ArtifactPathError("Artifact path must include a filename.")
    return parts


def _assert_under_root(root: Path, path: Path) -> None:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError as exc:
        raise ArtifactPathError("Artifact path escaped the workspace root.") from exc


@dataclass
class ArtifactRun:
    run_id: str
    intent: str
    root: Path
    run_dir: Path
    model: dict[str, Any]
    search: dict[str, Any]
    revision_of_run_id: str | None = None
    repository: SQLiteRepository | None = None
    timing: RunTimingRecorder | None = None
    created_at: str = field(default_factory=_created_at)
    inputs: list[dict[str, str]] = field(default_factory=list)
    outputs: list[dict[str, str]] = field(default_factory=list)

    def relative_path(self, path: Path) -> str:
        return path.relative_to(self.run_dir).as_posix()

    def write_task(self, task_text: str) -> Path:
        path = self.run_dir / "input" / "task.md"
        _assert_under_root(self.root, path)
        path.write_text(task_text, encoding="utf-8")
        rel_path = self.relative_path(path)
        self.inputs.append({"path": rel_path, "kind": "task"})
        return path

    def write_output(
        self,
        relative_path: str | os.PathLike[str],
        content: str | bytes,
        *,
        kind: str,
        media_type: str | None = None,
    ) -> Path:
        path = self.run_dir / "output" / Path(*_safe_relative_parts(relative_path))
        _assert_under_root(self.root, path)
        path.parent.mkdir(parents=True, exist_ok=True)
        with self._measure_persistence():
            if isinstance(content, bytes):
                path.write_bytes(content)
            else:
                path.write_text(content, encoding="utf-8")
            rel_path = self.relative_path(path)
            self.outputs.append({"path": rel_path, "kind": kind})
            self._record_artifact(path, kind=kind, media_type=media_type)
        return path

    def write_log(self, relative_path: str | os.PathLike[str], content: str) -> Path:
        path = self.run_dir / "logs" / Path(*_safe_relative_parts(relative_path))
        _assert_under_root(self.root, path)
        with self._measure_persistence():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            self._record_artifact(path, kind="log", media_type="text/plain")
        return path

    def write_manifest(self, *, status: str) -> Path:
        path = self.run_dir / "manifest.json"
        _assert_under_root(self.root, path)
        manifest = {
            "schema_version": MANIFEST_SCHEMA_VERSION,
            "run_id": self.run_id,
            "revision_of_run_id": self.revision_of_run_id,
            "intent": self.intent,
            "created_at": self.created_at,
            "model": self.model,
            "search": self.search,
            "inputs": self.inputs,
            "outputs": self.outputs,
            "status": status,
        }
        if self.timing is not None:
            manifest["timings"] = self.timing.manifest_payload()
        path.write_text(json.dumps(manifest, indent=2, sort_keys=True), encoding="utf-8")
        self._record_artifact(path, kind="manifest", media_type="application/json")
        return path

    def timing_log_text(self) -> str:
        return self.timing.log_text() if self.timing is not None else ""

    def _measure_persistence(self):
        return measure_stage(self.timing, "artifact_persistence")

    def _record_artifact(self, path: Path, *, kind: str, media_type: str | None = None) -> None:
        if not self.repository:
            return
        self.repository.create_artifact(
            run_id=self.run_id,
            kind=kind,
            path=str(path.resolve()),
            media_type=media_type,
        )


class ArtifactWriter:
    def __init__(
        self,
        workspace_root: str | os.PathLike[str] | None = None,
        repository: SQLiteRepository | None = None,
    ):
        configured_root = workspace_root or os.getenv(WORKSPACE_ROOT_ENV) or "workspace"
        self.root = Path(configured_root).resolve()
        self.repository = repository
        self.root.mkdir(parents=True, exist_ok=True)

    def start_run(
        self,
        *,
        user_label: str,
        project_title: str,
        run_id: str,
        intent: str,
        task_text: str,
        model: dict[str, Any],
        search: dict[str, Any],
        revision_of_run_id: str | None = None,
    ) -> ArtifactRun:
        run_dir = (
            self.root
            / sanitize_segment(user_label, fallback="local")
            / sanitize_segment(project_title, fallback="project")
            / "runs"
            / sanitize_segment(run_id, fallback="run")
        )
        _assert_under_root(self.root, run_dir)
        for child in ["input/uploads", "output", "logs"]:
            (run_dir / child).mkdir(parents=True, exist_ok=True)

        artifact_run = ArtifactRun(
            run_id=sanitize_segment(run_id, fallback="run"),
            intent=intent,
            root=self.root,
            run_dir=run_dir,
            model=model,
            search=search,
            revision_of_run_id=revision_of_run_id,
            repository=self.repository,
        )
        artifact_run.write_task(task_text)
        return artifact_run


class UploadStore:
    def __init__(self, workspace_root: str | os.PathLike[str] | None = None):
        configured_root = workspace_root or os.getenv(WORKSPACE_ROOT_ENV) or "workspace"
        self.root = Path(configured_root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def write_upload(
        self,
        *,
        user_label: str,
        upload_id: str,
        original_name: str,
        content: bytes,
    ) -> Path:
        path = (
            self.root
            / sanitize_segment(user_label, fallback="local")
            / "uploads"
            / sanitize_segment(upload_id, fallback="upload")
            / sanitize_segment(original_name, fallback="upload.bin")
        )
        _assert_under_root(self.root, path)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path
