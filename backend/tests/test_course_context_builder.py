import json
from pathlib import Path

from backend.context.builder import build_run_context
from backend.core.runs import create_run, make_run_executor
from backend.providers.base import TextGenerationRequest
from backend.storage.sqlite import SQLiteRepository


class FakeModelProvider:
    def __init__(self, output: str):
        self.output = output
        self.requests: list[TextGenerationRequest] = []

    def generate_text(self, request: TextGenerationRequest) -> str:
        self.requests.append(request)
        return self.output


class NoopSearchAdapter:
    def search(self, query: str, *, max_results: int = 3):
        raise AssertionError("search should not run in these tests")


def test_non_default_course_summary_is_included_and_counted(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    context_path = (
        tmp_path
        / "workspace"
        / "teacher"
        / "Machine-Learning"
        / "context"
        / "course_context.md"
    )
    context_path.parent.mkdir(parents=True)
    context_path.write_text(
        "# Course Context\n\n## Concepts\n- Logistic regression and regularization.\n",
        encoding="utf-8",
    )
    course = repo.create_project(
        user_id=user["id"],
        title="Machine Learning",
        root_path="workspace/courses/ml",
        context_enabled=True,
        context_path=str(context_path),
    )

    prepared = build_run_context(
        repo,
        task_text="Write a classifier homework solution.",
        intent="code_homework",
        search_mode="off",
        user_id=user["id"],
        course=course,
        context_window_limit=32000,
    )

    assert "[Course Context]" in prepared.context_bundle
    assert "Logistic regression and regularization" in prepared.context_bundle
    assert prepared.course_context == {
        "course_id": course["id"],
        "included": True,
        "chars": len("# Course Context\n\n## Concepts\n- Logistic regression and regularization."),
    }
    assert prepared.estimate.section_breakdown[f"course_context:{course['id']}"] > 0


def test_default_course_never_includes_context_even_when_file_exists(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    default_course = repo.get_or_create_default_project(user["id"])
    context_path = tmp_path / "course_context.md"
    context_path.write_text("SHOULD_NOT_APPEAR", encoding="utf-8")
    default_course = repo.update_project(
        default_course["id"],
        context_path=str(context_path),
        context_updated_at="2026-06-09T00:00:00Z",
    )

    prepared = build_run_context(
        repo,
        task_text="Write a general answer.",
        intent="essay_latex",
        search_mode="off",
        user_id=user["id"],
        course=default_course,
        context_window_limit=32000,
    )

    assert "SHOULD_NOT_APPEAR" not in prepared.context_bundle
    assert prepared.course_context is None
    assert not any(
        name.startswith("course_context:")
        for name in prepared.estimate.section_breakdown
    )


def test_successful_non_default_course_run_updates_compact_sanitized_summary(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    course = repo.create_project(
        user_id=user["id"],
        title="Machine Learning",
        root_path="workspace/courses/ml",
        context_enabled=True,
    )
    upload_path = tmp_path / "lecture.md"
    upload_path.write_text(
        "Raw upload text should not be copied. SECRET_UPLOAD_DO_NOT_STORE " * 80,
        encoding="utf-8",
    )
    upload = repo.create_upload(
        id="upload-1",
        user_id=user["id"],
        original_name="lecture.md",
        media_type="text/markdown",
        stored_path=str(upload_path),
        sha256="0" * 64,
        size_bytes=upload_path.stat().st_size,
    )
    provider = FakeModelProvider(
        "API_KEY = 'SHOULD_NOT_BE_IN_CONTEXT'\n"
        "def solve():\n"
        "    return 'course context output'\n"
    )
    long_prompt = (
        "Write dynamic programming homework with memoization. "
        "SECRET_PROMPT_DO_NOT_STORE "
        + "verbatim prompt text " * 500
    )

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": long_prompt,
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
            "course_id": course["id"],
            "upload_ids": [upload["id"]],
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "succeeded"
    updated_course = repo.get_project(course["id"])
    assert updated_course["context_path"]
    assert updated_course["context_updated_at"]
    context_path = Path(updated_course["context_path"])
    assert context_path.exists()
    summary = context_path.read_text(encoding="utf-8")
    assert len(summary) <= 8192
    assert "dynamic" in summary
    assert "programming" in summary
    assert "memoization" in summary
    assert "lecture.md" in summary
    assert "output/solution.py" in summary
    assert "Raw upload text should not be copied" not in summary
    assert "SECRET_UPLOAD_DO_NOT_STORE" not in summary
    assert "SECRET_PROMPT_DO_NOT_STORE" not in summary
    assert "secret_prompt_do_not_store" not in summary
    assert "SHOULD_NOT_BE_IN_CONTEXT" not in summary
    assert "verbatim prompt text" not in summary

    manifest = json.loads(
        (Path(body["output_root"]) / "manifest.json").read_text(encoding="utf-8")
    )
    timing_names = {entry["name"] for entry in manifest["timings"]["stages"]}
    assert "course_context_update" in timing_names


def _repo_with_user(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "app.sqlite")
    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash",
    )
    return repo, user
