from __future__ import annotations

from pathlib import Path


DECK_CSS_PATH = Path(__file__).resolve().parents[2] / "slides_html" / "shared" / "deck.css"
DECK_CSS = DECK_CSS_PATH.read_text(encoding="utf-8")


def get_deck_css() -> str:
    return DECK_CSS
