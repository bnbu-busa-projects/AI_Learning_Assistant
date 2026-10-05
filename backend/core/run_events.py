from __future__ import annotations

from dataclasses import dataclass
from threading import RLock
from typing import Any

from backend.context.budget import ContextEstimate

TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}
CONTEXT_EVENT_KEYS = (
    "estimated_input_tokens",
    "estimated_output_tokens",
    "estimated_total_tokens",
    "context_window_limit",
    "utilization_ratio",
    "warning_level",
    "source",
)


@dataclass(frozen=True)
class RunStatusEvent:
    run_id: str
    status: str
    stage: str
    message: str
    context: dict[str, Any] | None = None
    timings: dict[str, int] | None = None
    error: dict[str, str] | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "run_id": self.run_id,
            "status": self.status,
            "stage": self.stage,
            "message": self.message,
        }
        if self.context is not None:
            payload["context"] = self.context
        if self.timings is not None:
            payload["timings"] = self.timings
        if self.error is not None:
            payload["error"] = self.error
        return payload


class RunEventStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self._events: dict[str, list[RunStatusEvent]] = {}

    def emit(self, event: RunStatusEvent) -> RunStatusEvent:
        with self._lock:
            self._events.setdefault(event.run_id, []).append(event)
        return event

    def latest(self, run_id: str) -> RunStatusEvent | None:
        with self._lock:
            events = self._events.get(run_id) or []
            return events[-1] if events else None

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


default_run_event_store = RunEventStore()


def emit_run_event(
    *,
    run_id: str,
    status: str,
    stage: str,
    message: str,
    context: ContextEstimate | dict[str, Any] | None = None,
    timings: dict[str, int] | None = None,
    error: dict[str, str] | None = None,
    store: RunEventStore = default_run_event_store,
) -> RunStatusEvent:
    event = RunStatusEvent(
        run_id=run_id,
        status=status,
        stage=stage,
        message=message,
        context=context_event_payload(context),
        timings=dict(timings) if timings is not None else None,
        error=error,
    )
    return store.emit(event)


def latest_event_for_run(
    run: dict[str, Any],
    *,
    store: RunEventStore = default_run_event_store,
) -> RunStatusEvent:
    latest = store.latest(run["id"])
    if latest and _event_matches_run(latest, run):
        return latest
    return fallback_event_for_run(run)


def context_event_payload(
    context: ContextEstimate | dict[str, Any] | None,
) -> dict[str, Any] | None:
    if context is None:
        return None
    raw = context.to_dict() if hasattr(context, "to_dict") else dict(context)
    return {key: raw[key] for key in CONTEXT_EVENT_KEYS if key in raw}


def fallback_event_for_run(run: dict[str, Any]) -> RunStatusEvent:
    status = run["status"]
    if status == "queued":
        return RunStatusEvent(
            run_id=run["id"],
            status=status,
            stage="queued",
            message="Run is queued.",
        )
    if status == "running":
        return RunStatusEvent(
            run_id=run["id"],
            status=status,
            stage="running",
            message="Run is running.",
        )
    if status == "succeeded":
        return RunStatusEvent(
            run_id=run["id"],
            status=status,
            stage="write_manifest",
            message="Run succeeded.",
        )
    if status == "failed":
        error = _error_from_message(run.get("error_message"))
        return RunStatusEvent(
            run_id=run["id"],
            status=status,
            stage="failed",
            message=error["message"] if error else "Run failed.",
            error=error,
        )
    return RunStatusEvent(
        run_id=run["id"],
        status=status,
        stage="cancelled",
        message="Run was cancelled.",
    )


def _event_matches_run(event: RunStatusEvent, run: dict[str, Any]) -> bool:
    run_status = run["status"]
    if run_status in TERMINAL_STATUSES:
        return event.status == run_status
    return event.status == run_status


def _error_from_message(error_message: str | None) -> dict[str, str] | None:
    if not error_message:
        return None
    code, separator, message = error_message.partition(": ")
    if not separator:
        return {"code": "internal_error", "message": error_message}
    return {"code": code, "message": message}
