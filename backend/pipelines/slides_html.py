from __future__ import annotations

import json
from typing import Any, Callable

from backend.artifacts.filesystem import ArtifactRun
from backend.pipelines.common import (
    PipelineError,
    PipelineResult,
    extract_fenced_or_raw,
    format_citations,
    format_log,
)
from backend.pipelines.deck_css import get_deck_css
from backend.pipelines.html_to_pdf import (
    ConvertError,
    HtmlToPdfConverter,
    SLIDES_PAGE,
)
from backend.providers.base import (
    ModelProviderError,
    TextGenerationProvider,
    TextGenerationRequest,
)
from backend.timing import RunTimingRecorder, measure_stage


DECK_CSS_PROMPT_REFERENCE = """
.slide { width: 960px; height: 540px; overflow: hidden; background: white; page-break-after: always; }
.content { position: absolute; inset: 54px 54px 44px 54px; }
.title-slide .content { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.card { border: 1px solid #d9dce3; background: #f7f8fb; border-radius: 6px; padding: 14px 15px; }
.callout { border-left: 7px solid #d88a19; background: #fff9ef; padding: 15px 18px; }
.code-box { border: 1px solid #c8cbd5; background: #f8f8fa; border-radius: 6px; padding: 16px 18px; font-family: monospace; white-space: pre-wrap; }
.flow { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.flow-box { flex: 1; border: 1px solid #d9dce3; border-radius: 6px; padding: 14px; text-align: center; font-weight: 700; }
.number-list { counter-reset: item; display: grid; gap: 12px; }
.number-row { display: grid; grid-template-columns: 36px 1fr; gap: 12px; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { border: 1px solid #d9dce3; padding: 9px 10px; }
""".strip()


def run_slides_html_pipeline(
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
    emit_event: Callable[[str, str], None] | None = None,
    timing: RunTimingRecorder | None = None,
) -> PipelineResult:
    log_lines = [
        "Pipeline: slides_html",
        f"Output preference: {output_preference or 'pdf'}",
        "Stage: generate_source",
    ]
    system_prompt, user_prompt = build_slides_html_prompt(
        task_text=task_text,
        context_bundle=context_bundle,
        options=options or {},
        search=search,
    )
    if emit_event:
        emit_event("generate_source", "Generating HTML slide deck")

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
        "slides.html",
        source,
        kind="source",
        media_type="text/html",
    )
    log_lines.extend(["Output: output/slides.html", "Stage: convert_pdf"])
    if emit_event:
        emit_event("convert_pdf", "Converting HTML slide deck to PDF")

    pdf_path = artifact_run.run_dir / "output" / "slides.pdf"
    try:
        with measure_stage(timing, "convert_pdf"):
            convert_result = pdf_converter.convert(
                html_path=html_path,
                pdf_path=pdf_path,
                page_config=SLIDES_PAGE,
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
        "slides.pdf",
        convert_result.pdf_path.read_bytes(),
        kind="pdf",
        media_type="application/pdf",
    )
    log_lines.extend(["Convert: pdf_ok", "Output: output/slides.pdf"])
    return PipelineResult(log_text=format_log(log_lines))


def build_slides_html_prompt(
    *,
    task_text: str,
    context_bundle: str,
    options: dict[str, Any],
    search: dict[str, Any],
) -> tuple[str, str]:
    system_prompt = (
        "You are an expert teaching assistant creating complete presentation "
        "slide decks as self-contained HTML. Return only the requested HTML "
        "source, with no surrounding explanation."
    )
    output_instruction = (
        "Return one complete self-contained HTML document. It must start with "
        "<!doctype html>, include <html>, <head>, and <body>, and include all CSS "
        "inline in a <style> element. Use the provided deck.css vocabulary: every "
        "slide is a <section class=\"slide\"> with a <div class=\"content\"> inside. "
        "The first slide should be <section class=\"slide title-slide\"> and use "
        "course-kicker, lecture-title, and instructor elements when useful. Use "
        "classes such as grid-2, grid-3, card, callout, code-box, prompt-box, "
        "table, flow, flow-box, number-list, and number-row. Include CSS print "
        "pagination with @page { size: 10in 5.625in; margin: 0; } and "
        "page-break-after: always on .slide. Do not use <link> tags, external "
        "stylesheet URLs, remote images, or remote HTTP(S) assets. Do not include "
        "unrequested institutional logos or branding. Diagrams "
        "must use CSS-based layouts, .is-diagram/.flow patterns, or inline SVG. "
        "If mathematical notation is needed, include inline KaTeX-compatible "
        "markup and minimal inline styling; do not fetch KaTeX from a CDN at "
        "render time. Cite any provided web sources in ordinary HTML notes or "
        "references. Do not wrap the answer in Markdown fences."
    )
    deck_css_reference = _clip_deck_css(get_deck_css())
    user_prompt = "\n\n".join(
        [
            "[Presentation Task]\n" + task_text.strip(),
            "[Prepared Context]\n" + context_bundle.strip(),
            "[Search Citations]\n" + format_citations(search),
            "[Options]\n" + json.dumps(options, sort_keys=True),
            "[Deck CSS Reference]\n" + DECK_CSS_PROMPT_REFERENCE,
            "[Bundled deck.css excerpt]\n" + deck_css_reference,
            "[Output Contract]\n" + output_instruction,
        ]
    )
    return system_prompt, user_prompt


def _clip_deck_css(css: str, *, limit: int = 6000) -> str:
    stripped = css.strip()
    if len(stripped) <= limit:
        return stripped
    return stripped[:limit].rstrip() + "\n\n/* deck.css excerpt truncated */"
