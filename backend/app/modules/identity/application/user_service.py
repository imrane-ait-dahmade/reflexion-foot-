"""Staff user management use cases (RBAC-gated in presentation)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationError
from app.core.security import hash_password
from app.modules.identity.application.auth_service import serialize_user
from app.modules.identity.application.schemas import (
    CreateStaffUserRequest,
    UpdateStaffUserRequest,
    UserResponse,
)
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import (
    STAFF_ROLES,
    RefreshTokenRepository,
    UserRepository,
    user_is_admin,
)


async def _resolve_roles(repo: UserRepository, role_names: list[str]):
    roles = []
    for name in role_names:
        if name not in STAFF_ROLES:
            raise ValidationError(f"Invalid staff role: {name}")
        role = await repo.get_role_by_name(name)
        if role is None:
            raise ValidationError(f"Role not found: {name}")
        roles.append(role)
    return roles


async def _guard_last_active_admin(
    repo: UserRepository,
    user: User,
    *,
    next_is_active: bool | None = None,
    next_roles: list[str] | None = None,
) -> None:
    """Prevent deactivating or demoting the last active administrator."""
    currently_admin = user_is_admin(user)
    if not currently_admin:
        return

    will_be_active = user.is_active if next_is_active is None else next_is_active
    will_be_admin = currently_admin if next_roles is None else ("admin" in next_roles)

    loses_admin_power = (not will_be_active) or (not will_be_admin)
    if not loses_admin_power:
        return

    remaining = await repo.count_active_admins(excluding_user_id=user.id)
    if remaining < 1:
        raise ValidationError(
            "Cannot deactivate or demote the last active administrator",
        )


async def list_staff_users(session: AsyncSession) -> list[UserResponse]:
    users = await UserRepository(session).list_users()
    return [serialize_user(u) for u in users]


async def get_staff_user(session: AsyncSession, user_id: uuid.UUID) -> UserResponse:
    user = await UserRepository(session).get_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found")
    return serialize_user(user)


async def create_staff_user(
    session: AsyncSession,
    payload: CreateStaffUserRequest,
) -> UserResponse:
    repo = UserRepository(session)
    email = payload.email.lower().strip()
    if await repo.get_by_email(email) is not None:
        raise ConflictError("A user with this email already exists")

    roles = await _resolve_roles(repo, payload.roles)
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        is_active=payload.is_active,
    )
    await repo.add(user)
    for role in roles:
        session.add(UserRole(user_id=user.id, role_id=role.id))
    await session.commit()
    loaded = await repo.get_by_id(user.id)
    assert loaded is not None
    return serialize_user(loaded)


async def update_staff_user(
    session: AsyncSession,
    user_id: uuid.UUID,
    payload: UpdateStaffUserRequest,
) -> UserResponse:
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found")

    await _guard_last_active_admin(
        repo,
        user,
        next_is_active=payload.is_active,
        next_roles=payload.roles,
    )

    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
        await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    if payload.is_active is not None:
        user.is_active = payload.is_active
        if not payload.is_active:
            await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    if payload.roles is not None:
        roles = await _resolve_roles(repo, payload.roles)
        user.user_roles.clear()
        await session.flush()
        for role in roles:
            session.add(UserRole(user_id=user.id, role_id=role.id))

    user.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(user.id)
    assert loaded is not None
    return serialize_user(loaded)


async def set_user_status(
    session: AsyncSession,
    user_id: uuid.UUID,
    *,
    is_active: bool,
) -> UserResponse:
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found")
    await _guard_last_active_admin(repo, user, next_is_active=is_active)
    user.is_active = is_active
    user.updated_at = datetime.now(UTC)
    if not is_active:
        await RefreshTokenRepository(session).revoke_all_for_user(user.id)
    await session.commit()
    loaded = await repo.get_by_id(user.id)
    assert loaded is not None
    return serialize_user(loaded)


async def set_user_roles(
    session: AsyncSession,
    user_id: uuid.UUID,
    roles: list[str],
) -> UserResponse:
    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise NotFoundError("User not found")
    await _guard_last_active_admin(repo, user, next_roles=roles)
    resolved = await _resolve_roles(repo, roles)
    user.user_roles.clear()
    await session.flush()
    for role in resolved:
        session.add(UserRole(user_id=user.id, role_id=role.id))
    user.updated_at = datetime.now(UTC)
    await session.commit()
    loaded = await repo.get_by_id(user.id)
    assert loaded is not None
    return serialize_user(loaded)
