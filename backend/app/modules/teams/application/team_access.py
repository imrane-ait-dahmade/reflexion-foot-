"""Team-scoped authorization helpers (shared with Players APIs)."""

from __future__ import annotations

import uuid

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import ColumnElement

from app.core.exceptions import AuthorizationError, NotFoundError, ValidationError
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.players.infrastructure.models import Player
from app.modules.teams.infrastructure.models import Team, TeamPlayer, TeamStaff
from app.modules.teams.infrastructure.repositories import (
    TeamPlayerRepository,
    TeamRepository,
    TeamStaffRepository,
)


def is_platform_admin(user: AuthenticatedUser) -> bool:
    return "admin" in user.roles


async def active_team_ids_for(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[uuid.UUID]:
    return await TeamStaffRepository(session).active_team_ids_for_user(user_id)


async def assert_can_access_team(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
) -> Team:
    team = await TeamRepository(session).get_by_id(team_id)
    if team is None:
        raise NotFoundError("Team not found")
    if is_platform_admin(user):
        return team
    membership = await TeamStaffRepository(session).get_active(
        team_id=team_id,
        user_id=user.id,
    )
    if membership is None:
        raise NotFoundError("Team not found")
    return team


async def assert_can_manage_team_players(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
) -> Team:
    team = await assert_can_access_team(session, user, team_id)
    if is_platform_admin(user):
        if not team.is_active:
            raise ValidationError("Cannot manage players on an inactive team")
        return team
    if "teams.players.manage" not in user.permissions:
        raise AuthorizationError("Insufficient permissions")
    if not team.is_active:
        raise ValidationError("Cannot manage players on an inactive team")
    return team


def player_visibility_clause(
    user: AuthenticatedUser,
) -> ColumnElement[bool] | None:
    """Return a SQLAlchemy filter for Player rows, or None for unrestricted admin."""
    if is_platform_admin(user):
        return None
    visible = (
        select(TeamPlayer.player_id)
        .join(
            TeamStaff,
            and_(
                TeamStaff.team_id == TeamPlayer.team_id,
                TeamStaff.user_id == user.id,
                TeamStaff.is_active.is_(True),
            ),
        )
        .where(TeamPlayer.is_active.is_(True))
        .distinct()
    )
    return Player.id.in_(visible)


async def assert_can_access_player(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
) -> Player:
    clause = player_visibility_clause(user)
    stmt = select(Player).where(Player.id == player_id)
    if clause is not None:
        stmt = stmt.where(clause)
    player = await session.scalar(stmt)
    if player is None:
        raise NotFoundError("Player not found")
    return player


async def assert_team_assignable_for_actor(
    session: AsyncSession,
    user: AuthenticatedUser,
    team_id: uuid.UUID,
) -> Team:
    """Non-admin must actively belong to an active team to assign new players."""
    team = await TeamRepository(session).get_by_id(team_id)
    if team is None or not team.is_active:
        raise ValidationError("Team not found or inactive")
    if is_platform_admin(user):
        return team
    membership = await TeamStaffRepository(session).get_active(
        team_id=team_id,
        user_id=user.id,
    )
    if membership is None:
        raise AuthorizationError("Not assigned to this team")
    return team


async def assign_player_to_team(
    session: AsyncSession,
    *,
    team_id: uuid.UUID,
    player_id: uuid.UUID,
) -> TeamPlayer:
    repo = TeamPlayerRepository(session)
    existing = await repo.get_active(team_id=team_id, player_id=player_id)
    if existing is not None:
        return existing
    membership = TeamPlayer(team_id=team_id, player_id=player_id, is_active=True)
    await repo.add(membership)
    return membership
