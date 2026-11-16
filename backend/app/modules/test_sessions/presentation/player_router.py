"""Player-facing session join and progress endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.test_sessions.application import player_access_service
from app.modules.test_sessions.application.schemas import (
    CompleteExerciseRequest,
    PlayerJoinRequest,
    PlayerJoinResponse,
    PlayerSessionProgressResponse,
)
from app.modules.test_sessions.presentation.deps import (
    PlayerSessionPrincipal,
    get_player_session,
)
from app.shared.infrastructure.database.session import get_db

player_session_router = APIRouter(prefix="/player/session", tags=["player-session"])


@player_session_router.post("/join", response_model=PlayerJoinResponse)
async def join_session(
    payload: PlayerJoinRequest,
    session: AsyncSession = Depends(get_db),
) -> PlayerJoinResponse:
    return await player_access_service.join_session(session, payload)


@player_session_router.get("", response_model=PlayerSessionProgressResponse)
async def get_player_session_progress(
    session: AsyncSession = Depends(get_db),
    principal: PlayerSessionPrincipal = Depends(get_player_session),
) -> PlayerSessionProgressResponse:
    return await player_access_service.get_progress(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
    )


@player_session_router.post(
    "/exercises/{session_exercise_id}/start",
    response_model=PlayerSessionProgressResponse,
)
async def start_exercise(
    session_exercise_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    principal: PlayerSessionPrincipal = Depends(get_player_session),
) -> PlayerSessionProgressResponse:
    return await player_access_service.start_exercise(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
        session_exercise_id=session_exercise_id,
    )


@player_session_router.post(
    "/exercises/{session_exercise_id}/complete",
    response_model=PlayerSessionProgressResponse,
)
async def complete_exercise(
    session_exercise_id: uuid.UUID,
    payload: CompleteExerciseRequest,
    session: AsyncSession = Depends(get_db),
    principal: PlayerSessionPrincipal = Depends(get_player_session),
) -> PlayerSessionProgressResponse:
    return await player_access_service.complete_exercise(
        session,
        player_id=principal.player_id,
        session_id=principal.session_id,
        session_player_id=principal.session_player_id,
        session_exercise_id=session_exercise_id,
        payload=payload,
    )
