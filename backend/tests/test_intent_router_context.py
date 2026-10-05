import json

import pytest

from backend.context.budget import ContextSection, estimate_context_budget
from backend.context.builder import ContextBuildError, build_run_context
from backend.pipelines.router import SUPPORTED_INTENTS, UnsupportedIntentError, route_intent
from backend.storage.sqlite import SQLiteRepository


def test_explicit_intents_route_to_exactly_one_pipeline_target():
    expected_pipelines = {
        "code_homework": "code_homework",
        "essay_latex": "essay_html",
        "beamer_slides": "slides_html",
        "cheat_sheet": "cheat_sheet_html",
    }
    expected_outputs = {
        "code_homework": ("solution.py", "solution.ipynb"),
        "essay_latex": ("main.html", "main.pdf"),
        "beamer_slides": ("slides.html", "slides.pdf"),
        "cheat_sheet": ("cheat-sheet.html", "cheat-sheet.pdf"),
    }
    for intent in SUPPORTED_INTENTS:
        decision = route_intent(intent)

        assert decision.requested_intent == intent
        assert decision.resolved_intent == intent
        assert decision.target.intent == intent
        assert decision.target.pipeline == expected_pipelines[intent]
        assert decision.target.primary_outputs == expected_outputs[intent]


def test_router_rejects_auto_or_missing_intent():
    with pytest.raises(UnsupportedIntentError):
        route_intent("auto")

    with pytest.raises(UnsupportedIntentError):
        route_intent(None)


def test_context_estimator_reports_warning_levels():
    ok = estimate_context_budget(
        [ContextSection(name="task", text="x" * 600, kind="code")],
        intent="code_homework",
        context_window_limit=10000,
    )
    warning = estimate_context_budget(
        [ContextSection(name="task", text="x" * 600, kind="code")],
        intent="code_homework",
        context_window_limit=6000,
    )
    critical = estimate_context_budget(
        [ContextSection(name="task", text="x" * 1000, kind="code")],
        intent="code_homework",
        context_window_limit=5000,
    )

    assert ok.warning_level == "ok"
    assert warning.warning_level == "warning"
    assert warning.utilization_ratio == pytest.approx(0.70)
    assert critical.warning_level == "critical"
    assert critical.safety_margin_tokens > 0


def test_context_builder_extracts_text_notebook_and_pdf_metadata(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "context.sqlite")
    markdown_path = tmp_path / "reference.md"
    markdown_path.write_text("Reference notes about dynamic programming.", encoding="utf-8")
    notebook_path = tmp_path / "reference.ipynb"
    notebook_path.write_text(
        """
{
  "cells": [
    {
      "id": "markdown-1",
      "cell_type": "markdown",
      "metadata": {},
      "source": ["# Notebook brief"]
    },
    {
      "id": "code-1",
      "cell_type": "code",
      "execution_count": null,
      "metadata": {},
      "outputs": [],
      "source": ["def solve():\\n    return 42"]
    }
  ],
  "metadata": {},
  "nbformat": 4,
  "nbformat_minor": 5
}
""".strip(),
        encoding="utf-8",
    )
    pdf_path = tmp_path / "slides.pdf"
    _write_blank_pdf(pdf_path)

    repo.create_upload(
        id="upload-md",
        original_name="reference.md",
        media_type="text/markdown",
        stored_path=str(markdown_path),
        sha256="0" * 64,
        size_bytes=markdown_path.stat().st_size,
    )
    repo.create_upload(
        id="upload-nb",
        original_name="reference.ipynb",
        media_type="application/json",
        stored_path=str(notebook_path),
        sha256="1" * 64,
        size_bytes=notebook_path.stat().st_size,
    )
    repo.create_upload(
        id="upload-pdf",
        original_name="slides.pdf",
        media_type="application/pdf",
        stored_path=str(pdf_path),
        sha256="2" * 64,
        size_bytes=pdf_path.stat().st_size,
    )

    prepared = build_run_context(
        repo,
        task_text="Write a homework solution.",
        intent="code_homework",
        search_mode="off",
        upload_ids=["upload-md", "upload-nb", "upload-pdf"],
        context_window_limit=16000,
    )

    assert "Reference notes about dynamic programming." in prepared.context_bundle
    assert "[Markdown Cell 1]" in prepared.context_bundle
    assert "[Code Cell 2]" in prepared.context_bundle
    pdf_summary = next(upload for upload in prepared.uploads if upload.id == "upload-pdf")
    assert "PDF contained no extractable text." in pdf_summary.notes
    assert prepared.estimate.source == "heuristic"
    assert prepared.search_policy.mode == "off"
    assert prepared.search_policy.decision == "off_disabled"
    assert prepared.search_policy.should_search is False


def test_context_builder_rejects_missing_upload_id(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "context.sqlite")

    with pytest.raises(ContextBuildError) as exc_info:
        build_run_context(
            repo,
            task_text="Use this missing file.",
            intent="essay_latex",
            search_mode="auto",
            upload_ids=["missing-upload"],
        )

    assert exc_info.value.code == "not_found"
    assert exc_info.value.status_code == 400


def test_context_builder_marks_oversized_estimate_as_critical(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "context.sqlite")

    prepared = build_run_context(
        repo,
        task_text="Short task.",
        intent="essay_latex",
        search_mode="auto",
        context_window_limit=5000,
    )

    assert prepared.estimate.warning_level == "critical"
    assert prepared.estimate.safety_margin_tokens < 0
    assert prepared.search_policy.mode == "auto"
    assert prepared.search_policy.decision == "auto_use_search"
    assert prepared.search_policy.should_search is True


def test_revision_context_budget_scales_with_profile_window(tmp_path):
    repo = SQLiteRepository.from_path(tmp_path / "context.sqlite")
    user = repo.create_user(
        id="user-1",
        email="teacher@bnbu.edu.cn",
        role="teacher",
        password_hash="hash",
    )
    run_root = tmp_path / "workspace" / "run-1"
    output_dir = run_root / "output"
    logs_dir = run_root / "logs"
    output_dir.mkdir(parents=True)
    logs_dir.mkdir(parents=True)
    source_text = "print('prior line')\n" * 3000 + "\nLARGE_WINDOW_TAIL_MARKER\n"
    (output_dir / "solution.py").write_text(source_text, encoding="utf-8")
    (logs_dir / "generation.log").write_text(
        "safe log line\n" * 2000 + "LARGE_LOG_TAIL_MARKER\n",
        encoding="utf-8",
    )
    (run_root / "manifest.json").write_text(
        json.dumps(
            {
                "schema_version": 1,
                "run_id": "prior-run",
                "intent": "code_homework",
                "status": "succeeded",
                "outputs": [{"path": "output/solution.py", "kind": "script"}],
            }
        ),
        encoding="utf-8",
    )
    repo.create_run(
        id="prior-run",
        user_id=user["id"],
        intent="code_homework",
        task_text="Write a solution.",
        search_mode="off",
        status="succeeded",
        output_root=str(run_root),
    )

    conservative = build_run_context(
        repo,
        task_text="Refine the solution.",
        intent="code_homework",
        search_mode="off",
        revision_of_run_id="prior-run",
        user_id=user["id"],
        context_window_limit=128000,
    )
    expanded = build_run_context(
        repo,
        task_text="Refine the solution.",
        intent="code_homework",
        search_mode="off",
        revision_of_run_id="prior-run",
        user_id=user["id"],
        context_window_limit=1000000,
    )

    assert "LARGE_WINDOW_TAIL_MARKER" not in conservative.context_bundle
    assert "Truncated prior generated source to 12000 characters" in conservative.context_bundle
    assert "LARGE_WINDOW_TAIL_MARKER" in expanded.context_bundle
    assert "LARGE_LOG_TAIL_MARKER" not in expanded.context_bundle
    assert expanded.estimate.context_window_limit == 1000000
    assert expanded.estimate.section_breakdown["revision:prior-run"] > (
        conservative.estimate.section_breakdown["revision:prior-run"]
    )


def _write_blank_pdf(path):
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    with path.open("wb") as file:
        writer.write(file)
