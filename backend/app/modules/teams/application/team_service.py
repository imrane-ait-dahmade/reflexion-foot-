"""Team CRUD use cases."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.teams.application.schemas import (
    CreateTeamRequest,
    TeamListResponse,
    TeamResponse,
    UpdateTeamRequest,
)
from app.modules.teams.application.team_access import (
    active_team_ids_for,
    assert_can_access_team,
    is_platform_admin,
)
from app.modules.teams.infrastructure.models import Team
from app.modules.teams.infrastructure.repositories import TeamRepository


def _serialize(team: Team) -> TeamResponse:
    return TeamResponse.model_validate(team)


async def list_teams(
    session: AsyncSession,
    user: AuthenticatedUser,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    is_active: bool | None = None,
) -> TeamListResponse:
    if page < 1:
        raise ValidationError("page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise ValidationError("page_size must be between 1 and 100")

    team_ids: list[uuid.UUID] | None = None
    if not is_platform_admin(user):
        team_ids = await active_team_ids_for(session, user.id)

    rows, total = await TeamRepository(session).list_teams(
        page=page,
        page_size=page_size,
        search=search,
        is_active=is_active,
        team_ids=team_ids,
    )
    return TeamListResponse(
        items=[_serialize(t) for t in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_team(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
) -> TeamResponse:
    team = await assert_can_access_team(session, user, team_id)
    return _serialize(team)


async def create_team(
    session: AsyncSession,
    payload: CreateTeamRequest,
) -> TeamResponse:
    repo = TeamRepository(session)
    existing = await repo.find_active_by_name(payload.name)
    if existing is not None:
        raise ConflictError("An active team with this name already exists")
    team = Team(
        name=payload.name,
        description=payload.description,
        is_active=True,
    )
    await repo.add(team)
    await session.commit()
    loaded = await repo.get_by_id(team.id)
    assert loaded is not None
    return _serialize(loaded)


async def update_team(
    session: AsyncSession,
    team_id: uuid.UUID,
    payload: UpdateTeamRequest,
) -> TeamResponse:
    repo = TeamRepository(session)
    team = await repo.get_by_id(team_id)
    if team is None:
        raise NotFoundError("Team not found")

    if payload.name is not None and payload.name.lower() != team.name.lower():
        clash = await repo.find_active_by_name(payload.name)
        if clash is not None and clash.id != team.id:
            raise ConflictError("An active team with this name already exists")
        team.name = payload.name

    if payload.clear_description:
        team.description = None
    elif payload.description is not None:
        team.description = payload.description

    team.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(team.id)
    assert loaded is not None
    return _serialize(loaded)


async def set_team_status(
    session: AsyncSession,
    team_id: uuid.UUID,
    *,
    is_active: bool,
) -> TeamResponse:
    repo = TeamRepository(session)
    team = await repo.get_by_id(team_id)
    if team is None:
        raise NotFoundError("Team not found")
    if is_active and not team.is_active:
        clash = await repo.find_active_by_name(team.name)
        if clash is not None and clash.id != team.id:
            raise ConflictError("An active team with this name already exists")
    team.is_active = is_active
    team.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(team.id)
    assert loaded is not None
    return _serialize(loaded)
