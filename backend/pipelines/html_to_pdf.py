from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class PageConfig:
    width: str
    height: str
    margin: str
    landscape: bool = False


@dataclass(frozen=True)
class ConvertResult:
    pdf_path: Path
    log_text: str


class ConvertError(Exception):
    def __init__(self, message: str, *, log_text: str):
        self.message = message
        self.log_text = log_text
        super().__init__(message)


class HtmlToPdfConverter(Protocol):
    def convert(
        self,
        *,
        html_path: Path,
        pdf_path: Path,
        page_config: PageConfig,
    ) -> ConvertResult:
        ...


SLIDES_PAGE = PageConfig(width="10in", height="5.625in", margin="0")
A4_PAGE = PageConfig(width="210mm", height="297mm", margin="20mm")
A4_NO_MARGIN = PageConfig(width="210mm", height="297mm", margin="0")


class PlaywrightPdfConverter:
    def __init__(self, *, timeout_ms: int = 45_000):
        self.timeout_ms = timeout_ms

    def convert(
        self,
        *,
        html_path: Path,
        pdf_path: Path,
        page_config: PageConfig,
    ) -> ConvertResult:
        resolved_html = html_path.resolve()
        resolved_pdf = pdf_path.resolve()
        log_lines = [
            "Converter: playwright_chromium",
            f"Input: {resolved_html}",
            f"Output: {resolved_pdf}",
            (
                "Page: "
                f"{page_config.width} x {page_config.height}, "
                f"margin={page_config.margin}, "
                f"landscape={page_config.landscape}"
            ),
        ]

        if not resolved_html.exists():
            log_text = _format_log([*log_lines, "Error: HTML source file not found."])
            raise ConvertError("HTML source file not found.", log_text=log_text)

        try:
            from playwright.sync_api import Error as PlaywrightError
            from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
            from playwright.sync_api import sync_playwright
        except Exception as exc:
            log_text = _format_log(
                [*log_lines, "Error: Playwright is not installed or unavailable."]
            )
            raise ConvertError(
                "Playwright is not installed or unavailable.",
                log_text=log_text,
            ) from exc

        resolved_pdf.parent.mkdir(parents=True, exist_ok=True)

        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                try:
                    page = browser.new_page()
                    page.set_default_timeout(self.timeout_ms)
                    page.emulate_media(media="print")
                    page.goto(resolved_html.as_uri(), wait_until="load")
                    page.pdf(
                        path=str(resolved_pdf),
                        width=page_config.width,
                        height=page_config.height,
                        margin={
                            "top": page_config.margin,
                            "right": page_config.margin,
                            "bottom": page_config.margin,
                            "left": page_config.margin,
                        },
                        landscape=page_config.landscape,
                        print_background=True,
                    )
                finally:
                    browser.close()
        except PlaywrightTimeoutError as exc:
            log_text = _format_log([*log_lines, "Error: HTML-to-PDF conversion timed out."])
            raise ConvertError("HTML-to-PDF conversion timed out.", log_text=log_text) from exc
        except PlaywrightError as exc:
            log_text = _format_log(
                [*log_lines, f"Error: Playwright conversion failed: {exc}"]
            )
            raise ConvertError("HTML-to-PDF conversion failed.", log_text=log_text) from exc
        except Exception as exc:
            log_text = _format_log([*log_lines, "Error: HTML-to-PDF conversion failed."])
            raise ConvertError("HTML-to-PDF conversion failed.", log_text=log_text) from exc

        if not resolved_pdf.exists():
            log_text = _format_log([*log_lines, "Error: PDF output was not created."])
            raise ConvertError("PDF output was not created.", log_text=log_text)

        return ConvertResult(
            pdf_path=resolved_pdf,
            log_text=_format_log([*log_lines, "Result: pdf_ok"]),
        )


def _format_log(lines: list[str]) -> str:
    return "\n".join(lines).rstrip() + "\n"
