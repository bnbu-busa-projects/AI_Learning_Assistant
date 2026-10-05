from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass(frozen=True)
class TextGenerationRequest:
    profile: dict[str, Any]
    system_prompt: str
    user_prompt: str
    max_output_tokens: int
    temperature: float = 0.2


class ModelProviderError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


class TextGenerationProvider(Protocol):
    def generate_text(self, request: TextGenerationRequest) -> str:
        ...
