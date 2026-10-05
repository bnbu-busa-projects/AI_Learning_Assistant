from __future__ import annotations

import json
from typing import Any, Callable

import nbformat

from backend.artifacts.filesystem import ArtifactRun
from backend.pipelines.common import (
    PipelineError,
    PipelineResult,
    extract_fenced_or_raw,
    format_citations,
    format_log,
)
from backend.providers.base import (
    ModelProviderError,
    TextGenerationProvider,
    TextGenerationRequest,
)
from backend.timing import RunTimingRecorder, measure_stage

PYTHON_OUTPUT_ALIASES = {"py", "python", "script", "python-script"}
NOTEBOOK_OUTPUT_ALIASES = {"ipynb", "notebook", "jupyter", "jupyter-notebook"}


def run_code_homework_pipeline(
    *,
    artifact_run: ArtifactRun,
    model_profile: dict[str, Any],
    model_provider: TextGenerationProvider,
    task_text: str,
    context_bundle: str,
    output_preference: str | None,
    options: dict[str, Any] | None,
    search: dict[str, Any],
    max_output_tokens: int,
    emit_event: Callable[[str, str], None] | None = None,
    timing: RunTimingRecorder | None = None,
) -> PipelineResult:
    output_kind = normalize_output_preference(output_preference)
    log_lines = [
        "Pipeline: code_homework",
        f"Output preference: {output_kind}",
        "Stage: generate_source",
    ]
    system_prompt, user_prompt = build_code_homework_prompt(
        task_text=task_text,
        context_bundle=context_bundle,
        output_kind=output_kind,
        options=options or {},
        search=search,
    )
    if emit_event:
        emit_event("generate_source", "Generating homework code")

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

    if output_kind == "ipynb":
        return _write_notebook_output(
            artifact_run, raw_output, log_lines, emit_event, timing
        )
    return _write_python_output(artifact_run, raw_output, log_lines, emit_event, timing)


def normalize_output_preference(output_preference: str | None) -> str:
    raw = (output_preference or "py").strip().lower()
    raw = raw.removeprefix(".")
    if raw in PYTHON_OUTPUT_ALIASES:
        return "py"
    if raw in NOTEBOOK_OUTPUT_ALIASES:
        return "ipynb"
    raise PipelineError(
        "validation_error",
        "Unsupported code output preference. Choose py or ipynb.",
        stage="validate_request",
    )


def build_code_homework_prompt(
    *,
    task_text: str,
    context_bundle: str,
    output_kind: str,
    options: dict[str, Any],
    search: dict[str, Any],
) -> tuple[str, str]:
    system_prompt = (
        "You are an expert teaching assistant writing complete homework solutions. "
        "Return only the requested source artifact, with no surrounding explanation."
    )
    output_instruction = (
        "Return a complete Python 3 script. Do not wrap it in Markdown fences."
        if output_kind == "py"
        else (
            "Return one valid Jupyter notebook JSON document using nbformat 4. "
            "Do not wrap it in Markdown fences."
        )
    )
    user_prompt = "\n\n".join(
        [
            "[Assignment Task]\n" + task_text.strip(),
            "[Prepared Context]\n" + context_bundle.strip(),
            "[Search Citations]\n" + format_citations(search),
            "[Options]\n" + json.dumps(options, sort_keys=True),
            "[Output Contract]\n" + output_instruction,
        ]
    )
    return system_prompt, user_prompt


def _write_python_output(
    artifact_run: ArtifactRun,
    raw_output: str,
    log_lines: list[str],
    emit_event: Callable[[str, str], None] | None = None,
    timing: RunTimingRecorder | None = None,
) -> PipelineResult:
    source = extract_fenced_or_raw(raw_output, accepted_languages={"python", "py"})
    source = source.strip() + "\n"
    artifact_run.write_output(
        "solution.py",
        source,
        kind="script",
        media_type="text/x-python",
    )
    log_lines.append("Stage: validate_python")
    if emit_event:
        emit_event("validate_python", "Validating generated Python")
    try:
        with measure_stage(timing, "output_validation"):
            compile(source, "solution.py", "exec")
    except SyntaxError as exc:
        raise PipelineError(
            "compile_failed",
            "Generated Python could not be parsed.",
            stage="validate_python",
            log_lines=log_lines,
        ) from exc

    log_lines.extend(["Validation: python_syntax_ok", "Output: output/solution.py"])
    return PipelineResult(log_text=format_log(log_lines))


def _write_notebook_output(
    artifact_run: ArtifactRun,
    raw_output: str,
    log_lines: list[str],
    emit_event: Callable[[str, str], None] | None = None,
    timing: RunTimingRecorder | None = None,
) -> PipelineResult:
    candidate = extract_fenced_or_raw(
        raw_output,
        accepted_languages={"json", "ipynb", "notebook"},
    )
    candidate = _extract_json_document(candidate)
    log_lines.append("Stage: validate_notebook")
    if emit_event:
        emit_event("validate_notebook", "Validating generated notebook")
    try:
        with measure_stage(timing, "output_validation"):
            notebook = nbformat.reads(candidate, as_version=4)
            nbformat.validate(notebook)
    except Exception as exc:
        artifact_run.write_output(
            "solution.ipynb",
            candidate,
            kind="notebook",
            media_type="application/x-ipynb+json",
        )
        raise PipelineError(
            "compile_failed",
            "Generated notebook was not valid nbformat JSON.",
            stage="validate_notebook",
            log_lines=log_lines,
        ) from exc

    artifact_run.write_output(
        "solution.ipynb",
        nbformat.writes(notebook),
        kind="notebook",
        media_type="application/x-ipynb+json",
    )
    log_lines.extend(["Validation: notebook_schema_ok", "Output: output/solution.ipynb"])
    return PipelineResult(log_text=format_log(log_lines))


def _extract_json_document(text: str) -> str:
    stripped = text.strip()
    try:
        json.loads(stripped)
        return stripped
    except json.JSONDecodeError:
        pass

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return stripped

    candidate = stripped[start : end + 1]
    try:
        json.loads(candidate)
    except json.JSONDecodeError:
        return stripped
    return candidate
