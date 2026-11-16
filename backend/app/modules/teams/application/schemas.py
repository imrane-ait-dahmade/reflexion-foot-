"""Pydantic schemas for teams management APIs."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

TeamRoleValue = Literal[
    "head_coach",
    "assistant_coach",
    "analyst",
    "physiotherapist",
    "staff",
    "other",
]


def _strip_name(value: str) -> str:
    cleaned = value.strip()
    if len(cleaned) < 2:
        raise ValueError("Team name must be at least 2 characters")
    return cleaned


class TeamResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TeamListResponse(BaseModel):
    items: list[TeamResponse]
    total: int
    page: int
    page_size: int


class CreateTeamRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _strip_name(value)

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class UpdateTeamRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    clear_description: bool = False

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _strip_name(value)

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class UpdateTeamStatusRequest(BaseModel):
    is_active: bool


class TeamStaffResponse(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    user_id: uuid.UUID
    user_full_name: str | None = None
    user_email: str | None = None
    team_role: TeamRoleValue
    is_active: bool
    joined_at: datetime
    left_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AssignTeamStaffRequest(BaseModel):
    user_id: uuid.UUID
    team_role: TeamRoleValue = "staff"


class TeamPlayerMembershipResponse(BaseModel):
    id: uuid.UUID
    team_id: uuid.UUID
    player_id: uuid.UUID
    player_first_name: str | None = None
    player_last_name: str | None = None
    is_active: bool
    joined_at: datetime
    left_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AssignTeamPlayerRequest(BaseModel):
    player_id: uuid.UUID
