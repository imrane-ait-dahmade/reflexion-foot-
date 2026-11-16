"""Player challenge + observation exercise endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.modules.cognitive_engines.application import challenge_service
from app.modules.cognitive_engines.application import observation_service
from app.modules.cognitive_engines.application.schemas import (
    DigitMemoryRequest,
    DualTargetRequest,
    ObservationCompleteRequest,
)
from app.modules.cognitive_engines.observation import OBSERVATION_SLUGS
from app.modules.test_sessions.presentation.deps import (
    PlayerSessionPrincipal,
    get_player_session,
)
from app.shared.infrastructure.database.session import get_db

player_exercises_router = APIRouter(
    prefix="/player/exercises",
    tags=["player-exercises"],
)


@player_exercises_router.post("/digit-memory")
async def digit_memory_challenge(
    payload: DigitMemoryRequest,
    session: AsyncSession = Depends(get_db),
    principal: PlayerSessionPrincipal = Depends(get_player_session),
) -> dict[str, Any]:
    return await challenge_service.handle_digit_memory(
        session,
        principal,
        action=payload.action,
        token=payload.token,
        answer=payload.answer,
    )


@player_exercises_router.post("/dual-target-tracking")
async def dual_target_challenge(
    payload: DualTargetRequest,
    session: AsyncSession = Depends(get_db),
    principal: PlayerSessionPrincipal = Depends(get_player_session),
) -> dict[str, Any]:
    return await challenge_service.handle_dual_target(
        session,
        principal,
        action=payload.action,
        token=payload.token,
        selected=payload.selected,
    )


@player_exercises_router.post("/{slug}/complete")
async def complete_observation_exercise(
    slug: str,
    payload: ObservationCompleteRequest,
    session: AsyncSession = Depends(get_db),
    principal: PlayerSessionPrincipal = Depends(get_player_session),
) -> dict[str, Any]:
    if slug not in OBSERVATION_SLUGS:
        raise ValidationError("Unsupported observation exercise")
    return await observation_service.complete_observation_exercise(
        session,
        principal,
        slug=slug,
        score=payload.score,
        accuracy=payload.accuracy,
        response_time_ms=payload.response_time_ms,
        correct_answers=payload.correct_answers,
        errors=payload.errors,
        average_reaction_ms=payload.average_reaction_ms,
        best_reaction_ms=payload.best_reaction_ms,
        duration_ms=payload.duration_ms,
        metrics=payload.metrics,
    )
