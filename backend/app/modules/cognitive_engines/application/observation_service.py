"""Persist validated client-observed exercise results via V2 attempts."""

from __future__ import annotations

from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ValidationError
from app.modules.cognitive_engines.observation import (
    OBSERVATION_SLUGS,
    validate_observation_payload,
)
from app.modules.test_sessions.application import player_access_service
from app.modules.test_sessions.application.schemas import CompleteExerciseRequest
from app.modules.test_sessions.presentation.deps import PlayerSessionPrincipal


async def complete_observation_exercise(
    session: AsyncSession,
    principal: PlayerSessionPrincipal,
    *,
    slug: str,
    score: int,
    accuracy: float,
    response_time_ms: int,
    correct_answers: int = 0,
    errors: int = 0,
    average_reaction_ms: int = 0,
    best_reaction_ms: int = 0,
    duration_ms: int = 0,
    metrics: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if slug not in OBSERVATION_SLUGS:
        raise ValidationError("Unsupported observation exercise")

    try:
        normalized = validate_observation_payload(
            slug=slug,
            score=score,
            accuracy=accuracy,
            response_time_ms=response_time_ms,
            correct_answers=correct_answers,
            errors=errors,
            average_reaction_ms=average_reaction_ms,
            best_reaction_ms=best_reaction_ms,
            duration_ms=duration_ms,
            metrics=metrics,
        )
    except ValueError as exc:
        raise ValidationError(str(exc)) from exc

    progress = await player_access_service.get_progress(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
    )
    exercise = next((ex for ex in progress.exercises if ex.slug == slug), None)
    if exercise is None:
        raise ValidationError("Ce test ne fait pas partie de la session.")
    if exercise.completed:
        raise ConflictError("Déjà enregistré.")

    try:
        await player_access_service.start_exercise(
            session,
            player_id=principal.player_id,
            session_id=principal.session_id,
            session_player_id=principal.session_player_id,
            session_exercise_id=exercise.session_exercise_id,
        )
    except ValidationError:
        # already in progress is fine
        pass

    payload = CompleteExerciseRequest(
        score=normalized["score"],
        accuracy=Decimal(str(normalized["accuracy"])),
        response_time_ms=int(normalized["response_time_ms"]),
        result_data=normalized["result_data"],
    )
    try:
        updated = await player_access_service.complete_exercise(
            session,
            player_id=principal.player_id,
            session_id=principal.session_id,
            session_player_id=principal.session_player_id,
            session_exercise_id=exercise.session_exercise_id,
            payload=payload,
        )
    except ValidationError as exc:
        if "already completed" in exc.message.lower():
            raise ConflictError("Déjà enregistré.") from exc
        raise

    return updated.model_dump(mode="json")
