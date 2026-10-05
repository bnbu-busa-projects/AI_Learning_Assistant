from __future__ import annotations

import json
import mimetypes
from pathlib import Path
from typing import Any
from urllib.parse import quote

from backend.core.runs import RunError
from backend.storage.sqlite import SQLiteRepository


def list_run_artifacts_for_user(
    repo: SQLiteRepository,
    *,
    run_id: str,
    user_id: str,
) -> dict[str, Any]:
    run, run_root = _owned_run_root(repo, run_id=run_id, user_id=user_id)
    manifest = _read_manifest(run_root)
    recorded = _recorded_artifacts(repo, run=run, run_root=run_root, manifest=manifest)
    artifacts = []
    for relative_path, record in recorded.items():
        file_path = _resolve_under_run_root(run_root, relative_path)
        artifacts.append(
            _artifact_metadata(
                run_id=run_id,
                relative_path=relative_path,
                path=file_path,
                kind=record.get("kind"),
                media_type=record.get("media_type"),
            )
        )

    response: dict[str, Any] = {
        "run_id": run_id,
        "status": run["status"],
        "artifacts": artifacts,
    }
    if manifest is not None:
        response["manifest"] = manifest
    return response


def get_run_artifact_file_for_user(
    repo: SQLiteRepository,
    *,
    run_id: str,
    user_id: str,
    relative_path: str,
) -> tuple[Path, str]:
    run, run_root = _owned_run_root(repo, run_id=run_id, user_id=user_id)
    normalized_path = _normalize_relative_path(relative_path)
    manifest = _read_manifest(run_root)
    recorded = _recorded_artifacts(repo, run=run, run_root=run_root, manifest=manifest)
    if normalized_path not in recorded:
        raise RunError(404, "not_found", "Artifact was not found.")

    file_path = _resolve_under_run_root(run_root, normalized_path)
    if not file_path.is_file():
        raise RunError(404, "not_found", "Artifact was not found.")
    return file_path, _media_type_for_path(file_path, recorded[normalized_path].get("media_type"))


def _owned_run_root(
    repo: SQLiteRepository,
    *,
    run_id: str,
    user_id: str,
) -> tuple[dict[str, Any], Path]:
    run = repo.get_run(run_id)
    if not run or run["user_id"] != user_id:
        raise RunError(404, "not_found", "Run was not found.")
    if not run.get("output_root"):
        raise RunError(404, "not_found", "Run was not found.")
    return run, Path(run["output_root"]).resolve()


def _read_manifest(run_root: Path) -> dict[str, Any] | None:
    manifest_path = run_root / "manifest.json"
    try:
        if not manifest_path.is_file():
            return None
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return manifest if isinstance(manifest, dict) else None


def _recorded_artifacts(
    repo: SQLiteRepository,
    *,
    run: dict[str, Any],
    run_root: Path,
    manifest: dict[str, Any] | None,
) -> dict[str, dict[str, str | None]]:
    records: dict[str, dict[str, str | None]] = {}
    if manifest:
        for section in ("inputs", "outputs"):
            for entry in manifest.get(section) or []:
                if isinstance(entry, dict) and isinstance(entry.get("path"), str):
                    _append_safe_record(
                        records,
                        entry["path"],
                        kind=entry.get("kind") if isinstance(entry.get("kind"), str) else None,
                        media_type=None,
                    )

    for row in repo.list_artifacts_for_run(run["id"]):
        relative_path = _artifact_row_relative_path(row.get("path"), run_root)
        if relative_path:
            _append_safe_record(
                records,
                relative_path,
                kind=row.get("kind") if isinstance(row.get("kind"), str) else None,
                media_type=row.get("media_type") if isinstance(row.get("media_type"), str) else None,
            )
    return records


def _append_safe_record(
    records: dict[str, dict[str, str | None]],
    relative_path: str,
    *,
    kind: str | None,
    media_type: str | None,
) -> None:
    try:
        normalized_path = _normalize_relative_path(relative_path)
    except RunError:
        return
    existing = records.setdefault(normalized_path, {"kind": None, "media_type": None})
    if kind:
        existing["kind"] = kind
    if media_type:
        existing["media_type"] = media_type


def _artifact_row_relative_path(path_value: Any, run_root: Path) -> str | None:
    if not isinstance(path_value, str) or not path_value.strip():
        return None
    path = Path(path_value)
    if not path.is_absolute():
        return path_value
    try:
        return path.resolve().relative_to(run_root.resolve()).as_posix()
    except ValueError:
        return None


def _normalize_relative_path(relative_path: str) -> str:
    if "\\" in relative_path:
        raise RunError(404, "not_found", "Artifact was not found.")
    if relative_path.startswith("/"):
        raise RunError(404, "not_found", "Artifact was not found.")
    parts = relative_path.split("/")
    if not parts or any(part in {"", ".", ".."} for part in parts):
        raise RunError(404, "not_found", "Artifact was not found.")
    return "/".join(parts)


def _resolve_under_run_root(run_root: Path, relative_path: str) -> Path:
    try:
        path = (run_root / relative_path).resolve()
        path.relative_to(run_root.resolve())
    except (OSError, ValueError) as exc:
        raise RunError(404, "not_found", "Artifact was not found.") from exc
    return path


def _artifact_metadata(
    *,
    run_id: str,
    relative_path: str,
    path: Path,
    kind: str | None,
    media_type: str | None,
) -> dict[str, Any]:
    resolved_media_type = _media_type_for_path(path, media_type)
    return {
        "path": relative_path,
        "kind": kind or _kind_for_path(relative_path, resolved_media_type),
        "media_type": resolved_media_type,
        "size_bytes": path.stat().st_size if path.is_file() else None,
        "url": f"/api/runs/{quote(run_id, safe='')}/artifacts/files/{quote(relative_path)}",
    }


def _kind_for_path(relative_path: str, media_type: str) -> str:
    filename = Path(relative_path).name
    if filename == "manifest.json":
        return "manifest"
    if relative_path.startswith("logs/"):
        return "log"
    if media_type == "application/pdf":
        return "pdf"
    if filename.endswith(".ipynb"):
        return "notebook"
    return "source"


def _media_type_for_path(path: Path, media_type: str | None) -> str:
    if media_type:
        return media_type
    guessed, _encoding = mimetypes.guess_type(path.name)
    if guessed:
        return guessed
    return "text/plain"
