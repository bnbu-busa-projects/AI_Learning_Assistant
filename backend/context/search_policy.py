from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Protocol

AUTO_SEARCH_INTENTS = {"essay_latex", "beamer_slides", "cheat_sheet"}
AUTO_HINT_PATTERN = re.compile(
    r"\b(latest|current|today|recent|news|research|paper|survey|citation|source|version|api)\b",
    re.IGNORECASE,
)
AUTO_HINT_TERMS = ("最新", "最近", "论文", "参考文献", "资料来源", "来源")


class SearchPolicyError(RuntimeError):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class WebSearchAdapter(Protocol):
    def search(self, query: str, *, max_results: int = 3) -> list[dict[str, Any]]:
        ...


@dataclass(frozen=True)
class SearchPolicyDecision:
    mode: str
    decision: str
    should_search: bool
    query: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "decision": self.decision,
            "used": False,
        }


@dataclass(frozen=True)
class SearchExecution:
    mode: str
    decision: str
    used: bool
    citations: tuple[dict[str, str | None], ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "decision": self.decision,
            "used": self.used,
            "citations": [dict(citation) for citation in self.citations],
        }


class DuckDuckGoSearchAdapter:
    def __init__(self, *, max_results: int = 3):
        self.max_results = max_results

    def search(self, query: str, *, max_results: int = 3) -> list[dict[str, Any]]:
        from backend.context.web_search import perform_web_search

        limit = max_results if max_results > 0 else self.max_results
        results = perform_web_search(query, max_results=limit)
        normalized: list[dict[str, Any]] = []
        for item in results:
            normalized.append(
                {
                    "title": item.get("title"),
                    "url": item.get("href"),
                    "snippet": item.get("body"),
                }
            )
        return normalized


def decide_search_policy(
    *,
    search_mode: str,
    intent: str,
    task_text: str,
    upload_count: int = 0,
) -> SearchPolicyDecision:
    query = build_search_query(intent=intent, task_text=task_text)

    if search_mode == "off":
        return SearchPolicyDecision(
            mode="off",
            decision="off_disabled",
            should_search=False,
            query=None,
        )
    if search_mode == "on":
        return SearchPolicyDecision(
            mode="on",
            decision="forced_on",
            should_search=True,
            query=query,
        )

    should_search = _should_auto_search(intent=intent, task_text=task_text, upload_count=upload_count)
    return SearchPolicyDecision(
        mode="auto",
        decision="auto_use_search" if should_search else "auto_skip_search",
        should_search=should_search,
        query=query if should_search else None,
    )


def execute_search_policy(
    *,
    decision: SearchPolicyDecision,
    adapter: WebSearchAdapter,
) -> SearchExecution:
    if not decision.should_search:
        return SearchExecution(
            mode=decision.mode,
            decision=decision.decision,
            used=False,
            citations=tuple(),
        )

    query = (decision.query or "").strip()
    if not query:
        if decision.mode == "on":
            raise SearchPolicyError("search_unavailable", "Web search query was empty.")
        return SearchExecution(
            mode=decision.mode,
            decision="auto_skip_search",
            used=False,
            citations=tuple(),
        )

    try:
        raw_results = adapter.search(query)
    except Exception as exc:
        if decision.mode == "on":
            raise SearchPolicyError("search_unavailable", "Web search is unavailable.") from exc
        return SearchExecution(
            mode=decision.mode,
            decision="auto_search_failed",
            used=False,
            citations=tuple(),
        )

    return SearchExecution(
        mode=decision.mode,
        decision=decision.decision,
        used=True,
        citations=tuple(_normalize_citation(item) for item in raw_results),
    )


def build_search_query(*, intent: str, task_text: str) -> str:
    compact_text = " ".join(task_text.split())
    clipped = compact_text[:180]
    intent_hint = intent.replace("_", " ")
    if not clipped:
        return f"{intent_hint} reference material"
    return f"{intent_hint}: {clipped}"


def _should_auto_search(*, intent: str, task_text: str, upload_count: int) -> bool:
    if intent in AUTO_SEARCH_INTENTS:
        return True
    if _looks_time_sensitive(task_text):
        return True
    return upload_count == 0 and len(task_text.strip()) < 120


def _looks_time_sensitive(text: str) -> bool:
    lowered = text.lower()
    if AUTO_HINT_PATTERN.search(lowered):
        return True
    return any(term in text for term in AUTO_HINT_TERMS)


def _normalize_citation(raw: dict[str, Any]) -> dict[str, str | None]:
    title = _clean_optional_text(raw.get("title"))
    url = _clean_optional_text(raw.get("url") or raw.get("href"))
    snippet = _clean_optional_text(raw.get("snippet") or raw.get("body"))
    return {"title": title, "url": url, "snippet": snippet}


def _clean_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
