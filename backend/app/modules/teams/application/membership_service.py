"""Team staff and player membership use cases."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.modules.identity.infrastructure.repositories import UserRepository
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.players.infrastructure.repositories import PlayerRepository
from app.modules.teams.application.schemas import (
    AssignTeamPlayerRequest,
    AssignTeamStaffRequest,
    TeamPlayerMembershipResponse,
    TeamStaffResponse,
)
from app.modules.teams.application.team_access import (
    assert_can_access_team,
    assert_can_manage_team_players,
)
from app.modules.teams.infrastructure.models import TeamPlayer, TeamStaff
from app.modules.teams.infrastructure.repositories import (
    TeamPlayerRepository,
    TeamStaffRepository,
)


def _serialize_staff(row: TeamStaff) -> TeamStaffResponse:
    return TeamStaffResponse(
        id=row.id,
        team_id=row.team_id,
        user_id=row.user_id,
        user_full_name=row.user.full_name if row.user is not None else None,
        user_email=row.user.email if row.user is not None else None,
        team_role=row.team_role,  # type: ignore[arg-type]
        is_active=row.is_active,
        joined_at=row.joined_at,
        left_at=row.left_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _serialize_player(row: TeamPlayer) -> TeamPlayerMembershipResponse:
    return TeamPlayerMembershipResponse(
        id=row.id,
        team_id=row.team_id,
        player_id=row.player_id,
        player_first_name=row.player.first_name if row.player is not None else None,
        player_last_name=row.player.last_name if row.player is not None else None,
        is_active=row.is_active,
        joined_at=row.joined_at,
        left_at=row.left_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def list_staff(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
) -> list[TeamStaffResponse]:
    await assert_can_access_team(session, user, team_id)
    rows = await TeamStaffRepository(session).list_for_team(team_id, active_only=True)
    return [_serialize_staff(r) for r in rows]


async def assign_staff(
    session: AsyncSession,
    team_id: uuid.UUID,
    payload: AssignTeamStaffRequest,
) -> TeamStaffResponse:
    from app.modules.teams.infrastructure.repositories import TeamRepository

    team = await TeamRepository(session).get_by_id(team_id)
    if team is None:
        raise NotFoundError("Team not found")
    if not team.is_active:
        raise ValidationError("Cannot assign staff to an inactive team")

    staff_user = await UserRepository(session).get_by_id(payload.user_id)
    if staff_user is None or not staff_user.is_active:
        raise ValidationError("Staff user not found or inactive")

    repo = TeamStaffRepository(session)
    if await repo.get_active(team_id=team_id, user_id=payload.user_id) is not None:
        raise ConflictError("User already has an active membership on this team")

    membership = TeamStaff(
        team_id=team_id,
        user_id=payload.user_id,
        team_role=payload.team_role,
        is_active=True,
    )
    await repo.add(membership)
    await session.commit()
    rows = await repo.list_for_team(team_id, active_only=True)
    loaded = next(r for r in rows if r.id == membership.id)
    return _serialize_staff(loaded)


async def remove_staff(
    session: AsyncSession,
    team_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    from app.modules.teams.infrastructure.repositories import TeamRepository

    team = await TeamRepository(session).get_by_id(team_id)
    if team is None:
        raise NotFoundError("Team not found")
    repo = TeamStaffRepository(session)
    membership = await repo.get_active(team_id=team_id, user_id=user_id)
    if membership is None:
        raise NotFoundError("Active staff membership not found")
    await repo.deactivate(membership, at=datetime.now(UTC))
    await session.commit()


async def list_team_players(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
) -> list[TeamPlayerMembershipResponse]:
    await assert_can_access_team(session, user, team_id)
    rows = await TeamPlayerRepository(session).list_for_team(team_id, active_only=True)
    return [_serialize_player(r) for r in rows]


async def assign_player(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
    payload: AssignTeamPlayerRequest,
) -> TeamPlayerMembershipResponse:
    await assert_can_manage_team_players(session, user, team_id)
    player = await PlayerRepository(session).get_by_id(payload.player_id)
    if player is None:
        raise NotFoundError("Player not found")
    if not player.is_active:
        raise ValidationError("Cannot assign an inactive player")

    repo = TeamPlayerRepository(session)
    if await repo.get_active(team_id=team_id, player_id=payload.player_id) is not None:
        raise ConflictError("Player already has an active membership on this team")

    membership = TeamPlayer(
        team_id=team_id,
        player_id=payload.player_id,
        is_active=True,
    )
    await repo.add(membership)
    await session.commit()
    rows = await repo.list_for_team(team_id, active_only=True)
    loaded = next(r for r in rows if r.id == membership.id)
    return _serialize_player(loaded)


async def remove_player(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
    player_id: uuid.UUID,
) -> None:
    await assert_can_manage_team_players(session, user, team_id)
    repo = TeamPlayerRepository(session)
    membership = await repo.get_active(team_id=team_id, player_id=player_id)
    if membership is None:
        raise NotFoundError("Active player membership not found")
    await repo.deactivate(membership, at=datetime.now(UTC))
    await session.commit()
