"""Players management HTTP endpoints."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.modules.identity.presentation.deps import (
    AuthenticatedUser,
    get_current_user,
    require_permissions,
)
from app.modules.players.application import (
    import_service,
    notes_service,
    player_service,
)
from app.modules.players.application.schemas import (
    AccessCodeRotateResponse,
    CreatePlayerNoteRequest,
    CreatePlayerRequest,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportPreviewResponse,
    PlayerCreateResponse,
    PlayerListResponse,
    PlayerNoteResponse,
    PlayerResponse,
    PositionResponse,
    UpdatePlayerNoteRequest,
    UpdatePlayerRequest,
    UpdatePlayerStatusRequest,
)
from app.shared.infrastructure.database.session import get_db

players_router = APIRouter(prefix="/players", tags=["players"])
positions_router = APIRouter(prefix="/positions", tags=["positions"])


@positions_router.get("", response_model=list[PositionResponse])
async def list_positions(
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("players.read")),
) -> list[PositionResponse]:
    return await player_service.list_positions(session)


@players_router.get("", response_model=PlayerListResponse)
async def list_players(
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    primary_position_id: uuid.UUID | None = Query(None),
    is_active: bool | None = Query(None),
) -> PlayerListResponse:
    return await player_service.list_players(
        session,
        current,
        page=page,
        page_size=page_size,
        search=search,
        primary_position_id=primary_position_id,
        is_active=is_active,
    )


@players_router.post(
    "",
    response_model=PlayerCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_player(
    payload: CreatePlayerRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.create")),
) -> PlayerCreateResponse:
    return await player_service.create_player(session, payload, actor=current)


@players_router.post("/import/preview", response_model=ImportPreviewResponse)
async def import_preview(
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    _: AuthenticatedUser = Depends(require_permissions("players.import")),
) -> ImportPreviewResponse:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise ValidationError("Upload an .xlsx Excel file")
    content = await file.read()
    if not content:
        raise ValidationError("Uploaded file is empty")
    return await import_service.preview_import(session, content)


@players_router.post("/import/confirm", response_model=ImportConfirmResponse)
async def import_confirm(
    payload: ImportConfirmRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.import")),
) -> ImportConfirmResponse:
    return await import_service.confirm_import(session, payload, actor=current)


@players_router.get("/{player_id}", response_model=PlayerResponse)
async def get_player(
    player_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.read")),
) -> PlayerResponse:
    return await player_service.get_player(session, current, player_id)


@players_router.patch("/{player_id}", response_model=PlayerResponse)
async def update_player(
    player_id: uuid.UUID,
    payload: UpdatePlayerRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.update")),
) -> PlayerResponse:
    return await player_service.update_player(session, current, player_id, payload)


@players_router.patch("/{player_id}/status", response_model=PlayerResponse)
async def update_player_status(
    player_id: uuid.UUID,
    payload: UpdatePlayerStatusRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.deactivate")),
) -> PlayerResponse:
    return await player_service.set_player_status(
        session,
        current,
        player_id,
        is_active=payload.is_active,
    )


@players_router.post(
    "/{player_id}/access-code/rotate",
    response_model=AccessCodeRotateResponse,
)
async def rotate_access_code(
    player_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.update")),
) -> AccessCodeRotateResponse:
    return await player_service.rotate_access_code(session, current, player_id)


@players_router.get("/{player_id}/notes", response_model=list[PlayerNoteResponse])
async def list_notes(
    player_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.notes.manage")),
) -> list[PlayerNoteResponse]:
    return await notes_service.list_notes(session, current, player_id)


@players_router.post(
    "/{player_id}/notes",
    response_model=PlayerNoteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_note(
    player_id: uuid.UUID,
    payload: CreatePlayerNoteRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(require_permissions("players.notes.manage")),
) -> PlayerNoteResponse:
    return await notes_service.create_note(session, current, player_id, payload)


@players_router.patch(
    "/{player_id}/notes/{note_id}",
    response_model=PlayerNoteResponse,
)
async def update_note(
    player_id: uuid.UUID,
    note_id: uuid.UUID,
    payload: UpdatePlayerNoteRequest,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(get_current_user),
) -> PlayerNoteResponse:
    return await notes_service.update_note(
        session,
        current,
        player_id,
        note_id,
        payload,
    )


@players_router.delete(
    "/{player_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_note(
    player_id: uuid.UUID,
    note_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    current: AuthenticatedUser = Depends(get_current_user),
) -> None:
    await notes_service.delete_note(session, current, player_id, note_id)
