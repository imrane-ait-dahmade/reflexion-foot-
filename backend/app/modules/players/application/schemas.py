"""Pydantic schemas for players management APIs."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

GenderValue = Literal["male", "female", "other", "unspecified"]
PreferredFootValue = Literal["left", "right", "both"]


def _strip_nonempty(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("Must not be blank")
    return cleaned


class PositionResponse(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class PlayerNoteResponse(BaseModel):
    id: uuid.UUID
    player_id: uuid.UUID
    author_user_id: uuid.UUID
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PlayerResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    date_of_birth: date | None
    nationality: str | None
    gender: GenderValue | None
    email: EmailStr | None
    phone: str | None
    primary_position_id: uuid.UUID
    primary_position: PositionResponse | None = None
    secondary_position_ids: list[uuid.UUID] = Field(default_factory=list)
    secondary_positions: list[PositionResponse] = Field(default_factory=list)
    preferred_foot: PreferredFootValue | None
    height_cm: int | None
    weight_kg: Decimal | None
    jersey_number: int | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class PlayerCreateResponse(PlayerResponse):
    access_code: str


class AccessCodeRotateResponse(BaseModel):
    player_id: uuid.UUID
    access_code: str


class PlayerListResponse(BaseModel):
    items: list[PlayerResponse]
    total: int
    page: int
    page_size: int


class CreatePlayerRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    primary_position_id: uuid.UUID
    secondary_position_ids: list[uuid.UUID] = Field(default_factory=list)
    team_id: uuid.UUID | None = None
    date_of_birth: date | None = None
    nationality: str | None = Field(default=None, max_length=100)
    gender: GenderValue | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    preferred_foot: PreferredFootValue | None = None
    height_cm: int | None = Field(default=None, ge=100, le=250)
    weight_kg: Decimal | None = Field(default=None, ge=30, le=150)
    jersey_number: int | None = Field(default=None, ge=1, le=99)

    @field_validator("first_name", "last_name")
    @classmethod
    def names_nonempty(cls, value: str) -> str:
        return _strip_nonempty(value)

    @field_validator("nationality", "phone")
    @classmethod
    def optional_strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("secondary_position_ids")
    @classmethod
    def unique_secondary(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate secondary positions are not allowed")
        return value

    @model_validator(mode="after")
    def secondary_not_primary(self) -> CreatePlayerRequest:
        if self.primary_position_id in self.secondary_position_ids:
            raise ValueError("Secondary position cannot match primary position")
        return self

    @model_validator(mode="after")
    def dob_not_future(self) -> CreatePlayerRequest:
        if self.date_of_birth is not None and self.date_of_birth > date.today():
            raise ValueError("date_of_birth cannot be in the future")
        return self


class UpdatePlayerRequest(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    primary_position_id: uuid.UUID | None = None
    secondary_position_ids: list[uuid.UUID] | None = None
    date_of_birth: date | None = None
    nationality: str | None = Field(default=None, max_length=100)
    gender: GenderValue | None = None
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    preferred_foot: PreferredFootValue | None = None
    height_cm: int | None = Field(default=None, ge=100, le=250)
    weight_kg: Decimal | None = Field(default=None, ge=30, le=150)
    jersey_number: int | None = Field(default=None, ge=1, le=99)
    clear_date_of_birth: bool = False
    clear_nationality: bool = False
    clear_gender: bool = False
    clear_email: bool = False
    clear_phone: bool = False
    clear_preferred_foot: bool = False
    clear_height_cm: bool = False
    clear_weight_kg: bool = False
    clear_jersey_number: bool = False

    @field_validator("first_name", "last_name")
    @classmethod
    def names_nonempty(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _strip_nonempty(value)

    @field_validator("nationality", "phone")
    @classmethod
    def optional_strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("secondary_position_ids")
    @classmethod
    def unique_secondary(cls, value: list[uuid.UUID] | None) -> list[uuid.UUID] | None:
        if value is None:
            return None
        if len(value) != len(set(value)):
            raise ValueError("Duplicate secondary positions are not allowed")
        return value

    @model_validator(mode="after")
    def secondary_not_primary(self) -> UpdatePlayerRequest:
        if (
            self.primary_position_id is not None
            and self.secondary_position_ids is not None
            and self.primary_position_id in self.secondary_position_ids
        ):
            raise ValueError("Secondary position cannot match primary position")
        return self

    @model_validator(mode="after")
    def dob_not_future(self) -> UpdatePlayerRequest:
        if self.date_of_birth is not None and self.date_of_birth > date.today():
            raise ValueError("date_of_birth cannot be in the future")
        return self


class UpdatePlayerStatusRequest(BaseModel):
    is_active: bool


class CreatePlayerNoteRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def content_nonempty(cls, value: str) -> str:
        return _strip_nonempty(value)


class UpdatePlayerNoteRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)

    @field_validator("content")
    @classmethod
    def content_nonempty(cls, value: str) -> str:
        return _strip_nonempty(value)


class ImportPreviewRow(BaseModel):
    row_number: int
    first_name: str
    last_name: str
    primary_position_code: str
    secondary_position_codes: list[str] = Field(default_factory=list)
    date_of_birth: date | None = None
    nationality: str | None = None
    gender: GenderValue | None = None
    email: EmailStr | None = None
    phone: str | None = None
    preferred_foot: PreferredFootValue | None = None
    height_cm: int | None = None
    weight_kg: Decimal | None = None
    jersey_number: int | None = None


class ImportReject(BaseModel):
    row_number: int
    reason: str


class ImportDuplicate(BaseModel):
    row_number: int
    existing_player_id: uuid.UUID | None = None
    reason: str


class ImportPreviewResponse(BaseModel):
    valid_rows: list[ImportPreviewRow]
    rejects: list[ImportReject]
    duplicates: list[ImportDuplicate]
    total_rows: int
    valid_count: int
    reject_count: int
    duplicate_count: int


class ImportConfirmRequest(BaseModel):
    rows: list[ImportPreviewRow] = Field(min_length=1)
    team_id: uuid.UUID | None = None


class ImportConfirmResponse(BaseModel):
    created_count: int
    created_players: list[PlayerCreateResponse]
    rejects: list[ImportReject]
    duplicates: list[ImportDuplicate]
