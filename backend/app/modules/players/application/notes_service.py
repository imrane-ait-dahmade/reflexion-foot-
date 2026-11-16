"""Player notes CRUD with authorship rules."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthorizationError, NotFoundError
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.players.application.schemas import (
    CreatePlayerNoteRequest,
    PlayerNoteResponse,
    UpdatePlayerNoteRequest,
)
from app.modules.players.infrastructure.models import PlayerNote
from app.modules.players.infrastructure.repositories import PlayerNoteRepository
from app.modules.teams.application.team_access import assert_can_access_player


def _can_manage_note(
    *,
    author_user_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    actor_permissions: set[str],
) -> bool:
    if author_user_id == actor_user_id:
        return True
    return "players.notes.manage" in actor_permissions


async def list_notes(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
) -> list[PlayerNoteResponse]:
    await assert_can_access_player(session, user, player_id)
    notes = await PlayerNoteRepository(session).list_for_player(player_id)
    return [PlayerNoteResponse.model_validate(n) for n in notes]


async def create_note(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
    payload: CreatePlayerNoteRequest,
) -> PlayerNoteResponse:
    await assert_can_access_player(session, user, player_id)
    note = PlayerNote(
        player_id=player_id,
        author_user_id=user.id,
        content=payload.content,
    )
    await PlayerNoteRepository(session).add(note)
    await session.commit()
    return PlayerNoteResponse.model_validate(note)


async def update_note(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: UpdatePlayerNoteRequest,
) -> PlayerNoteResponse:
    await assert_can_access_player(session, user, player_id)
    repo = PlayerNoteRepository(session)
    note = await repo.get_by_id(player_id=player_id, note_id=note_id)
    if note is None:
        raise NotFoundError("Note not found")
    if not _can_manage_note(
        author_user_id=note.author_user_id,
        actor_user_id=user.id,
        actor_permissions=set(user.permissions),
    ):
        raise AuthorizationError("Only the author or a notes manager can edit this note")
    note.content = payload.content
    note.updated_at = datetime.now(UTC)
    await session.commit()
    return PlayerNoteResponse.model_validate(note)


async def delete_note(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
    note_id: uuid.UUID,
) -> None:
    await assert_can_access_player(session, user, player_id)
    repo = PlayerNoteRepository(session)
    note = await repo.get_by_id(player_id=player_id, note_id=note_id)
    if note is None:
        raise NotFoundError("Note not found")
    if not _can_manage_note(
        author_user_id=note.author_user_id,
        actor_user_id=user.id,
        actor_permissions=set(user.permissions),
    ):
        raise AuthorizationError("Only the author or a notes manager can delete this note")
    await repo.delete(note)
    await session.commit()
