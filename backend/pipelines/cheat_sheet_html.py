from __future__ import annotations

import json
from typing import Any, Callable

from backend.artifacts.filesystem import ArtifactRun
from backend.context.extraction import UploadExtraction
from backend.pipelines.common import (
    PipelineError,
    PipelineResult,
    extract_fenced_or_raw,
    format_citations,
    format_extraction_log,
    format_log,
)
from backend.pipelines.html_to_pdf import (
    A4_NO_MARGIN,
    ConvertError,
    HtmlToPdfConverter,
)
from backend.providers.base import (
    ModelProviderError,
    TextGenerationProvider,
    TextGenerationRequest,
)
from backend.timing import RunTimingRecorder, measure_stage


def run_cheat_sheet_html_pipeline(
    *,
    artifact_run: ArtifactRun,
    model_profile: dict[str, Any],
    model_provider: TextGenerationProvider,
    pdf_converter: HtmlToPdfConverter,
    task_text: str,
    context_bundle: str,
    output_preference: str | None,
    options: dict[str, Any] | None,
    search: dict[str, Any],
    max_output_tokens: int,
    uploads: tuple[UploadExtraction, ...],
    emit_event: Callable[[str, str], None] | None = None,
    timing: RunTimingRecorder | None = None,
) -> PipelineResult:
    options = options or {}
    target_pages = options.get("target_pages")
    if type(target_pages) is not int or target_pages <= 0:
        raise PipelineError(
            "validation_error",
            "Cheat-sheet generation requires a positive target_pages option.",
            stage="validate_options",
        )

    extraction_log = format_extraction_log(uploads)
    artifact_run.write_log("extraction.log", extraction_log)
    if emit_event:
        emit_event("extract_context", "Summarizing PDF extraction")
    log_lines = [
        "Pipeline: cheat_sheet_html",
        f"Output preference: {output_preference or 'pdf'}",
        f"Target pages: {target_pages}",
        "Log: logs/extraction.log",
        "Stage: generate_source",
    ]
    system_prompt, user_prompt = build_cheat_sheet_html_prompt(
        task_text=task_text,
        context_bundle=context_bundle,
        options=options,
        search=search,
        extraction_log=extraction_log,
    )
    if emit_event:
        emit_event("generate_source", "Generating cheat-sheet HTML source")

    try:
        with measure_stage(timing, "provider_generation"):
            raw_output = model_provider.generate_text(
                TextGenerationRequest(
                    profile=model_profile,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    max_output_tokens=max_output_tokens,
                    temperature=0.2,
                )
            )
    except ModelProviderError as exc:
        raise PipelineError(
            exc.code,
            exc.message,
            stage="generate_source",
            log_lines=log_lines,
        ) from exc
    except Exception as exc:
        raise PipelineError(
            "provider_unavailable",
            "The model provider request failed.",
            stage="generate_source",
            log_lines=log_lines,
        ) from exc

    source = extract_fenced_or_raw(raw_output, accepted_languages={"html", "htm"})
    source = source.strip() + "\n"
    html_path = artifact_run.write_output(
        "cheat-sheet.html",
        source,
        kind="source",
        media_type="text/html",
    )
    log_lines.extend(["Output: output/cheat-sheet.html", "Stage: convert_pdf"])
    if emit_event:
        emit_event("convert_pdf", "Converting cheat-sheet HTML to PDF")

    pdf_path = artifact_run.run_dir / "output" / "cheat-sheet.pdf"
    try:
        with measure_stage(timing, "convert_pdf"):
            convert_result = pdf_converter.convert(
                html_path=html_path,
                pdf_path=pdf_path,
                page_config=A4_NO_MARGIN,
            )
    except ConvertError as exc:
        artifact_run.write_log("convert.log", exc.log_text)
        raise PipelineError(
            "convert_failed",
            exc.message,
            stage="convert_pdf",
            log_lines=log_lines,
        ) from exc
    except Exception as exc:
        artifact_run.write_log(
            "convert.log",
            "HTML-to-PDF converter raised an unexpected error.\n",
        )
        raise PipelineError(
            "convert_failed",
            "HTML-to-PDF conversion failed.",
            stage="convert_pdf",
            log_lines=log_lines,
        ) from exc

    artifact_run.write_log("convert.log", convert_result.log_text)
    artifact_run.write_output(
        "cheat-sheet.pdf",
        convert_result.pdf_path.read_bytes(),
        kind="pdf",
        media_type="application/pdf",
    )
    log_lines.extend(["Convert: pdf_ok", "Output: output/cheat-sheet.pdf"])
    return PipelineResult(log_text=format_log(log_lines))


def build_cheat_sheet_html_prompt(
    *,
    task_text: str,
    context_bundle: str,
    options: dict[str, Any],
    search: dict[str, Any],
    extraction_log: str,
) -> tuple[str, str]:
    target_pages = options.get("target_pages")
    paper_size = options.get("paper_size") or "A4"
    density = options.get("density") or "dense"
    system_prompt = (
        "You are an expert teaching assistant compressing course material into "
        "dense, print-ready HTML cheat sheets. Return only the requested HTML "
        "source, with no surrounding explanation."
    )
    output_instruction = (
        f"Return one complete self-contained HTML document targeting exactly "
        f"{target_pages} {paper_size} page(s) with {density} information density. "
        "It must start with <!doctype html> and include <html>, <head>, and "
        "<body>. Put all styling inside one inline <style> block. Use CSS "
        "multi-column layout such as column-count and column-gap, or CSS Grid, "
        "to pack content densely. Target @page { size: A4; margin: 8mm; } and "
        "use the page area aggressively. Use small but readable typography: "
        "10-11px body text and 8-9px minimum for labels, formulas, table cells, "
        "and footnotes. Apply break-inside: avoid to logical sections, tables, "
        "definition blocks, and code blocks to prevent awkward column breaks. "
        "Use compact sectioning, tables, definition lists, formula blocks, "
        "algorithm summaries, and code blocks where useful. Include inline "
        "KaTeX-compatible math markup and minimal inline styling when formulas "
        "are needed; do not fetch KaTeX from a CDN at render time. Do not use "
        "external stylesheet links, remote images, or remote HTTP(S) assets. "
        "Use inline SVG or CSS-only diagrams if diagrams are needed. Cite any "
        "provided web sources in a compact references area. Do not wrap the "
        "answer in Markdown fences. Exact page count is a target: fill the "
        "requested pages densely without leaving large blank areas."
    )
    user_prompt = "\n\n".join(
        [
            "[Cheat-Sheet Task]\n" + task_text.strip(),
            "[PDF Extraction Summary]\n" + extraction_log.strip(),
            "[Prepared Slide Context]\n" + context_bundle.strip(),
            "[Search Citations]\n" + format_citations(search),
            "[Options]\n" + json.dumps(options, sort_keys=True),
            "[Output Contract]\n" + output_instruction,
        ]
    )
    return system_prompt, user_prompt
