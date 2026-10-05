from __future__ import annotations

from contextlib import contextmanager, nullcontext
from threading import RLock
from time import perf_counter
from typing import Callable, Iterator


class RunTimingRecorder:
    def __init__(self, *, clock: Callable[[], float] = perf_counter):
        self._clock = clock
        self._started_at = clock()
        self._durations_ms: dict[str, float] = {}
        self._lock = RLock()

    @contextmanager
    def measure(self, stage: str) -> Iterator[None]:
        started_at = self._clock()
        try:
            yield
        finally:
            duration_ms = max(0.0, (self._clock() - started_at) * 1000)
            with self._lock:
                self._durations_ms[stage] = self._durations_ms.get(stage, 0.0) + duration_ms

    def elapsed_ms(self) -> int:
        return _rounded_ms(max(0.0, (self._clock() - self._started_at) * 1000))

    def stage_ms(self, stage: str) -> int:
        with self._lock:
            return _rounded_ms(self._durations_ms.get(stage, 0.0))

    def event_payload(self, stage: str) -> dict[str, int]:
        return {
            "elapsed_ms": self.elapsed_ms(),
            "stage_ms": self.stage_ms(stage),
        }

    def manifest_payload(self) -> dict[str, object]:
        with self._lock:
            stages = [
                {"name": name, "duration_ms": _rounded_ms(duration_ms)}
                for name, duration_ms in self._durations_ms.items()
            ]
        return {
            "total_ms": self.elapsed_ms(),
            "stages": stages,
        }

    def log_text(self) -> str:
        payload = self.manifest_payload()
        lines = [f"Timing total_ms: {payload['total_ms']}"]
        lines.extend(
            f"Timing {stage['name']}_ms: {stage['duration_ms']}"
            for stage in payload["stages"]
        )
        return "\n".join(lines) + "\n"


def _rounded_ms(value: float) -> int:
    return max(0, int(round(value)))


def measure_stage(timing: RunTimingRecorder | None, stage: str):
    return timing.measure(stage) if timing is not None else nullcontext()
