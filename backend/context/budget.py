from __future__ import annotations

from dataclasses import dataclass
from math import ceil
from pathlib import Path
from typing import Any, Iterable

DEFAULT_CONTEXT_WINDOW_LIMIT = 128000

CODE_EXTENSIONS = {".py", ".ipynb", ".js", ".ts", ".tsx", ".jsx", ".java", ".cpp", ".c", ".r"}
MARKUP_EXTENSIONS = {".html", ".htm", ".css", ".svg"}


@dataclass(frozen=True)
class ContextSection:
    name: str
    text: str
    kind: str = "prose"


@dataclass(frozen=True)
class ContextEstimate:
    estimated_input_tokens: int
    estimated_output_tokens: int
    estimated_total_tokens: int
    context_window_limit: int
    utilization_ratio: float
    warning_level: str
    source: str
    safety_margin_tokens: int
    section_breakdown: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "estimated_input_tokens": self.estimated_input_tokens,
            "estimated_output_tokens": self.estimated_output_tokens,
            "estimated_total_tokens": self.estimated_total_tokens,
            "context_window_limit": self.context_window_limit,
            "utilization_ratio": self.utilization_ratio,
            "warning_level": self.warning_level,
            "source": self.source,
            "safety_margin_tokens": self.safety_margin_tokens,
            "section_breakdown": self.section_breakdown,
        }


def warning_level_for_ratio(utilization_ratio: float) -> str:
    if utilization_ratio > 0.85:
        return "critical"
    if utilization_ratio >= 0.70:
        return "warning"
    return "ok"


def section_kind_for_upload(original_name: str, media_type: str | None) -> str:
    extension = Path(original_name).suffix.lower()
    if extension in CODE_EXTENSIONS or media_type in {"text/x-python", "application/x-ipynb+json"}:
        return "code"
    if extension in MARKUP_EXTENSIONS:
        return "markup"
    return "prose"


def estimate_text_tokens(text: str, *, kind: str = "prose") -> int:
    if not text:
        return 0
    divisor = 3 if kind in {"code", "markup"} else 4
    return max(1, ceil(len(text) / divisor))


def output_token_budget(intent: str, options: dict[str, Any] | None = None) -> int:
    options = options or {}
    if intent == "code_homework":
        return 4000
    if intent == "essay_latex":
        return 6000
    if intent == "beamer_slides":
        return 7000
    if intent == "cheat_sheet":
        target_pages = options.get("target_pages")
        pages = target_pages if isinstance(target_pages, int) and target_pages > 0 else 2
        return max(5000, pages * 1800)
    return 4000


def normalize_context_window_limit(context_window_limit: int | None) -> int:
    if not isinstance(context_window_limit, int) or context_window_limit <= 0:
        return DEFAULT_CONTEXT_WINDOW_LIMIT
    return context_window_limit


def estimate_context_budget(
    sections: Iterable[ContextSection],
    *,
    intent: str,
    options: dict[str, Any] | None = None,
    context_window_limit: int | None = None,
    source: str = "heuristic",
) -> ContextEstimate:
    section_breakdown = {
        section.name: estimate_text_tokens(section.text, kind=section.kind) for section in sections
    }
    estimated_input = sum(section_breakdown.values())
    estimated_output = output_token_budget(intent, options)
    estimated_total = estimated_input + estimated_output
    limit = normalize_context_window_limit(context_window_limit)
    utilization_ratio = estimated_total / float(limit)

    return ContextEstimate(
        estimated_input_tokens=estimated_input,
        estimated_output_tokens=estimated_output,
        estimated_total_tokens=estimated_total,
        context_window_limit=limit,
        utilization_ratio=utilization_ratio,
        warning_level=warning_level_for_ratio(utilization_ratio),
        source=source,
        safety_margin_tokens=limit - estimated_total,
        section_breakdown=section_breakdown,
    )
