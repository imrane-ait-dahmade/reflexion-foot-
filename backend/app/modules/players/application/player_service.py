"""Player CRUD, status, and access-code use cases."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.players.application.credentials import (
    generate_access_code,
    hash_access_code,
)
from app.modules.players.application.schemas import (
    AccessCodeRotateResponse,
    CreatePlayerRequest,
    PlayerCreateResponse,
    PlayerListResponse,
    PlayerResponse,
    PositionResponse,
    UpdatePlayerRequest,
)
from app.modules.players.infrastructure.models import Player, PlayerCredential
from app.modules.players.infrastructure.repositories import (
    PlayerCredentialRepository,
    PlayerRepository,
    PositionRepository,
)
from app.modules.teams.application.team_access import (
    assert_can_access_player,
    assert_team_assignable_for_actor,
    assign_player_to_team,
    is_platform_admin,
    player_visibility_clause,
)
from app.shared.infrastructure.database.enums import PreferredFoot


def _serialize_player(player: Player) -> PlayerResponse:
    secondary = [
        PositionResponse.model_validate(sp.position)
        for sp in player.secondary_positions
        if sp.position is not None
    ]
    return PlayerResponse(
        id=player.id,
        first_name=player.first_name,
        last_name=player.last_name,
        date_of_birth=player.date_of_birth,
        nationality=player.nationality,
        gender=player.gender,  # type: ignore[arg-type]
        email=player.email,
        phone=player.phone,
        primary_position_id=player.primary_position_id,
        primary_position=(
            PositionResponse.model_validate(player.primary_position)
            if player.primary_position is not None
            else None
        ),
        secondary_position_ids=[sp.position_id for sp in player.secondary_positions],
        secondary_positions=secondary,
        preferred_foot=(
            None
            if player.preferred_foot is None
            else getattr(player.preferred_foot, "value", player.preferred_foot)
        ),
        height_cm=player.height_cm,
        weight_kg=player.weight_kg,
        jersey_number=player.jersey_number,
        is_active=player.is_active,
        created_at=player.created_at,
        updated_at=player.updated_at,
        archived_at=player.archived_at,
    )


async def _ensure_positions(
    positions: PositionRepository,
    *,
    primary_id: uuid.UUID,
    secondary_ids: list[uuid.UUID],
) -> None:
    primary = await positions.get_by_id(primary_id)
    if primary is None or not primary.is_active:
        raise ValidationError("Primary position not found or inactive")
    if primary_id in secondary_ids:
        raise ValidationError("Secondary position cannot match primary position")
    if len(secondary_ids) != len(set(secondary_ids)):
        raise ValidationError("Duplicate secondary positions are not allowed")
    if secondary_ids:
        found = await positions.get_many_by_ids(secondary_ids)
        found_ids = {p.id for p in found if p.is_active}
        missing = set(secondary_ids) - found_ids
        if missing:
            raise ValidationError("One or more secondary positions are invalid")


async def list_positions(session: AsyncSession) -> list[PositionResponse]:
    rows = await PositionRepository(session).list_active()
    return [PositionResponse.model_validate(p) for p in rows]


async def list_players(
    session: AsyncSession,
    user: AuthenticatedUser,
    *,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    primary_position_id: uuid.UUID | None = None,
    is_active: bool | None = None,
) -> PlayerListResponse:
    if page < 1:
        raise ValidationError("page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise ValidationError("page_size must be between 1 and 100")
    rows, total = await PlayerRepository(session).list_players(
        page=page,
        page_size=page_size,
        search=search,
        primary_position_id=primary_position_id,
        is_active=is_active,
        visibility_clause=player_visibility_clause(user),
    )
    return PlayerListResponse(
        items=[_serialize_player(p) for p in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_player(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
) -> PlayerResponse:
    await assert_can_access_player(session, user, player_id)
    player = await PlayerRepository(session).get_by_id(player_id)
    if player is None:
        raise NotFoundError("Player not found")
    return _serialize_player(player)


async def create_player(
    session: AsyncSession,
    payload: CreatePlayerRequest,
    *,
    actor: AuthenticatedUser | None = None,
    commit: bool = True,
) -> PlayerCreateResponse:
    positions = PositionRepository(session)
    await _ensure_positions(
        positions,
        primary_id=payload.primary_position_id,
        secondary_ids=payload.secondary_position_ids,
    )

    team_id = payload.team_id
    if actor is not None and not is_platform_admin(actor):
        if team_id is None:
            raise ValidationError("team_id is required for non-admin player creation")
        await assert_team_assignable_for_actor(session, actor, team_id)
    elif team_id is not None and actor is not None:
        await assert_team_assignable_for_actor(session, actor, team_id)

    player = Player(
        first_name=payload.first_name,
        last_name=payload.last_name,
        date_of_birth=payload.date_of_birth,
        nationality=payload.nationality,
        gender=payload.gender,
        email=str(payload.email).lower() if payload.email else None,
        phone=payload.phone,
        primary_position_id=payload.primary_position_id,
        preferred_foot=(PreferredFoot(payload.preferred_foot) if payload.preferred_foot else None),
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        jersey_number=payload.jersey_number,
        is_active=True,
    )
    repo = PlayerRepository(session)
    await repo.add(player)
    if payload.secondary_position_ids:
        await repo.replace_secondary_positions(player, payload.secondary_position_ids)

    access_code = generate_access_code()
    await PlayerCredentialRepository(session).add(
        PlayerCredential(
            player_id=player.id,
            code_hash=hash_access_code(access_code),
        )
    )
    if team_id is not None:
        await assign_player_to_team(session, team_id=team_id, player_id=player.id)

    if commit:
        await session.commit()
    else:
        await session.flush()

    loaded = await repo.get_by_id(player.id)
    assert loaded is not None
    base = _serialize_player(loaded)
    return PlayerCreateResponse(**base.model_dump(), access_code=access_code)


async def update_player(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
    payload: UpdatePlayerRequest,
) -> PlayerResponse:
    await assert_can_access_player(session, user, player_id)
    repo = PlayerRepository(session)
    player = await repo.get_by_id(player_id)
    if player is None:
        raise NotFoundError("Player not found")

    positions = PositionRepository(session)
    next_primary = (
        payload.primary_position_id
        if payload.primary_position_id is not None
        else player.primary_position_id
    )
    next_secondary = (
        payload.secondary_position_ids
        if payload.secondary_position_ids is not None
        else [sp.position_id for sp in player.secondary_positions]
    )
    if payload.primary_position_id is not None or payload.secondary_position_ids is not None:
        await _ensure_positions(
            positions,
            primary_id=next_primary,
            secondary_ids=next_secondary,
        )

    if payload.first_name is not None:
        player.first_name = payload.first_name
    if payload.last_name is not None:
        player.last_name = payload.last_name
    if payload.primary_position_id is not None:
        player.primary_position_id = payload.primary_position_id
    if payload.clear_date_of_birth:
        player.date_of_birth = None
    elif payload.date_of_birth is not None:
        player.date_of_birth = payload.date_of_birth
    if payload.clear_nationality:
        player.nationality = None
    elif payload.nationality is not None:
        player.nationality = payload.nationality
    if payload.clear_gender:
        player.gender = None
    elif payload.gender is not None:
        player.gender = payload.gender
    if payload.clear_email:
        player.email = None
    elif payload.email is not None:
        player.email = str(payload.email).lower()
    if payload.clear_phone:
        player.phone = None
    elif payload.phone is not None:
        player.phone = payload.phone
    if payload.clear_preferred_foot:
        player.preferred_foot = None
    elif payload.preferred_foot is not None:
        player.preferred_foot = PreferredFoot(payload.preferred_foot)
    if payload.clear_height_cm:
        player.height_cm = None
    elif payload.height_cm is not None:
        player.height_cm = payload.height_cm
    if payload.clear_weight_kg:
        player.weight_kg = None
    elif payload.weight_kg is not None:
        player.weight_kg = Decimal(payload.weight_kg)
    if payload.clear_jersey_number:
        player.jersey_number = None
    elif payload.jersey_number is not None:
        player.jersey_number = payload.jersey_number

    if payload.secondary_position_ids is not None:
        await repo.replace_secondary_positions(player, payload.secondary_position_ids)

    player.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(player.id)
    assert loaded is not None
    return _serialize_player(loaded)


async def set_player_status(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
    *,
    is_active: bool,
) -> PlayerResponse:
    await assert_can_access_player(session, user, player_id)
    repo = PlayerRepository(session)
    player = await repo.get_by_id(player_id)
    if player is None:
        raise NotFoundError("Player not found")

    player.is_active = is_active
    now = datetime.now(UTC)
    player.updated_at = now
    if is_active:
        player.archived_at = None
    else:
        player.archived_at = now
    await session.commit()
    loaded = await repo.get_by_id(player.id)
    assert loaded is not None
    return _serialize_player(loaded)


async def rotate_access_code(
    session: AsyncSession,
    user: AuthenticatedUser,
    player_id: uuid.UUID,
) -> AccessCodeRotateResponse:
    await assert_can_access_player(session, user, player_id)
    repo = PlayerRepository(session)
    player = await repo.get_by_id(player_id)
    if player is None:
        raise NotFoundError("Player not found")

    creds = PlayerCredentialRepository(session)
    now = datetime.now(UTC)
    await creds.revoke_active(player_id, at=now)
    access_code = generate_access_code()
    await creds.add(
        PlayerCredential(
            player_id=player_id,
            code_hash=hash_access_code(access_code),
        )
    )
    player.updated_at = now
    await session.commit()
    return AccessCodeRotateResponse(player_id=player_id, access_code=access_code)
