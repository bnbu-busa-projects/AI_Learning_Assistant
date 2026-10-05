import pytest

from backend.pipelines.html_to_pdf import (
    A4_PAGE,
    ConvertError,
    PageConfig,
    PlaywrightPdfConverter,
    SLIDES_PAGE,
)


def test_playwright_converter_raises_convert_error_for_missing_html(tmp_path):
    converter = PlaywrightPdfConverter(timeout_ms=1000)
    missing_html = tmp_path / "missing.html"
    pdf_path = tmp_path / "out.pdf"
    page_config = PageConfig(width="5in", height="7in", margin="3mm", landscape=True)

    with pytest.raises(ConvertError) as exc_info:
        converter.convert(
            html_path=missing_html,
            pdf_path=pdf_path,
            page_config=page_config,
        )

    assert exc_info.value.message == "HTML source file not found."
    assert "Page: 5in x 7in, margin=3mm, landscape=True" in exc_info.value.log_text
    assert "HTML source file not found" in exc_info.value.log_text
    assert not pdf_path.exists()


def test_page_config_constants_match_html_native_contract():
    assert SLIDES_PAGE == PageConfig(width="10in", height="5.625in", margin="0")
    assert A4_PAGE == PageConfig(width="210mm", height="297mm", margin="20mm")


def test_playwright_converter_writes_pdf_for_minimal_html_when_browser_available(tmp_path):
    pytest.importorskip("playwright.sync_api")
    html_path = tmp_path / "minimal.html"
    html_path.write_text(
        "<!doctype html><html><body><h1>PDF smoke</h1></body></html>",
        encoding="utf-8",
    )
    pdf_path = tmp_path / "minimal.pdf"
    converter = PlaywrightPdfConverter(timeout_ms=5000)

    try:
        result = converter.convert(
            html_path=html_path,
            pdf_path=pdf_path,
            page_config=A4_PAGE,
        )
    except ConvertError as exc:
        pytest.skip(f"Playwright browser unavailable in this environment: {exc.message}")

    assert result.pdf_path == pdf_path.resolve()
    assert pdf_path.read_bytes().startswith(b"%PDF")
    assert "Page: 210mm x 297mm, margin=20mm, landscape=False" in result.log_text
    assert "Result: pdf_ok" in result.log_text
