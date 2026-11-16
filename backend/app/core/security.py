"""Password hashing (Argon2id) and JWT / refresh-token helpers."""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
    type=Type.ID,
)


def hash_secret(value: str) -> str:
    """Hash a password or player access code with Argon2id."""
    if not value:
        raise ValueError("Cannot hash an empty secret.")
    return _hasher.hash(value)


def verify_secret(hash_value: str, plain_value: str) -> bool:
    """Return True when `plain_value` matches the Argon2id hash."""
    try:
        return _hasher.verify(hash_value, plain_value)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(hash_value: str) -> bool:
    try:
        return _hasher.check_needs_rehash(hash_value)
    except InvalidHashError:
        return True


hash_password = hash_secret
verify_password = verify_secret


def create_access_token(
    *,
    user_id: uuid.UUID,
    email: str,
    roles: list[str],
    permissions: list[str],
) -> tuple[str, int]:
    """Return (jwt, expires_in_seconds)."""
    settings = get_settings()
    if not settings.has_jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured (min 32 characters).")
    expires_in = settings.access_token_expire_minutes * 60
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "roles": roles,
        "permissions": permissions,
        "type": "access",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return token, expires_in


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.has_jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured (min 32 characters).")
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={
            "require": ["exp", "iat", "sub", "type", "iss", "aud"],
        },
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload


PLAYER_SESSION_TOKEN_HOURS = 4


def create_player_session_token(
    *,
    player_id: uuid.UUID,
    session_id: uuid.UUID,
    session_player_id: uuid.UUID,
) -> tuple[str, int]:
    """Return (jwt, expires_in_seconds) for player session access."""
    settings = get_settings()
    if not settings.has_jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured (min 32 characters).")
    expires_in = PLAYER_SESSION_TOKEN_HOURS * 3600
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(player_id),
        "player_id": str(player_id),
        "session_id": str(session_id),
        "session_player_id": str(session_player_id),
        "type": "player_session",
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
        "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(
        payload,
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return token, expires_in


def decode_player_session_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    if not settings.has_jwt_secret:
        raise RuntimeError("JWT_SECRET is not configured (min 32 characters).")
    payload = jwt.decode(
        token,
        settings.jwt_secret,
        algorithms=[settings.jwt_algorithm],
        audience=settings.jwt_audience,
        issuer=settings.jwt_issuer,
        options={
            "require": [
                "exp",
                "iat",
                "sub",
                "type",
                "iss",
                "aud",
                "player_id",
                "session_id",
                "session_player_id",
            ],
        },
    )
    if payload.get("type") != "player_session":
        raise jwt.InvalidTokenError("Not a player session token")
    return payload


def generate_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hex_hash). Store only the hash."""
    raw = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return raw, token_hash


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    settings = get_settings()
    return datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
