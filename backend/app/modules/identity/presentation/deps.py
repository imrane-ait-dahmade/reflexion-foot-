"""FastAPI dependencies for authentication and RBAC."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from dataclasses import dataclass

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.security import decode_access_token
from app.modules.identity.application.auth_service import get_user_for_access_token
from app.modules.identity.infrastructure.models import User
from app.modules.identity.infrastructure.repositories import (
    user_permission_codes,
    user_role_names,
)
from app.shared.infrastructure.database.session import get_db

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: uuid.UUID
    email: str
    full_name: str
    roles: list[str]
    permissions: list[str]
    is_active: bool


def to_authenticated_user(user: User) -> AuthenticatedUser:
    return AuthenticatedUser(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        roles=user_role_names(user),
        permissions=user_permission_codes(user),
        is_active=user.is_active,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> AuthenticatedUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError("Missing bearer token")
    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(str(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise AuthenticationError("Invalid or expired access token") from exc

    user = await get_user_for_access_token(session, user_id)
    return to_authenticated_user(user)


def require_roles(*roles: str) -> Callable:
    required = {r.lower() for r in roles}

    async def _dependency(
        current: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if not required.intersection(current.roles):
            raise AuthorizationError("Insufficient role")
        return current

    return _dependency


def require_permissions(*codes: str) -> Callable:
    required = set(codes)

    async def _dependency(
        current: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if not required.issubset(set(current.permissions)):
            raise AuthorizationError("Insufficient permissions")
        return current

    return _dependency


def client_meta(request: Request) -> tuple[str | None, str | None]:
    user_agent = request.headers.get("user-agent")
    ip = request.client.host if request.client else None
    return user_agent, ip
