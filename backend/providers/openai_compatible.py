from __future__ import annotations

from typing import Any

import httpx
from openai import APIConnectionError, APITimeoutError, AuthenticationError, OpenAI

from backend.core.model_settings import SettingsError, resolve_api_key
from backend.providers.base import ModelProviderError, TextGenerationRequest

GENERATION_TIMEOUT = httpx.Timeout(connect=15.0, read=300.0, write=15.0, pool=15.0)


def test_openai_compatible_provider(profile: dict[str, Any], api_key: str) -> dict[str, Any]:
    client = OpenAI(api_key=api_key, base_url=profile["base_url"], timeout=5.0)
    try:
        client.models.list()
    except AuthenticationError as exc:
        raise SettingsError(
            502,
            "provider_auth_failed",
            "The model provider rejected the API key.",
        ) from exc
    except APIConnectionError as exc:
        raise SettingsError(
            502,
            "provider_unavailable",
            "The model provider is unreachable.",
        ) from exc
    except Exception as exc:
        raise SettingsError(
            502,
            "provider_unavailable",
            "The model provider test failed.",
        ) from exc
    return {"ok": True, "provider": profile["provider"], "model": profile["model"]}


class OpenAICompatibleTextProvider:
    def generate_text(self, request: TextGenerationRequest) -> str:
        profile = request.profile
        api_key = resolve_api_key(profile.get("api_key_ref"))
        if not api_key:
            raise ModelProviderError(
                "missing_api_key",
                "No model API key is configured.",
            )

        client = OpenAI(
            api_key=api_key,
            base_url=profile["base_url"],
            timeout=GENERATION_TIMEOUT,
            max_retries=1,
        )
        try:
            response = client.chat.completions.create(
                model=profile["model"],
                messages=[
                    {"role": "system", "content": request.system_prompt},
                    {"role": "user", "content": request.user_prompt},
                ],
                max_tokens=request.max_output_tokens,
                temperature=request.temperature,
            )
        except AuthenticationError as exc:
            raise ModelProviderError(
                "provider_auth_failed",
                "The model provider rejected the API key. Update it in model settings.",
            ) from exc
        except APITimeoutError as exc:
            raise ModelProviderError(
                "provider_timeout",
                "The model provider did not respond in time. The generation may be too large; try a shorter brief or fewer target pages.",
            ) from exc
        except APIConnectionError as exc:
            raise ModelProviderError(
                "provider_unavailable",
                "The model provider is unreachable.",
            ) from exc
        except Exception as exc:
            raise ModelProviderError(
                "provider_unavailable",
                "The model provider request failed.",
            ) from exc

        content = response.choices[0].message.content if response.choices else None
        if not content:
            raise ModelProviderError(
                "provider_unavailable",
                "The model provider returned an empty response.",
            )
        return content
