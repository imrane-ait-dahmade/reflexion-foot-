"""OpenAI Responses API client for structured coach reports."""

from __future__ import annotations

import json
from typing import Any

from app.core.exceptions import ValidationError
from app.modules.ai_analysis.application.config import AiProviderSettings


ANALYSIS_INSTRUCTIONS = """
Tu es un analyste de performance visuelle et cognitive pour le football, et tu écris pour un entraîneur.
Tu n'es pas un psychologue clinicien ni un médecin. Aucun diagnostic.
N'invente aucune statistique. Utilise uniquement les valeurs du JSON fourni.
Ne juge pas l'intelligence, la personnalité, le talent ou le potentiel professionnel.
Si les données sont insuffisantes, dis-le et n'invente pas de force ni de faiblesse.
Formule en français professionnel et en arabe standard clair (champs fr et ar).
Chaque observation cite des evidence_metric_keys présentes dans allowed_metric_keys.
Les recommandations sont des exercices de terrain concrets.
Ceci n'est PAS un test médical ou psychologique.
Réponds uniquement en JSON strict avec les clés:
report_type, confidence (low|medium|high), confidence_reason,
fr {executive_summary, what_was_assessed, performance_observations[], strengths[],
development_areas[], training_recommendations[], coach_action_plan[], limitations[]},
ar {mêmes clés}.
Observations: {title, explanation, evidence_metric_keys[], interpretation, priority}.
Recommendations: {title, objective, practical_exercise, duration_or_repetitions, related_metric_keys[], coaching_notes}.
""".strip()


async def generate_structured_report(
    *,
    context: dict[str, Any],
    settings: AiProviderSettings,
) -> dict[str, Any]:
    """Call OpenAI; raises ValidationError on provider/config failure."""
    if not settings.api_key:
        raise ValidationError("AI provider is not configured")

    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise ValidationError("openai package is not installed") from exc

    client = AsyncOpenAI(api_key=settings.api_key, timeout=settings.timeout_seconds)
    payload = {
        "prompt_version": context.get("prompt_version"),
        "report_type": context.get("report_type"),
        "tests": context.get("tests"),
        "group_players": context.get("group_players"),
        "focus_test_slug": context.get("focus_test_slug"),
        "allowed_metric_keys": context.get("allowed_metric_keys"),
        "session_title": context.get("session_title"),
        "note": (
            "Pour report_type=group: observations collectives uniquement; "
            "ne pas diagnostiquer un joueur nommé; citer quelques profils saillants seulement."
            if context.get("report_type") == "group"
            else None
        ),
    }
    last_error: Exception | None = None
    for attempt in range(settings.max_retries + 1):
        try:
            response = await client.responses.create(
                model=settings.model,
                max_output_tokens=3500,
                input=[
                    {"role": "system", "content": ANALYSIS_INSTRUCTIONS},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
                text={"format": {"type": "json_object"}},
            )
            text = getattr(response, "output_text", None) or ""
            if not text and getattr(response, "output", None):
                # Fallback extract
                for item in response.output:
                    for content in getattr(item, "content", []) or []:
                        if getattr(content, "type", "") == "output_text":
                            text = getattr(content, "text", "") or text
            if not text:
                raise ValidationError("empty_response")
            parsed = json.loads(text)
            usage = getattr(response, "usage", None)
            input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
            output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
            return {
                "content": parsed,
                "model": getattr(response, "model", None) or settings.model,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }
        except ValidationError:
            raise
        except Exception as exc:  # noqa: BLE001 — provider surface
            last_error = exc
            if attempt >= settings.max_retries:
                break
    raise ValidationError(f"AI provider failure: {last_error}")
