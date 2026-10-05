import json
from pathlib import Path

import nbformat

from backend.core.runs import create_run, make_run_executor
from backend.providers.base import ModelProviderError
from backend.storage.sqlite import SQLiteRepository


class FakeModelProvider:
    def __init__(self, output: str = "", error: ModelProviderError | None = None):
        self.output = output
        self.error = error
        self.requests = []

    def generate_text(self, request):
        self.requests.append(request)
        if self.error:
            raise self.error
        return self.output


class NoopSearchAdapter:
    def search(self, query: str, *, max_results: int = 3):
        raise AssertionError("search should not run in these tests")


def test_code_homework_pipeline_writes_python_script(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    provider = FakeModelProvider(
        "```python\n"
        "def solve():\n"
        "    return 42\n\n"
        "if __name__ == '__main__':\n"
        "    print(solve())\n"
        "```"
    )

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a tiny Python solution.",
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
    solution = output_root / "output" / "solution.py"
    assert solution.read_text(encoding="utf-8").startswith("def solve():")
    assert provider.requests[0].profile["provider"] == "openai_compatible"
    assert "[Assignment Task]" in provider.requests[0].user_prompt

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "succeeded"
    assert {"path": "output/solution.py", "kind": "script"} in manifest["outputs"]

    artifact_kinds = {row["kind"] for row in repo.list_artifacts_for_run(body["id"])}
    assert {"script", "log", "manifest"}.issubset(artifact_kinds)


def test_code_homework_pipeline_writes_valid_notebook(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    notebook = nbformat.v4.new_notebook(
        cells=[
            nbformat.v4.new_markdown_cell("# Solution"),
            nbformat.v4.new_code_cell("print(42)"),
        ]
    )
    provider = FakeModelProvider("```json\n" + nbformat.writes(notebook) + "\n```")

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write the solution as a notebook.",
            "intent": "code_homework",
            "output_preference": "ipynb",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "succeeded"
    output_root = Path(body["output_root"])
    notebook_path = output_root / "output" / "solution.ipynb"
    loaded = nbformat.reads(notebook_path.read_text(encoding="utf-8"), as_version=4)
    nbformat.validate(loaded)
    assert loaded.cells[0].source == "# Solution"

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert {"path": "output/solution.ipynb", "kind": "notebook"} in manifest["outputs"]


def test_code_homework_pipeline_failure_preserves_log_and_intermediate(tmp_path):
    repo, user = _repo_with_user(tmp_path)
    provider = FakeModelProvider("```json\n{\"cells\": [\n```")

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write an invalid notebook for testing.",
            "intent": "code_homework",
            "output_preference": "ipynb",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "failed"
    assert body["error_message"] == "compile_failed: Generated notebook was not valid nbformat JSON."
    output_root = Path(body["output_root"])
    assert (output_root / "output" / "solution.ipynb").exists()

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "failed"
    assert {"path": "output/solution.ipynb", "kind": "notebook"} in manifest["outputs"]

    log_text = (output_root / "logs" / "generation.log").read_text(encoding="utf-8")
    assert "compile_failed" in log_text
    assert "Traceback" not in log_text


def test_default_code_executor_marks_missing_key_without_live_provider_call(tmp_path, monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.setenv("MODEL_SECRET_FILE", str(tmp_path / "missing.env"))
    repo, user = _repo_with_user(tmp_path)

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a Python solution.",
            "intent": "code_homework",
            "output_preference": "py",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        search_adapter=NoopSearchAdapter(),
    )

    assert body["status"] == "failed"
    assert body["error_message"] == "missing_api_key: No model API key is configured."
    output_root = Path(body["output_root"])
    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "failed"


def _repo_with_user(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "app.sqlite")
    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash",
    )
    return repo, user
