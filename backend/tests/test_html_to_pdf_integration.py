from pathlib import Path

import pytest
from pypdf import PdfReader

from backend.pipelines.html_to_pdf import (
    A4_NO_MARGIN,
    A4_PAGE,
    ConvertError,
    PlaywrightPdfConverter,
    SLIDES_PAGE,
)


FIXTURES = Path(__file__).parent / "fixtures"


pytestmark = pytest.mark.integration


def test_essay_html_converts_to_real_pdf(tmp_path):
    pdf_path = tmp_path / "sample_essay.pdf"

    result = _convert_or_skip(FIXTURES / "sample_essay.html", pdf_path, page_config=A4_PAGE)

    _assert_pdf(pdf_path)
    assert result.pdf_path == pdf_path.resolve()
    assert "Page: 210mm x 297mm, margin=20mm" in result.log_text


def test_slides_html_converts_to_pdf_with_one_page_per_slide(tmp_path):
    pdf_path = tmp_path / "sample_slides.pdf"

    result = _convert_or_skip(
        FIXTURES / "sample_slides.html",
        pdf_path,
        page_config=SLIDES_PAGE,
    )

    _assert_pdf(pdf_path)
    reader = PdfReader(str(pdf_path))
    assert len(reader.pages) == 3
    assert "Page: 10in x 5.625in, margin=0" in result.log_text


def test_cheat_sheet_html_converts_to_real_pdf(tmp_path):
    pdf_path = tmp_path / "sample_cheat_sheet.pdf"

    result = _convert_or_skip(
        FIXTURES / "sample_cheat_sheet.html",
        pdf_path,
        page_config=A4_NO_MARGIN,
    )

    _assert_pdf(pdf_path)
    assert "Page: 210mm x 297mm, margin=0" in result.log_text


def test_missing_html_raises_convert_error(tmp_path):
    converter = PlaywrightPdfConverter(timeout_ms=5000)
    missing_html = tmp_path / "does-not-exist.html"
    pdf_path = tmp_path / "missing.pdf"

    with pytest.raises(ConvertError) as exc_info:
        converter.convert(html_path=missing_html, pdf_path=pdf_path, page_config=A4_PAGE)

    assert exc_info.value.message == "HTML source file not found."
    assert "HTML source file not found" in exc_info.value.log_text
    assert not pdf_path.exists()


def test_empty_html_input_is_handled_gracefully(tmp_path):
    html_path = tmp_path / "empty.html"
    html_path.write_text("", encoding="utf-8")
    pdf_path = tmp_path / "empty.pdf"

    try:
        _convert_or_skip(html_path, pdf_path, page_config=A4_PAGE)
    except ConvertError as exc:
        assert exc.message
        assert "Error:" in exc.log_text
        return

    _assert_pdf(pdf_path, min_size=500)


def _convert_or_skip(html_path: Path, pdf_path: Path, *, page_config):
    pytest.importorskip("playwright.sync_api")
    converter = PlaywrightPdfConverter(timeout_ms=10_000)
    try:
        return converter.convert(
            html_path=html_path,
            pdf_path=pdf_path,
            page_config=page_config,
        )
    except ConvertError as exc:
        if _is_browser_unavailable(exc):
            pytest.skip(f"Playwright/Chromium unavailable: {exc.message}")
        raise


def _is_browser_unavailable(exc: ConvertError) -> bool:
    text = f"{exc.message}\n{exc.log_text}".lower()
    return any(
        marker in text
        for marker in (
            "playwright is not installed",
            "browser executable doesn't exist",
            "executable doesn't exist",
            "please run playwright install",
            "host system is missing dependencies",
            "playwright is not installed or unavailable",
        )
    )


def _assert_pdf(path: Path, *, min_size: int = 1024) -> None:
    assert path.exists()
    assert path.read_bytes().startswith(b"%PDF")
    assert path.stat().st_size > min_size
