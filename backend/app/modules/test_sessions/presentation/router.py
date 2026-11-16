"""Staff training-session HTTP endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.presentation.deps import (
    AuthenticatedUser,
    require_permissions,
)
from app.modules.test_sessions.application import session_service
from app.modules.test_sessions.application.schemas import (
    AddSessionPlayersRequest,
    CognitiveTestResponse,
    CreateSessionRequest,
    ReplaceSessionExercisesRequest,
    SessionListResponse,
    SessionResponse,
)
from app.shared.infrastructure.database.enums import SessionStatus
from app.shared.infrastructure.database.session import get_db

sessions_router = APIRouter(prefix="/sessions", tags=["sessions"])
cognitive_tests_router = APIRouter(prefix="/cognitive-tests", tags=["cognitive-tests"])


@cognitive_tests_router.get("", response_model=list[CognitiveTestResponse])
async def list_cognitive_tests(
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("sessions.view")),
) -> list[CognitiveTestResponse]:
    return await session_service.list_cognitive_tests(session)


@sessions_router.get("", response_model=SessionListResponse)
async def list_sessions(
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.view")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    status_filter: SessionStatus | None = Query(None, alias="status"),
) -> SessionListResponse:
    return await session_service.list_sessions(
        session,
        current,
        page=page,
        page_size=page_size,
        search=search,
        status=status_filter,
    )


@sessions_router.post(
    "",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_session(
    payload: CreateSessionRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.create_session(session, current, payload)


@sessions_router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.view")),
) -> SessionResponse:
    return await session_service.get_session(session, current, session_id)


@sessions_router.post("/{session_id}/players", response_model=SessionResponse)
async def add_session_players(
    session_id: uuid.UUID,
    payload: AddSessionPlayersRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.add_players(session, current, session_id, payload)


@sessions_router.delete(
    "/{session_id}/players/{player_id}",
    response_model=SessionResponse,
)
async def remove_session_player(
    session_id: uuid.UUID,
    player_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.remove_player(session, current, session_id, player_id)


@sessions_router.put("/{session_id}/exercises", response_model=SessionResponse)
async def replace_session_exercises(
    session_id: uuid.UUID,
    payload: ReplaceSessionExercisesRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.replace_exercises(
        session,
        current,
        session_id,
        payload,
    )


@sessions_router.post("/{session_id}/start", response_model=SessionResponse)
async def start_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.start_session(session, current, session_id)


@sessions_router.post("/{session_id}/complete", response_model=SessionResponse)
async def complete_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.complete_session(session, current, session_id)


@sessions_router.post("/{session_id}/cancel", response_model=SessionResponse)
async def cancel_session(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.cancel_session(session, current, session_id)


@sessions_router.post("/{session_id}/code/rotate", response_model=SessionResponse)
async def rotate_session_code(
    session_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("sessions.manage")),
) -> SessionResponse:
    return await session_service.rotate_session_code(session, current, session_id)
