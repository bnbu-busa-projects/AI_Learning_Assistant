import logging
import time
from typing import Dict, List

from ddgs import DDGS

logger = logging.getLogger(__name__)


def _normalize_result(item: Dict) -> Dict[str, str]:
    return {
        "title": str(item.get("title") or item.get("heading") or "Untitled"),
        "body": str(item.get("body") or item.get("snippet") or item.get("description") or ""),
        "href": str(item.get("href") or item.get("url") or ""),
    }


def perform_web_search(
    query: str,
    max_results: int = 3,
    retries: int = 2,
    timeout_s: int = 10,
) -> List[Dict[str, str]]:
    last_error = None
    for attempt in range(retries + 1):
        try:
            with DDGS(timeout=timeout_s) as ddgs:
                raw_results = list(ddgs.text(query, max_results=max_results))
            normalized = [_normalize_result(item) for item in raw_results]
            if normalized:
                return normalized
        except Exception as exc:
            last_error = exc
            if attempt < retries:
                time.sleep(0.6 * (attempt + 1))

    if last_error:
        logger.warning("Web search failed after retries: %s", last_error)
    return []
