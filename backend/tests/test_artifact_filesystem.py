import json
from pathlib import Path

import pytest

from backend.artifacts.filesystem import ArtifactPathError, ArtifactWriter
from backend.storage.sqlite import SQLiteRepository


def test_writer_creates_contract_folder_shape_and_manifest(tmp_path):
    writer = ArtifactWriter(tmp_path / "workspace")

    run = writer.start_run(
        user_label="Professor@BNBU.edu.cn",
        project_title="CS 101 / Intro",
        run_id="run-1",
        intent="essay_latex",
        task_text="Write an essay.",
        model={"provider": "openai_compatible", "model": "qwen-placeholder"},
        search={"mode": "auto", "used": False, "citations": []},
    )
    output_path = run.write_output(
        "Main Answer!.html",
        "<!doctype html><html><body>Answer</body></html>",
        kind="source",
    )
    log_path = run.write_log("generation.log", "started\n")
    manifest_path = run.write_manifest(status="succeeded")

    assert run.run_dir == tmp_path / "workspace" / "Professor-BNBU.edu.cn" / "CS-101-Intro" / "runs" / "run-1"
    assert (run.run_dir / "input" / "task.md").read_text(encoding="utf-8") == "Write an essay."
    assert (run.run_dir / "input" / "uploads").is_dir()
    assert output_path.exists()
    assert output_path.name == "Main-Answer-.html"
    assert log_path.exists()

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["schema_version"] == 1
    assert manifest["run_id"] == "run-1"
    assert manifest["revision_of_run_id"] is None
    assert manifest["intent"] == "essay_latex"
    assert manifest["inputs"] == [{"path": "input/task.md", "kind": "task"}]
    assert manifest["outputs"] == [{"path": "output/Main-Answer-.html", "kind": "source"}]
    assert manifest["status"] == "succeeded"


def test_writer_rejects_path_traversal(tmp_path):
    writer = ArtifactWriter(tmp_path / "workspace")
    run = writer.start_run(
        user_label="local",
        project_title="Project",
        run_id="run-1",
        intent="code_homework",
        task_text="Write code.",
        model={"provider": "openai_compatible", "model": "qwen-placeholder"},
        search={"mode": "off", "used": False, "citations": []},
    )

    with pytest.raises(ArtifactPathError):
        run.write_output("../escape.py", "print('no')", kind="script")

    with pytest.raises(ArtifactPathError):
        run.write_log(Path("/tmp/escape.log"), "no")

    assert not (tmp_path / "escape.py").exists()


def test_writer_records_sqlite_artifact_rows(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "app.sqlite")
    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash",
    )
    project = repo.create_project(
        id="project-1",
        user_id=user["id"],
        title="Project",
        root_path=str(tmp_path / "workspace"),
    )
    run_row = repo.create_run(
        id="run-1",
        project_id=project["id"],
        user_id=user["id"],
        intent="code_homework",
        task_text="Write code.",
        search_mode="off",
        status="queued",
    )
    writer = ArtifactWriter(tmp_path / "workspace", repository=repo)

    run = writer.start_run(
        user_label=user["email"],
        project_title=project["title"],
        run_id=run_row["id"],
        intent="code_homework",
        task_text=run_row["task_text"],
        model={"provider": "openai_compatible", "model": "qwen-placeholder"},
        search={"mode": "off", "used": False, "citations": []},
    )
    run.write_output("solution.py", "print('hello')\n", kind="script", media_type="text/x-python")
    run.write_manifest(status="succeeded")

    rows = repo.list_artifacts_for_run("run-1")
    kinds = {row["kind"] for row in rows}
    assert {"script", "manifest"} == kinds
    assert all(Path(row["path"]).exists() for row in rows)


def test_writer_records_revision_id_in_manifest(tmp_path):
    writer = ArtifactWriter(tmp_path / "workspace")

    run = writer.start_run(
        user_label="teacher@bnbu.edu.cn",
        project_title="Project",
        run_id="run-2",
        intent="code_homework",
        task_text="Refine the previous code.",
        model={"provider": "openai_compatible", "model": "qwen-placeholder"},
        search={"mode": "off", "used": False, "citations": []},
        revision_of_run_id="run-1",
    )
    manifest_path = run.write_manifest(status="succeeded")

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["run_id"] == "run-2"
    assert manifest["revision_of_run_id"] == "run-1"
