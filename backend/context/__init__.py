"""Context extraction, budget estimation, and search-policy package."""

from backend.context.budget import ContextEstimate, ContextSection, estimate_context_budget
from backend.context.builder import ContextBuildError, PreparedContext, build_run_context
from backend.context.extraction import UploadExtraction
from backend.context.search_policy import (
    DuckDuckGoSearchAdapter,
    SearchExecution,
    SearchPolicyDecision,
    SearchPolicyError,
    WebSearchAdapter,
    decide_search_policy,
    execute_search_policy,
)

__all__ = [
    "ContextBuildError",
    "ContextEstimate",
    "ContextSection",
    "PreparedContext",
    "SearchExecution",
    "SearchPolicyDecision",
    "SearchPolicyError",
    "UploadExtraction",
    "WebSearchAdapter",
    "build_run_context",
    "decide_search_policy",
    "estimate_context_budget",
    "execute_search_policy",
    "DuckDuckGoSearchAdapter",
]
