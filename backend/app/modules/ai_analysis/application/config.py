"""Centralized AI provider configuration (env-only secrets)."""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import get_settings

PROMPT_VERSION = "ccf-ai-v2-1"


@dataclass(frozen=True)
class AiProviderSettings:
    enabled: bool
    api_key: str | None
    model: str
    timeout_seconds: float
    max_retries: int
    input_cost_per_1m: float
    output_cost_per_1m: float


def load_ai_settings() -> AiProviderSettings:
    settings = get_settings()
    api_key = (settings.openai_api_key or "").strip() or None
    return AiProviderSettings(
        enabled=bool(settings.ai_analysis_enabled) and bool(api_key),
        api_key=api_key,
        model=(settings.openai_model or "gpt-4.1-mini").strip(),
        timeout_seconds=max(5.0, float(settings.ai_analysis_timeout_seconds)),
        max_retries=max(0, min(int(settings.ai_analysis_max_retries), 3)),
        input_cost_per_1m=float(settings.ai_input_cost_per_1m),
        output_cost_per_1m=float(settings.ai_output_cost_per_1m),
    )


def estimate_cost_usd(input_tokens: int, output_tokens: int, settings: AiProviderSettings) -> float:
    return round(
        (input_tokens / 1_000_000) * settings.input_cost_per_1m
        + (output_tokens / 1_000_000) * settings.output_cost_per_1m,
        6,
    )
