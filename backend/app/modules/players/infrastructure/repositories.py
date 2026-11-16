"""SQLAlchemy repositories for players management."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import and_, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.players.infrastructure.models import (
    Player,
    PlayerCredential,
    PlayerNote,
    PlayerSecondaryPosition,
    Position,
)
from app.shared.infrastructure.database.models import import_all_models

import_all_models()


def _player_load_options():
    return (
        selectinload(Player.primary_position),
        selectinload(Player.secondary_positions).selectinload(PlayerSecondaryPosition.position),
    )


class PositionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_active(self) -> list[Position]:
        stmt = (
            select(Position)
            .where(Position.is_active.is_(True))
            .order_by(Position.display_order.asc(), Position.code.asc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_by_id(self, position_id: uuid.UUID) -> Position | None:
        return await self._session.scalar(select(Position).where(Position.id == position_id))

    async def get_by_code(self, code: str) -> Position | None:
        return await self._session.scalar(
            select(Position).where(Position.code == code.strip().upper())
        )

    async def get_many_by_ids(self, ids: list[uuid.UUID]) -> list[Position]:
        if not ids:
            return []
        stmt = select(Position).where(Position.id.in_(ids))
        return list((await self._session.scalars(stmt)).all())


class PlayerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, player_id: uuid.UUID) -> Player | None:
        stmt = select(Player).where(Player.id == player_id).options(*_player_load_options())
        return await self._session.scalar(stmt)

    async def add(self, player: Player) -> Player:
        self._session.add(player)
        await self._session.flush()
        return player

    async def list_players(
        self,
        *,
        page: int,
        page_size: int,
        search: str | None = None,
        primary_position_id: uuid.UUID | None = None,
        is_active: bool | None = None,
        visibility_clause=None,
    ) -> tuple[list[Player], int]:
        filters = []
        if visibility_clause is not None:
            filters.append(visibility_clause)
        if search:
            term = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(Player.first_name).like(term),
                    func.lower(Player.last_name).like(term),
                    func.lower(func.concat(Player.first_name, " ", Player.last_name)).like(term),
                )
            )
        if primary_position_id is not None:
            filters.append(Player.primary_position_id == primary_position_id)
        if is_active is not None:
            filters.append(Player.is_active.is_(is_active))

        where_clause = and_(*filters) if filters else True

        count_stmt = select(func.count()).select_from(Player).where(where_clause)
        total = int(await self._session.scalar(count_stmt) or 0)

        stmt = (
            select(Player)
            .where(where_clause)
            .options(*_player_load_options())
            .order_by(Player.created_at.desc(), Player.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = list((await self._session.scalars(stmt)).all())
        return rows, total

    async def find_name_dob_matches(
        self,
        *,
        first_name: str,
        last_name: str,
        date_of_birth: date | None,
    ) -> list[Player]:
        fn = first_name.strip().lower()
        ln = last_name.strip().lower()
        conditions = [
            func.lower(Player.first_name) == fn,
            func.lower(Player.last_name) == ln,
        ]
        if date_of_birth is not None:
            conditions.append(Player.date_of_birth == date_of_birth)
        stmt = select(Player).where(and_(*conditions)).options(*_player_load_options())
        return list((await self._session.scalars(stmt)).all())

    async def replace_secondary_positions(
        self,
        player: Player,
        position_ids: list[uuid.UUID],
    ) -> None:
        await self._session.execute(
            delete(PlayerSecondaryPosition).where(PlayerSecondaryPosition.player_id == player.id)
        )
        for pid in position_ids:
            self._session.add(PlayerSecondaryPosition(player_id=player.id, position_id=pid))
        await self._session.flush()
        # Expire so subsequent loads see the new secondary rows.
        self._session.expire(player, ["secondary_positions"])


class PlayerCredentialRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_active(self, player_id: uuid.UUID) -> PlayerCredential | None:
        stmt = select(PlayerCredential).where(
            PlayerCredential.player_id == player_id,
            PlayerCredential.revoked_at.is_(None),
        )
        return await self._session.scalar(stmt)

    async def revoke_active(self, player_id: uuid.UUID, *, at: datetime) -> None:
        active = await self.get_active(player_id)
        if active is not None:
            active.revoked_at = at
            await self._session.flush()

    async def add(self, credential: PlayerCredential) -> PlayerCredential:
        self._session.add(credential)
        await self._session.flush()
        return credential


class PlayerNoteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_for_player(self, player_id: uuid.UUID) -> list[PlayerNote]:
        stmt = (
            select(PlayerNote)
            .where(PlayerNote.player_id == player_id)
            .order_by(PlayerNote.created_at.desc(), PlayerNote.id.desc())
        )
        return list((await self._session.scalars(stmt)).all())

    async def get_by_id(
        self,
        *,
        player_id: uuid.UUID,
        note_id: uuid.UUID,
    ) -> PlayerNote | None:
        stmt = select(PlayerNote).where(
            PlayerNote.id == note_id,
            PlayerNote.player_id == player_id,
        )
        return await self._session.scalar(stmt)

    async def add(self, note: PlayerNote) -> PlayerNote:
        self._session.add(note)
        await self._session.flush()
        return note

    async def delete(self, note: PlayerNote) -> None:
        await self._session.delete(note)
        await self._session.flush()
