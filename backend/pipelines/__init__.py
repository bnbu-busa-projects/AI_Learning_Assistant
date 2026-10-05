"""Artifact generation pipeline package."""

from backend.pipelines.cheat_sheet_html import (
    build_cheat_sheet_html_prompt,
    run_cheat_sheet_html_pipeline,
)
from backend.pipelines.code_homework import run_code_homework_pipeline
from backend.pipelines.common import PipelineError, PipelineResult
from backend.pipelines.deck_css import DECK_CSS, DECK_CSS_PATH, get_deck_css
from backend.pipelines.essay_html import build_essay_html_prompt, run_essay_html_pipeline
from backend.pipelines.html_to_pdf import (
    A4_NO_MARGIN,
    A4_PAGE,
    SLIDES_PAGE,
    ConvertError,
    ConvertResult,
    HtmlToPdfConverter,
    PageConfig,
    PlaywrightPdfConverter,
)
from backend.pipelines.slides_html import build_slides_html_prompt, run_slides_html_pipeline
from backend.pipelines.router import (
    PIPELINE_TARGETS,
    SUPPORTED_INTENTS,
    RoutingDecision,
    UnsupportedIntentError,
    route_intent,
)

__all__ = [
    "PIPELINE_TARGETS",
    "PipelineError",
    "PipelineResult",
    "A4_NO_MARGIN",
    "A4_PAGE",
    "SLIDES_PAGE",
    "ConvertError",
    "ConvertResult",
    "DECK_CSS",
    "DECK_CSS_PATH",
    "HtmlToPdfConverter",
    "PageConfig",
    "PlaywrightPdfConverter",
    "build_essay_html_prompt",
    "build_cheat_sheet_html_prompt",
    "build_slides_html_prompt",
    "SUPPORTED_INTENTS",
    "RoutingDecision",
    "UnsupportedIntentError",
    "get_deck_css",
    "run_cheat_sheet_html_pipeline",
    "run_code_homework_pipeline",
    "run_essay_html_pipeline",
    "run_slides_html_pipeline",
    "route_intent",
]
