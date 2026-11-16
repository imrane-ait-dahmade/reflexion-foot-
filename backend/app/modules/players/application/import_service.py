"""Excel player import: preview then confirm."""

from __future__ import annotations

import io
import re
import uuid
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from openpyxl import load_workbook
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.modules.identity.presentation.deps import AuthenticatedUser
from app.modules.players.application.player_service import create_player
from app.modules.players.application.schemas import (
    CreatePlayerRequest,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ImportDuplicate,
    ImportPreviewResponse,
    ImportPreviewRow,
    ImportReject,
)
from app.modules.players.infrastructure.repositories import (
    PlayerRepository,
    PositionRepository,
)
from app.modules.teams.application.team_access import (
    assert_team_assignable_for_actor,
    is_platform_admin,
)

REQUIRED_HEADERS = ("first_name", "last_name", "primary_position_code")
OPTIONAL_HEADERS = (
    "secondary_position_codes",
    "date_of_birth",
    "nationality",
    "gender",
    "email",
    "phone",
    "preferred_foot",
    "height_cm",
    "weight_kg",
    "jersey_number",
)
ALL_HEADERS = REQUIRED_HEADERS + OPTIONAL_HEADERS

_HEADER_ALIASES = {
    "firstname": "first_name",
    "first name": "first_name",
    "lastname": "last_name",
    "last name": "last_name",
    "primary_position": "primary_position_code",
    "position": "primary_position_code",
    "position_code": "primary_position_code",
    "secondary_positions": "secondary_position_codes",
    "dob": "date_of_birth",
    "birth_date": "date_of_birth",
}


def _normalize_header(raw: Any) -> str | None:
    if raw is None:
        return None
    key = str(raw).strip().lower().replace("-", "_")
    key = re.sub(r"\s+", " ", key)
    if key in ALL_HEADERS:
        return key
    return _HEADER_ALIASES.get(key)


def _cell_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        text = str(int(value))
    else:
        text = str(value).strip()
    return text or None


def _parse_date(value: Any) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date_of_birth: {text}")


def _parse_int(value: Any, field: str) -> int | None:
    text = _cell_str(value)
    if text is None:
        return None
    try:
        return int(float(text))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid {field}") from exc


def _parse_decimal(value: Any, field: str) -> Decimal | None:
    text = _cell_str(value)
    if text is None:
        return None
    try:
        return Decimal(text)
    except (InvalidOperation, TypeError) as exc:
        raise ValueError(f"Invalid {field}") from exc


def _parse_secondary_codes(value: Any) -> list[str]:
    text = _cell_str(value)
    if text is None:
        return []
    parts = re.split(r"[;,|/]", text)
    codes = [p.strip().upper() for p in parts if p.strip()]
    return list(dict.fromkeys(codes))


def parse_workbook_bytes(content: bytes) -> list[dict[str, Any]]:
    """Parse first sheet into raw row dicts keyed by normalized headers."""
    try:
        wb = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 — openpyxl raises many types
        raise ValidationError("Invalid Excel file") from exc

    try:
        ws = wb.active
        if ws is None:
            raise ValidationError("Excel workbook has no active sheet")
        rows_iter = ws.iter_rows(values_only=True)
        try:
            header_row = next(rows_iter)
        except StopIteration as exc:
            raise ValidationError("Excel sheet is empty") from exc

        headers: list[str | None] = [_normalize_header(h) for h in header_row]
        if not any(headers):
            raise ValidationError("Excel header row is missing recognized columns")
        missing = [h for h in REQUIRED_HEADERS if h not in headers]
        if missing:
            raise ValidationError(
                f"Missing required columns: {', '.join(missing)}",
            )

        parsed: list[dict[str, Any]] = []
        for idx, row in enumerate(rows_iter, start=2):
            if row is None or all(c is None or str(c).strip() == "" for c in row):
                continue
            record: dict[str, Any] = {"row_number": idx}
            for col_idx, header in enumerate(headers):
                if header is None or col_idx >= len(row):
                    continue
                record[header] = row[col_idx]
            parsed.append(record)
        return parsed
    finally:
        wb.close()


async def preview_import(
    session: AsyncSession,
    content: bytes,
) -> ImportPreviewResponse:
    raw_rows = parse_workbook_bytes(content)
    positions = PositionRepository(session)
    players = PlayerRepository(session)

    valid_rows: list[ImportPreviewRow] = []
    rejects: list[ImportReject] = []
    duplicates: list[ImportDuplicate] = []

    for raw in raw_rows:
        row_number = int(raw["row_number"])
        try:
            first_name = _cell_str(raw.get("first_name"))
            last_name = _cell_str(raw.get("last_name"))
            primary_code = (_cell_str(raw.get("primary_position_code")) or "").upper()
            if not first_name or not last_name or not primary_code:
                raise ValueError("first_name, last_name and primary_position_code are required")

            primary = await positions.get_by_code(primary_code)
            if primary is None or not primary.is_active:
                raise ValueError(f"Unknown primary position code: {primary_code}")

            secondary_codes = _parse_secondary_codes(raw.get("secondary_position_codes"))
            if primary_code in secondary_codes:
                raise ValueError("Secondary position cannot match primary position")
            for code in secondary_codes:
                pos = await positions.get_by_code(code)
                if pos is None or not pos.is_active:
                    raise ValueError(f"Unknown secondary position code: {code}")

            dob = _parse_date(raw.get("date_of_birth"))
            if dob is not None and dob > date.today():
                raise ValueError("date_of_birth cannot be in the future")

            gender = _cell_str(raw.get("gender"))
            if gender is not None:
                gender = gender.lower()
                if gender not in {"male", "female", "other", "unspecified"}:
                    raise ValueError("Invalid gender")

            foot = _cell_str(raw.get("preferred_foot"))
            if foot is not None:
                foot = foot.lower()
                if foot not in {"left", "right", "both"}:
                    raise ValueError("Invalid preferred_foot")

            height_cm = _parse_int(raw.get("height_cm"), "height_cm")
            if height_cm is not None and not (100 <= height_cm <= 250):
                raise ValueError("height_cm must be between 100 and 250")
            weight_kg = _parse_decimal(raw.get("weight_kg"), "weight_kg")
            if weight_kg is not None and not (Decimal("30") <= weight_kg <= Decimal("150")):
                raise ValueError("weight_kg must be between 30 and 150")
            jersey = _parse_int(raw.get("jersey_number"), "jersey_number")
            if jersey is not None and not (1 <= jersey <= 99):
                raise ValueError("jersey_number must be between 1 and 99")

            email = _cell_str(raw.get("email"))
            row = ImportPreviewRow(
                row_number=row_number,
                first_name=first_name,
                last_name=last_name,
                primary_position_code=primary_code,
                secondary_position_codes=secondary_codes,
                date_of_birth=dob,
                nationality=_cell_str(raw.get("nationality")),
                gender=gender,  # type: ignore[arg-type]
                email=email,
                phone=_cell_str(raw.get("phone")),
                preferred_foot=foot,  # type: ignore[arg-type]
                height_cm=height_cm,
                weight_kg=weight_kg,
                jersey_number=jersey,
            )

            matches = await players.find_name_dob_matches(
                first_name=row.first_name,
                last_name=row.last_name,
                date_of_birth=row.date_of_birth,
            )
            if matches:
                duplicates.append(
                    ImportDuplicate(
                        row_number=row_number,
                        existing_player_id=matches[0].id,
                        reason="Matching first_name+last_name"
                        + ("+date_of_birth" if row.date_of_birth else ""),
                    )
                )
                continue

            # Also detect duplicates within the same file
            file_dup = False
            for existing in valid_rows:
                same_name = (
                    existing.first_name.lower() == row.first_name.lower()
                    and existing.last_name.lower() == row.last_name.lower()
                )
                if not same_name:
                    continue
                if (
                    row.date_of_birth is None
                    or existing.date_of_birth is None
                    or row.date_of_birth == existing.date_of_birth
                ):
                    duplicates.append(
                        ImportDuplicate(
                            row_number=row_number,
                            existing_player_id=None,
                            reason=f"Duplicate of row {existing.row_number} in file",
                        )
                    )
                    file_dup = True
                    break
            if file_dup:
                continue
            valid_rows.append(row)
        except (ValueError, PydanticValidationError) as exc:
            reason = str(exc)
            if isinstance(exc, PydanticValidationError):
                reason = "; ".join(e.get("msg", "validation error") for e in exc.errors())
            rejects.append(ImportReject(row_number=row_number, reason=reason))

    return ImportPreviewResponse(
        valid_rows=valid_rows,
        rejects=rejects,
        duplicates=duplicates,
        total_rows=len(raw_rows),
        valid_count=len(valid_rows),
        reject_count=len(rejects),
        duplicate_count=len(duplicates),
    )


async def confirm_import(
    session: AsyncSession,
    payload: ImportConfirmRequest,
    *,
    actor: AuthenticatedUser,
) -> ImportConfirmResponse:
    if not is_platform_admin(actor) and payload.team_id is None:
        raise ValidationError("team_id is required for non-admin player import")
    if payload.team_id is not None:
        await assert_team_assignable_for_actor(session, actor, payload.team_id)

    positions = PositionRepository(session)
    players = PlayerRepository(session)
    created = []
    rejects: list[ImportReject] = []
    duplicates: list[ImportDuplicate] = []

    try:
        for row in payload.rows:
            try:
                primary = await positions.get_by_code(row.primary_position_code)
                if primary is None or not primary.is_active:
                    raise ValueError(f"Unknown primary position code: {row.primary_position_code}")
                secondary_ids: list[uuid.UUID] = []
                for code in row.secondary_position_codes:
                    pos = await positions.get_by_code(code)
                    if pos is None or not pos.is_active:
                        raise ValueError(f"Unknown secondary position code: {code}")
                    if pos.id == primary.id:
                        raise ValueError("Secondary position cannot match primary position")
                    secondary_ids.append(pos.id)

                matches = await players.find_name_dob_matches(
                    first_name=row.first_name,
                    last_name=row.last_name,
                    date_of_birth=row.date_of_birth,
                )
                if matches:
                    duplicates.append(
                        ImportDuplicate(
                            row_number=row.row_number,
                            existing_player_id=matches[0].id,
                            reason="Matching first_name+last_name"
                            + ("+date_of_birth" if row.date_of_birth else ""),
                        )
                    )
                    continue

                request = CreatePlayerRequest(
                    first_name=row.first_name,
                    last_name=row.last_name,
                    primary_position_id=primary.id,
                    secondary_position_ids=secondary_ids,
                    team_id=payload.team_id,
                    date_of_birth=row.date_of_birth,
                    nationality=row.nationality,
                    gender=row.gender,
                    email=row.email,
                    phone=row.phone,
                    preferred_foot=row.preferred_foot,
                    height_cm=row.height_cm,
                    weight_kg=row.weight_kg,
                    jersey_number=row.jersey_number,
                )
                player = await create_player(
                    session,
                    request,
                    actor=actor,
                    commit=False,
                )
                created.append(player)
            except (ValueError, ValidationError, PydanticValidationError) as exc:
                reason = str(exc)
                if isinstance(exc, PydanticValidationError):
                    reason = "; ".join(e.get("msg", "validation error") for e in exc.errors())
                elif isinstance(exc, ValidationError):
                    reason = exc.message
                rejects.append(ImportReject(row_number=row.row_number, reason=reason))

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return ImportConfirmResponse(
        created_count=len(created),
        created_players=created,
        rejects=rejects,
        duplicates=duplicates,
    )
