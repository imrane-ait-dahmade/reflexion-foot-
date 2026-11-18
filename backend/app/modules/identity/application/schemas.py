"""Pydantic schemas for identity / auth APIs."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

STAFF_ROLE_NAMES = frozenset({"admin", "coach", "staff"})


def _validate_staff_roles(value: list[str]) -> list[str]:
    cleaned = sorted({r.strip().lower() for r in value if r.strip()})
    if not cleaned:
        raise ValueError("At least one role is required")
    invalid = set(cleaned) - STAFF_ROLE_NAMES
    if invalid:
        raise ValueError(f"Invalid staff roles: {sorted(invalid)}")
    if "player" in cleaned:
        raise ValueError("Players are not staff accounts")
    return cleaned


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterCoachRequest(BaseModel):
    """Public self-registration — always creates a coach (never admin/staff)."""

    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class LogoutRequest(BaseModel):
    refresh_token: str = Field(min_length=20)
    all_sessions: bool = False


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse


class UserResponse(BaseModel):
    id: uuid.UUID
    full_name: str
    email: EmailStr
    is_active: bool
    roles: list[str]
    permissions: list[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreateStaffUserRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    roles: list[str] = Field(min_length=1)
    is_active: bool = True

    @field_validator("roles")
    @classmethod
    def validate_staff_roles(cls, value: list[str]) -> list[str]:
        return _validate_staff_roles(value)


class UpdateStaffUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=200)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    roles: list[str] | None = None
    is_active: bool | None = None

    @field_validator("roles")
    @classmethod
    def validate_staff_roles(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return _validate_staff_roles(value)


class UpdateUserStatusRequest(BaseModel):
    is_active: bool


class UpdateUserRolesRequest(BaseModel):
    roles: list[str] = Field(min_length=1)

    @field_validator("roles")
    @classmethod
    def validate_staff_roles(cls, value: list[str]) -> list[str]:
        return _validate_staff_roles(value)
