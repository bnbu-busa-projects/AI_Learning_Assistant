import json
from pathlib import Path

from backend.core.run_events import default_run_event_store
from backend.core.runs import create_run, make_run_executor
from backend.pipelines.html_to_pdf import ConvertError, ConvertResult
from backend.storage.sqlite import SQLiteRepository
from backend.timing import RunTimingRecorder


class FakeClock:
    def __init__(self):
        self.value = 10.0

    def __call__(self):
        return self.value

    def advance(self, seconds: float):
        self.value += seconds


class FakeModelProvider:
    def __init__(self, outputs: str | list[str]):
        self.outputs = outputs if isinstance(outputs, list) else [outputs]
        self.requests = []

    def generate_text(self, request):
        self.requests.append(request)
        return self.outputs[min(len(self.requests) - 1, len(self.outputs) - 1)]


class FakePdfConverter:
    def __init__(self, errors: list[ConvertError | None] | None = None):
        self.errors = errors or [None]
        self.calls = 0

    def convert(self, *, html_path: Path, pdf_path: Path, page_config):
        self.calls += 1
        error = self.errors[min(self.calls - 1, len(self.errors) - 1)]
        if error is not None:
            raise error
        assert html_path.exists()
        pdf_path.write_bytes(b"%PDF-1.4\n% timing test\n")
        return ConvertResult(pdf_path=pdf_path, log_text="convert ok\n")


class NoopSearchAdapter:
    def search(self, query: str, *, max_results: int = 3):
        raise AssertionError("search should not run")


def test_timing_recorder_uses_monotonic_clock_and_accumulates_stages():
    clock = FakeClock()
    timing = RunTimingRecorder(clock=clock)

    with timing.measure("provider_generation"):
        clock.advance(1.25)
    with timing.measure("provider_generation"):
        clock.advance(0.25)
    clock.advance(0.5)

    assert timing.manifest_payload() == {
        "total_ms": 2000,
        "stages": [{"name": "provider_generation", "duration_ms": 1500}],
    }
    assert timing.event_payload("provider_generation") == {
        "elapsed_ms": 2000,
        "stage_ms": 1500,
    }


def test_code_run_persists_provider_and_local_stage_timings(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    default_run_event_store.clear()
    provider = FakeModelProvider("def answer():\n    return 42\n")

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a small Python answer.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "succeeded"
    output_root = Path(body["output_root"])
    manifest = _read_manifest(output_root)
    stages = _stage_map(manifest)
    assert {
        "preparation_context",
        "search",
        "provider_generation",
        "output_validation",
        "artifact_persistence",
    }.issubset(stages)
    assert all(duration >= 0 for duration in stages.values())
    assert manifest["timings"]["total_ms"] >= 0

    generation_log = (output_root / "logs" / "generation.log").read_text(
        encoding="utf-8"
    )
    assert "Timing provider_generation_ms:" in generation_log
    assert "Write a small Python answer." not in generation_log

    event = default_run_event_store.latest(body["id"])
    assert event is not None
    event_body = event.to_dict()
    assert event_body["timings"]["elapsed_ms"] >= 0
    assert event_body["timings"]["stage_ms"] >= 0


def test_pdf_run_records_provider_and_conversion_timings(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    provider = FakeModelProvider(
        "<!doctype html><html><body><h1>Timing</h1></body></html>"
    )
    converter = FakePdfConverter()

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a short essay.",
            "intent": "essay_latex",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=converter),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "succeeded"
    stages = _stage_map(_read_manifest(Path(body["output_root"])))
    assert "provider_generation" in stages
    assert "convert_pdf" in stages
    assert "artifact_persistence" in stages
    assert converter.calls == 1
    assert len(provider.requests) == 1


def test_failed_pdf_run_keeps_completed_stage_timings(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    provider = FakeModelProvider(
        "<!doctype html><html><body><h1>Timing failure</h1></body></html>"
    )
    convert_error = ConvertError(
        "HTML-to-PDF conversion failed.",
        log_text="conversion failed\n",
    )
    converter = FakePdfConverter([convert_error])

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write an essay that exercises failure timing.",
            "intent": "essay_latex",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=converter),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "failed"
    manifest = _read_manifest(Path(body["output_root"]))
    assert manifest["status"] == "failed"
    stages = _stage_map(manifest)
    assert "provider_generation" in stages
    assert "convert_pdf" in stages
    assert "artifact_persistence" in stages


def _read_manifest(output_root: Path) -> dict[str, object]:
    return json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))


def _stage_map(manifest: dict[str, object]) -> dict[str, int]:
    return {
        stage["name"]: stage["duration_ms"]
        for stage in manifest["timings"]["stages"]
    }


def _repo_with_user(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "app.sqlite")
    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash",
    )
    return repo, user
