import json
from pathlib import Path

from backend.core.runs import create_run, make_run_executor
from backend.providers.base import ModelProviderError


ESSAY_HTML = """```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>@page { size: A4; margin: 20mm; } body { font-family: serif; }</style>
</head>
<body><article><h1>Answer</h1><p>A concise essay.</p></article></body>
</html>
```"""


def test_essay_html_pipeline_writes_source_and_converted_pdf(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    mock_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    provider = fake_model_provider_factory(ESSAY_HTML)

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a short essay.",
            "intent": "essay_latex",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=mock_pdf_converter),
        search_adapter=noop_search_adapter,
    )

    assert body["status"] == "succeeded"
    output_root = Path(body["output_root"])
    assert (output_root / "output" / "main.html").read_text(
        encoding="utf-8"
    ).startswith("<!doctype html>")
    assert (output_root / "output" / "main.pdf").read_bytes().startswith(b"%PDF")
    assert (output_root / "logs" / "convert.log").read_text(encoding="utf-8") == (
        "mock convert OK\n"
    )
    assert mock_pdf_converter.calls[0]["html_path"] == output_root / "output" / "main.html"
    assert mock_pdf_converter.calls[0]["pdf_path"] == output_root / "output" / "main.pdf"
    assert mock_pdf_converter.calls[0]["page_config"].width == "210mm"
    assert "self-contained HTML document" in provider.requests[0].user_prompt
    assert "remote HTTP(S) assets" in provider.requests[0].user_prompt

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "succeeded"
    assert {"path": "output/main.html", "kind": "source"} in manifest["outputs"]
    assert {"path": "output/main.pdf", "kind": "pdf"} in manifest["outputs"]

    artifact_kinds = {row["kind"] for row in repo.list_artifacts_for_run(body["id"])}
    assert {"source", "pdf", "log", "manifest"}.issubset(artifact_kinds)


def test_essay_html_pipeline_conversion_failure_preserves_source_log_and_manifest(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    failing_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    provider = fake_model_provider_factory(ESSAY_HTML)

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a short essay with a conversion failure.",
            "intent": "essay_latex",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=failing_pdf_converter),
        search_adapter=noop_search_adapter,
    )

    assert body["status"] == "failed"
    assert body["error_message"] == "convert_failed: Mock conversion failure"
    output_root = Path(body["output_root"])
    assert (output_root / "output" / "main.html").exists()
    assert not (output_root / "output" / "main.pdf").exists()
    assert (output_root / "logs" / "convert.log").read_text(encoding="utf-8") == (
        "mock error log\n"
    )

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "failed"
    assert {"path": "output/main.html", "kind": "source"} in manifest["outputs"]
    assert {"path": "output/main.pdf", "kind": "pdf"} not in manifest["outputs"]

    generation_log = (output_root / "logs" / "generation.log").read_text(
        encoding="utf-8"
    )
    assert "convert_failed" in generation_log
    assert "Traceback" not in generation_log


def test_essay_html_pipeline_model_provider_failure_preserves_log_and_manifest(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    mock_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    provider = fake_model_provider_factory(
        error=ModelProviderError("provider_unavailable", "Provider is offline.")
    )

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Write a short essay while provider is unavailable.",
            "intent": "essay_latex",
            "search_mode": "off",
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=mock_pdf_converter),
        search_adapter=noop_search_adapter,
    )

    assert body["status"] == "failed"
    assert body["error_message"] == "provider_unavailable: Provider is offline."
    output_root = Path(body["output_root"])
    assert not (output_root / "output" / "main.html").exists()
    assert not mock_pdf_converter.calls

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "failed"
    assert manifest["outputs"] == []
