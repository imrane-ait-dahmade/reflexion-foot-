"""SQLAlchemy repositories for teams and memberships."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.teams.infrastructure.models import Team, TeamPlayer, TeamStaff
from app.shared.infrastructure.database.models import import_all_models

import_all_models()


class TeamRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, team_id: uuid.UUID) -> Team | None:
        return await self._session.scalar(select(Team).where(Team.id == team_id))

    async def add(self, team: Team) -> Team:
        self._session.add(team)
        await self._session.flush()
        return team

    async def find_active_by_name(self, name: str) -> Team | None:
        return await self._session.scalar(
            select(Team).where(
                Team.is_active.is_(True),
                func.lower(Team.name) == name.strip().lower(),
            )
        )

    async def list_teams(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        is_active: bool | None = None,
        team_ids: list[uuid.UUID] | None = None,
    ) -> tuple[list[Team], int]:
        filters = []
        if search:
            term = f"%{search.strip().lower()}%"
            filters.append(func.lower(Team.name).like(term))
        if is_active is not None:
            filters.append(Team.is_active.is_(is_active))
        if team_ids is not None:
            if not team_ids:
                return [], 0
            filters.append(Team.id.in_(team_ids))

        where_clause = and_(*filters) if filters else True
        total = int(
            await self._session.scalar(select(func.count()).select_from(Team).where(where_clause))
            or 0
        )
        stmt = (
            select(Team)
            .where(where_clause)
            .order_by(Team.created_at.desc(), Team.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return list((await self._session.scalars(stmt)).all()), total


class TeamStaffRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_team(
        self,
        team_id: uuid.UUID,
        *,
        active_only: bool = True,
    ) -> list[TeamStaff]:
        filters = [TeamStaff.team_id == team_id]
        if active_only:
            filters.append(TeamStaff.is_active.is_(True))
        stmt = (
            select(TeamStaff)
            .where(and_(*filters))
            .options(selectinload(TeamStaff.user))
            .order_by(TeamStaff.joined_at.desc(), TeamStaff.id.desc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_active(
        self,
        *,
        team_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> TeamStaff | None:
        return await self._session.scalar(
            select(TeamStaff).where(
                TeamStaff.team_id == team_id,
                TeamStaff.user_id == user_id,
                TeamStaff.is_active.is_(True),
            )
        )

    async def active_team_ids_for_user(self, user_id: uuid.UUID) -> list[uuid.UUID]:
        stmt = select(TeamStaff.team_id).where(
            TeamStaff.user_id == user_id,
            TeamStaff.is_active.is_(True),
        )
        return list((await self._session.scalars(stmt)).all())

    async def add(self, membership: TeamStaff) -> TeamStaff:
        self._session.add(membership)
        await self._session.flush()
        return membership

    async def deactivate(self, membership: TeamStaff, *, at: datetime) -> None:
        membership.is_active = False
        membership.left_at = at
        membership.updated_at = at
        await self._session.flush()


class TeamPlayerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_team(
        self,
        team_id: uuid.UUID,
        *,
        active_only: bool = True,
    ) -> list[TeamPlayer]:
        filters = [TeamPlayer.team_id == team_id]
        if active_only:
            filters.append(TeamPlayer.is_active.is_(True))
        stmt = (
            select(TeamPlayer)
            .where(and_(*filters))
            .options(selectinload(TeamPlayer.player))
            .order_by(TeamPlayer.joined_at.desc(), TeamPlayer.id.desc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_active(
        self,
        *,
        team_id: uuid.UUID,
        player_id: uuid.UUID,
    ) -> TeamPlayer | None:
        return await self._session.scalar(
            select(TeamPlayer).where(
                TeamPlayer.team_id == team_id,
                TeamPlayer.player_id == player_id,
                TeamPlayer.is_active.is_(True),
            )
        )

    async def add(self, membership: TeamPlayer) -> TeamPlayer:
        self._session.add(membership)
        await self._session.flush()
        return membership

    async def deactivate(self, membership: TeamPlayer, *, at: datetime) -> None:
        membership.is_active = False
        membership.left_at = at
        membership.updated_at = at
        await self._session.flush()

    def visible_player_ids_subquery(self, user_id: uuid.UUID):
        """SQL subquery of player ids visible to a non-admin staff user."""
        return (
            select(TeamPlayer.player_id)
            .join(
                TeamStaff,
                and_(
                    TeamStaff.team_id == TeamPlayer.team_id,
                    TeamStaff.user_id == user_id,
                    TeamStaff.is_active.is_(True),
                ),
            )
            .where(TeamPlayer.is_active.is_(True))
            .distinct()
        )
