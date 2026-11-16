"""Teams management HTTP endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.identity.presentation.deps import (
    AuthenticatedUser,
    require_permissions,
)
from app.modules.teams.application import membership_service, team_service
from app.modules.teams.application.schemas import (
    AssignTeamPlayerRequest,
    AssignTeamStaffRequest,
    CreateTeamRequest,
    TeamListResponse,
    TeamPlayerMembershipResponse,
    TeamResponse,
    TeamStaffResponse,
    UpdateTeamRequest,
    UpdateTeamStatusRequest,
)
from app.shared.infrastructure.database.session import get_db

teams_router = APIRouter(prefix="/teams", tags=["teams"])


@teams_router.get("", response_model=TeamListResponse)
async def list_teams(
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("teams.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    is_active: bool | None = Query(None),
) -> TeamListResponse:
    return await team_service.list_teams(
        session,
        current,
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
    )


@teams_router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: CreateTeamRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("teams.create")),
) -> TeamResponse:
    return await team_service.create_team(session, payload)


@teams_router.get("/{team_id}", response_model=TeamResponse)
async def get_team(
    team_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("teams.read")),
) -> TeamResponse:
    return await team_service.get_team(session, current, team_id)


@teams_router.patch("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    payload: UpdateTeamRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("teams.update")),
) -> TeamResponse:
    return await team_service.update_team(session, team_id, payload)


@teams_router.patch("/{team_id}/status", response_model=TeamResponse)
async def update_team_status(
    team_id: uuid.UUID,
    payload: UpdateTeamStatusRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("teams.deactivate")),
) -> TeamResponse:
    return await team_service.set_team_status(
        session,
        team_id,
        is_active=payload.is_active,
    )


@teams_router.get("/{team_id}/staff", response_model=list[TeamStaffResponse])
async def list_team_staff(
    team_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("teams.read")),
) -> list[TeamStaffResponse]:
    return await membership_service.list_staff(session, current, team_id)


@teams_router.post(
    "/{team_id}/staff",
    response_model=TeamStaffResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_team_staff(
    team_id: uuid.UUID,
    payload: AssignTeamStaffRequest,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("teams.staff.manage")),
) -> TeamStaffResponse:
    return await membership_service.assign_staff(session, team_id, payload)


@teams_router.delete(
    "/{team_id}/staff/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_staff(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("teams.staff.manage")),
) -> None:
    await membership_service.remove_staff(session, team_id, user_id)


@teams_router.get(
    "/{team_id}/players",
    response_model=list[TeamPlayerMembershipResponse],
)
async def list_team_players(
    team_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("teams.players.read")),
) -> list[TeamPlayerMembershipResponse]:
    return await membership_service.list_team_players(session, current, team_id)


@teams_router.post(
    "/{team_id}/players",
    response_model=TeamPlayerMembershipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_team_player(
    team_id: uuid.UUID,
    payload: AssignTeamPlayerRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("teams.players.manage")),
) -> TeamPlayerMembershipResponse:
    return await membership_service.assign_player(session, current, team_id, payload)


@teams_router.delete(
    "/{team_id}/players/{player_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_team_player(
    team_id: uuid.UUID,
    player_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("teams.players.manage")),
) -> None:
    await membership_service.remove_player(session, current, team_id, player_id)
