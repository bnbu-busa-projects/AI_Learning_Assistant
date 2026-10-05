from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

MAX_EXTRACTED_CHARS_PER_UPLOAD = 50000
TEXT_EXTENSIONS = {".txt", ".md", ".markdown", ".py", ".html", ".htm", ".css", ".csv", ".json"}
NOTEBOOK_EXTENSIONS = {".ipynb"}
PDF_EXTENSIONS = {".pdf"}


@dataclass(frozen=True)
class UploadExtraction:
    id: str
    original_name: str
    media_type: str | None
    size_bytes: int
    sha256: str
    extracted_text: str
    notes: tuple[str, ...] = field(default_factory=tuple)
    estimated_tokens: int = 0

    @property
    def extracted_chars(self) -> int:
        return len(self.extracted_text)

    def as_context_text(self) -> str:
        header = f"[Upload: {self.original_name} | {self.media_type or 'unknown'}]"
        notes = "\n".join(f"[Note] {note}" for note in self.notes)
        parts = [header]
        if notes:
            parts.append(notes)
        if self.extracted_text:
            parts.append(self.extracted_text)
        return "\n".join(parts)

    def to_summary_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "original_name": self.original_name,
            "media_type": self.media_type,
            "size_bytes": self.size_bytes,
            "sha256": self.sha256,
            "extracted_chars": self.extracted_chars,
            "estimated_tokens": self.estimated_tokens,
            "notes": list(self.notes),
        }


def extract_upload(upload: dict[str, Any]) -> UploadExtraction:
    original_name = upload["original_name"]
    media_type = upload.get("media_type")
    stored_path = Path(upload["stored_path"])
    notes: list[str] = []

    if not stored_path.exists():
        return _extraction_from_upload(
            upload,
            "",
            ["Upload file is unavailable; using metadata only."],
        )

    extension = Path(original_name).suffix.lower() or stored_path.suffix.lower()
    try:
        if extension in NOTEBOOK_EXTENSIONS:
            text, notes = _extract_notebook(stored_path)
        elif extension in PDF_EXTENSIONS or media_type == "application/pdf":
            text, notes = _extract_pdf(stored_path)
        elif extension in TEXT_EXTENSIONS or (media_type or "").startswith("text/"):
            text, notes = _extract_text(stored_path)
        else:
            text = ""
            notes = ["Upload type is not text-extractable in phase 1."]
    except Exception:
        text = ""
        notes = ["Upload extraction failed; using metadata only."]

    text, truncate_note = _truncate_text(text)
    if truncate_note:
        notes.append(truncate_note)
    return _extraction_from_upload(upload, text, notes)


def _extraction_from_upload(
    upload: dict[str, Any],
    extracted_text: str,
    notes: list[str],
) -> UploadExtraction:
    return UploadExtraction(
        id=upload["id"],
        original_name=upload["original_name"],
        media_type=upload.get("media_type"),
        size_bytes=int(upload.get("size_bytes") or 0),
        sha256=upload.get("sha256") or "",
        extracted_text=extracted_text,
        notes=tuple(notes),
    )


def _extract_text(path: Path) -> tuple[str, list[str]]:
    try:
        return path.read_text(encoding="utf-8"), []
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="replace"), [
            "Text file contained invalid UTF-8; replacement characters were used."
        ]


def _extract_notebook(path: Path) -> tuple[str, list[str]]:
    import nbformat

    notebook = nbformat.reads(path.read_text(encoding="utf-8"), as_version=4)
    chunks: list[str] = []
    for index, cell in enumerate(notebook.cells, 1):
        cell_type = cell.get("cell_type", "unknown")
        if cell_type not in {"markdown", "code"}:
            continue
        source = cell.get("source", "")
        source_text = "".join(source) if isinstance(source, list) else str(source)
        source_text = source_text.strip()
        if source_text:
            label = "Markdown" if cell_type == "markdown" else "Code"
            chunks.append(f"[{label} Cell {index}]\n{source_text}")

    if not chunks:
        return "", ["Notebook contained no markdown or code cell text."]
    return "\n\n".join(chunks), []


def _extract_pdf(path: Path) -> tuple[str, list[str]]:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    pages: list[str] = []
    for index, page in enumerate(reader.pages, 1):
        page_text = (page.extract_text() or "").strip()
        if page_text:
            pages.append(f"[Page {index}]\n{page_text}")

    if not pages:
        return "", ["PDF contained no extractable text."]
    return "\n\n".join(pages), []


def _truncate_text(text: str) -> tuple[str, str | None]:
    if len(text) <= MAX_EXTRACTED_CHARS_PER_UPLOAD:
        return text, None
    return (
        text[:MAX_EXTRACTED_CHARS_PER_UPLOAD],
        f"Extracted text was truncated to {MAX_EXTRACTED_CHARS_PER_UPLOAD} characters.",
    )
