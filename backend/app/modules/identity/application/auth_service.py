"""Authentication use cases: login, refresh, logout, current user, password change."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthenticationError, AuthorizationError, ValidationError
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)
from app.modules.identity.application.schemas import TokenResponse, UserResponse
from app.modules.identity.infrastructure.models import RefreshToken, User
from app.modules.identity.infrastructure.repositories import (
    RefreshTokenRepository,
    UserRepository,
    user_permission_codes,
    user_role_names,
)


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        is_active=user.is_active,
        roles=user_role_names(user),
        permissions=user_permission_codes(user),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


async def _issue_tokens(
    session: AsyncSession,
    user: User,
    *,
    family_id: uuid.UUID | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> TokenResponse:
    roles = user_role_names(user)
    permissions = user_permission_codes(user)
    access_token, expires_in = create_access_token(
        user_id=user.id,
        email=user.email,
        roles=roles,
        permissions=permissions,
    )
    raw_refresh, token_hash = generate_refresh_token()
    refresh_repo = RefreshTokenRepository(session)
    await refresh_repo.add(
        RefreshToken(
            user_id=user.id,
            family_id=family_id or uuid.uuid4(),
            token_hash=token_hash,
            expires_at=refresh_token_expiry(),
            user_agent=user_agent,
            ip_address=ip_address,
        )
    )
    await session.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=expires_in,
        user=serialize_user(user),
    )


async def login(
    session: AsyncSession,
    *,
    email: str,
    password: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> TokenResponse:
    users = UserRepository(session)
    user = await users.get_by_email(email.lower().strip())
    if user is None or not verify_password(user.password_hash, password):
        raise AuthenticationError("Invalid email or password")
    if not user.is_active:
        raise AuthenticationError("Account is inactive")
    return await _issue_tokens(
        session,
        user,
        family_id=uuid.uuid4(),
        user_agent=user_agent,
        ip_address=ip_address,
    )


async def refresh_session(
    session: AsyncSession,
    *,
    refresh_token: str,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> TokenResponse:
    refresh_repo = RefreshTokenRepository(session)
    token_hash = hash_refresh_token(refresh_token)
    existing = await refresh_repo.get_by_hash(token_hash)
    now = datetime.now(UTC)

    if existing is None:
        raise AuthenticationError("Invalid refresh token")

    # Reuse of a revoked token → revoke the whole family.
    if existing.revoked_at is not None:
        await refresh_repo.revoke_family(existing.family_id)
        await session.commit()
        raise AuthenticationError("Refresh token reuse detected")

    if existing.expires_at <= now:
        await refresh_repo.revoke(existing)
        await session.commit()
        raise AuthenticationError("Refresh token expired")

    # Concurrent refresh safety: lock the row before rotating.
    locked = await refresh_repo.lock_by_id(existing.id)
    if locked is None or locked.revoked_at is not None:
        # Another request won the race and rotated/revoked this token.
        if locked is not None and locked.revoked_at is not None:
            await refresh_repo.revoke_family(locked.family_id)
            await session.commit()
            raise AuthenticationError("Refresh token reuse detected")
        raise AuthenticationError("Invalid refresh token")

    user = locked.user
    if user is None or not user.is_active:
        await refresh_repo.revoke_family(locked.family_id)
        await session.commit()
        raise AuthenticationError("Account is inactive")

    roles = user_role_names(user)
    permissions = user_permission_codes(user)
    access_token, expires_in = create_access_token(
        user_id=user.id,
        email=user.email,
        roles=roles,
        permissions=permissions,
    )
    raw_refresh, new_hash = generate_refresh_token()
    new_token = await refresh_repo.add(
        RefreshToken(
            user_id=user.id,
            family_id=locked.family_id,
            token_hash=new_hash,
            expires_at=refresh_token_expiry(),
            user_agent=user_agent,
            ip_address=ip_address,
        )
    )
    await refresh_repo.revoke(locked, replaced_by=new_token)
    await session.commit()
    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh,
        expires_in=expires_in,
        user=serialize_user(user),
    )


async def logout(
    session: AsyncSession,
    *,
    refresh_token: str,
    user_id: uuid.UUID | None = None,
    all_sessions: bool = False,
) -> None:
    refresh_repo = RefreshTokenRepository(session)
    token_hash = hash_refresh_token(refresh_token)
    existing = await refresh_repo.get_by_hash(token_hash)
    if existing is None:
        return
    if user_id is not None and existing.user_id != user_id:
        raise AuthorizationError("Refresh token does not belong to the current user")
    if all_sessions:
        await refresh_repo.revoke_all_for_user(existing.user_id)
    elif existing.revoked_at is None:
        await refresh_repo.revoke(existing)
    await session.commit()


async def get_user_for_access_token(session: AsyncSession, user_id: uuid.UUID) -> User:
    users = UserRepository(session)
    user = await users.get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    return user


async def change_password(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    current_password: str,
    new_password: str,
) -> None:
    """Authenticated password change. Does not implement forced first-login flow."""
    if current_password == new_password:
        raise ValidationError("New password must differ from the current password")
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    if not verify_password(user.password_hash, current_password):
        raise AuthenticationError("Current password is incorrect")
    user.password_hash = hash_password(new_password)
    user.updated_at = datetime.now(UTC)
    # Invalidate all refresh sessions after password change.
    await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    await session.commit()
