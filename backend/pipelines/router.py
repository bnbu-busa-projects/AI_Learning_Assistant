from __future__ import annotations

from dataclasses import dataclass
from typing import Any

SUPPORTED_INTENTS = frozenset(
    {
        "code_homework",
        "essay_latex",
        "beamer_slides",
        "cheat_sheet",
    }
)


class UnsupportedIntentError(ValueError):
    pass


@dataclass(frozen=True)
class PipelineTarget:
    intent: str
    pipeline: str
    artifact_family: str
    primary_outputs: tuple[str, ...]
    default_output_preference: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "pipeline": self.pipeline,
            "artifact_family": self.artifact_family,
            "primary_outputs": list(self.primary_outputs),
            "default_output_preference": self.default_output_preference,
        }


@dataclass(frozen=True)
class RoutingDecision:
    requested_intent: str
    resolved_intent: str
    target: PipelineTarget
    output_preference: str
    options: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "requested_intent": self.requested_intent,
            "intent": self.resolved_intent,
            "pipeline": self.target.pipeline,
            "artifact_family": self.target.artifact_family,
            "primary_outputs": list(self.target.primary_outputs),
            "output_preference": self.output_preference,
            "options": self.options,
        }


PIPELINE_TARGETS = {
    "code_homework": PipelineTarget(
        intent="code_homework",
        pipeline="code_homework",
        artifact_family="code",
        primary_outputs=("solution.py", "solution.ipynb"),
        default_output_preference="py",
    ),
    "essay_latex": PipelineTarget(
        intent="essay_latex",
        pipeline="essay_html",
        artifact_family="html",
        primary_outputs=("main.html", "main.pdf"),
        default_output_preference="pdf",
    ),
    "beamer_slides": PipelineTarget(
        intent="beamer_slides",
        pipeline="slides_html",
        artifact_family="html",
        primary_outputs=("slides.html", "slides.pdf"),
        default_output_preference="pdf",
    ),
    "cheat_sheet": PipelineTarget(
        intent="cheat_sheet",
        pipeline="cheat_sheet_html",
        artifact_family="html",
        primary_outputs=("cheat-sheet.html", "cheat-sheet.pdf"),
        default_output_preference="pdf",
    ),
}


def route_intent(
    intent: str | None,
    *,
    output_preference: str | None = None,
    options: dict[str, Any] | None = None,
) -> RoutingDecision:
    if not isinstance(intent, str) or not intent.strip():
        raise UnsupportedIntentError("Missing generation intent.")

    requested_intent = intent.strip()
    target = PIPELINE_TARGETS.get(requested_intent)
    if target is None:
        raise UnsupportedIntentError("Unsupported generation intent.")

    selected_output = output_preference.strip() if isinstance(output_preference, str) else ""
    if not selected_output:
        selected_output = target.default_output_preference

    return RoutingDecision(
        requested_intent=requested_intent,
        resolved_intent=target.intent,
        target=target,
        output_preference=selected_output,
        options=dict(options or {}),
    )
