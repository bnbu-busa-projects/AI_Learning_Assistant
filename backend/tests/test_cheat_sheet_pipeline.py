import json
from pathlib import Path

import pytest

from backend.core.runs import RunError, create_run, make_run_executor
from backend.pipelines.html_to_pdf import A4_NO_MARGIN
from backend.providers.base import ModelProviderError
from backend.storage.sqlite import SQLiteRepository


CHEAT_SHEET_HTML = """```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 8mm; }
    main { column-count: 4; column-gap: 8px; font-size: 10px; }
    section { break-inside: avoid; }
  </style>
</head>
<body><main><section><h1>Optimization</h1><p>Gradient descent.</p></section></main></body>
</html>
```"""


def test_cheat_sheet_html_pipeline_accepts_multiple_pdfs_and_converts_pdf(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    mock_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    lecture_one = tmp_path / "lecture-01.pdf"
    lecture_two = tmp_path / "lecture-02.pdf"
    _write_text_pdf(lecture_one, "Lecture one covers gradient descent.")
    _write_text_pdf(lecture_two, "Lecture two covers dynamic programming.")
    _create_pdf_upload(repo, "upload-1", lecture_one)
    _create_pdf_upload(repo, "upload-2", lecture_two)

    provider = fake_model_provider_factory(CHEAT_SHEET_HTML)

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Compress these lecture slides into a dense study sheet.",
            "intent": "cheat_sheet",
            "search_mode": "off",
            "upload_ids": ["upload-1", "upload-2"],
            "options": {"target_pages": 2, "paper_size": "A4", "density": "dense"},
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=mock_pdf_converter),
        search_adapter=noop_search_adapter,
    )

    assert body["status"] == "succeeded"
    output_root = Path(body["output_root"])
    source = (output_root / "output" / "cheat-sheet.html").read_text(encoding="utf-8")
    assert source.startswith("<!doctype html>")
    assert "column-count" in source
    assert (output_root / "output" / "cheat-sheet.pdf").read_bytes().startswith(b"%PDF")
    assert (output_root / "logs" / "convert.log").read_text(encoding="utf-8") == (
        "mock convert OK\n"
    )
    assert mock_pdf_converter.calls[0]["html_path"] == (
        output_root / "output" / "cheat-sheet.html"
    )
    assert mock_pdf_converter.calls[0]["pdf_path"] == (
        output_root / "output" / "cheat-sheet.pdf"
    )
    assert mock_pdf_converter.calls[0]["page_config"] == A4_NO_MARGIN

    user_prompt = provider.requests[0].user_prompt
    assert "Lecture one covers gradient descent." in user_prompt
    assert "Lecture two covers dynamic programming." in user_prompt
    assert "targeting exactly 2 A4 page(s)" in user_prompt
    assert "self-contained HTML document" in user_prompt

    extraction_log = (output_root / "logs" / "extraction.log").read_text(
        encoding="utf-8"
    )
    assert "Upload count: 2" in extraction_log
    assert "lecture-01.pdf" in extraction_log
    assert "lecture-02.pdf" in extraction_log
    assert "Notes: none" in extraction_log

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["intent"] == "cheat_sheet"
    assert manifest["status"] == "succeeded"
    assert {"path": "output/cheat-sheet.html", "kind": "source"} in manifest["outputs"]
    assert {"path": "output/cheat-sheet.pdf", "kind": "pdf"} in manifest["outputs"]

    artifact_kinds = {row["kind"] for row in repo.list_artifacts_for_run(body["id"])}
    assert {"source", "pdf", "log", "manifest"}.issubset(artifact_kinds)


def test_cheat_sheet_pipeline_rejects_missing_target_pages(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    mock_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    provider = fake_model_provider_factory(CHEAT_SHEET_HTML)

    with pytest.raises(RunError) as exc_info:
        create_run(
            repo,
            current_user=user,
            request={
                "task_text": "Make a cheat sheet.",
                "intent": "cheat_sheet",
                "search_mode": "off",
            },
            workspace_root=str(tmp_path / "workspace"),
            executor=make_run_executor(provider, pdf_converter=mock_pdf_converter),
            search_adapter=noop_search_adapter,
        )

    assert exc_info.value.code == "validation_error"
    assert {"field": "options.target_pages", "rule": "required"} in exc_info.value.fields
    assert not mock_pdf_converter.calls
    assert not (tmp_path / "workspace").exists()


def test_cheat_sheet_html_pipeline_conversion_failure_preserves_source_logs_and_manifest(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    failing_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    blank_pdf = tmp_path / "image-only-slides.pdf"
    _write_blank_pdf(blank_pdf)
    _create_pdf_upload(repo, "upload-blank", blank_pdf)
    provider = fake_model_provider_factory(CHEAT_SHEET_HTML)

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Make a one-page cheat sheet.",
            "intent": "cheat_sheet",
            "search_mode": "off",
            "upload_ids": ["upload-blank"],
            "options": {"target_pages": 1},
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=failing_pdf_converter),
        search_adapter=noop_search_adapter,
    )

    assert body["status"] == "failed"
    assert body["error_message"] == "convert_failed: Mock conversion failure"
    output_root = Path(body["output_root"])
    assert (output_root / "output" / "cheat-sheet.html").exists()
    assert not (output_root / "output" / "cheat-sheet.pdf").exists()
    assert (output_root / "logs" / "convert.log").read_text(encoding="utf-8") == (
        "mock error log\n"
    )
    assert "PDF contained no extractable text." in (
        output_root / "logs" / "extraction.log"
    ).read_text(encoding="utf-8")

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["intent"] == "cheat_sheet"
    assert manifest["status"] == "failed"
    assert {"path": "output/cheat-sheet.html", "kind": "source"} in manifest["outputs"]
    assert {"path": "output/cheat-sheet.pdf", "kind": "pdf"} not in manifest["outputs"]

    generation_log = (output_root / "logs" / "generation.log").read_text(
        encoding="utf-8"
    )
    assert "convert_failed" in generation_log
    assert "Traceback" not in generation_log


def test_cheat_sheet_html_pipeline_model_provider_failure_preserves_extraction_log(
    tmp_path,
    repo_with_user,
    fake_model_provider_factory,
    mock_pdf_converter,
    noop_search_adapter,
):
    repo, user = repo_with_user
    blank_pdf = tmp_path / "blank.pdf"
    _write_blank_pdf(blank_pdf)
    _create_pdf_upload(repo, "upload-blank", blank_pdf)
    provider = fake_model_provider_factory(
        error=ModelProviderError("provider_unavailable", "Provider is offline.")
    )

    body = create_run(
        repo,
        current_user=user,
        request={
            "task_text": "Make a one-page cheat sheet while provider is unavailable.",
            "intent": "cheat_sheet",
            "search_mode": "off",
            "upload_ids": ["upload-blank"],
            "options": {"target_pages": 1},
        },
        workspace_root=str(tmp_path / "workspace"),
        executor=make_run_executor(provider, pdf_converter=mock_pdf_converter),
        search_adapter=noop_search_adapter,
    )

    assert body["status"] == "failed"
    assert body["error_message"] == "provider_unavailable: Provider is offline."
    output_root = Path(body["output_root"])
    assert (output_root / "logs" / "extraction.log").exists()
    assert not (output_root / "output" / "cheat-sheet.html").exists()
    assert not mock_pdf_converter.calls

    manifest = json.loads((output_root / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["intent"] == "cheat_sheet"
    assert manifest["status"] == "failed"
    assert manifest["outputs"] == []


def _create_pdf_upload(
    repo: SQLiteRepository,
    upload_id: str,
    path: Path,
    *,
    user_id: str = "user-1",
) -> None:
    repo.create_upload(
        id=upload_id,
        user_id=user_id,
        original_name=path.name,
        media_type="application/pdf",
        stored_path=str(path),
        sha256=upload_id.rjust(64, "0")[-64:],
        size_bytes=path.stat().st_size,
    )


def _write_blank_pdf(path: Path) -> None:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=72, height=72)
    with path.open("wb") as file:
        writer.write(file)


def _write_text_pdf(path: Path, text: str) -> None:
    content = f"BT /F1 18 Tf 72 720 Td ({_pdf_literal(text)}) Tj ET".encode(
        "latin-1"
    )
    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        (
            b"3 0 obj\n"
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\n"
            b"endobj\n"
        ),
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        (
            b"5 0 obj\n<< /Length "
            + str(len(content)).encode("ascii")
            + b" >>\nstream\n"
            + content
            + b"\nendstream\nendobj\n"
        ),
    ]

    pdf = b"%PDF-1.4\n"
    offsets = []
    for object_bytes in objects:
        offsets.append(len(pdf))
        pdf += object_bytes

    xref_start = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    pdf += b"0000000000 65535 f \n"
    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")
    pdf += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_start}\n%%EOF\n"
    ).encode("ascii")
    path.write_bytes(pdf)


def _pdf_literal(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
