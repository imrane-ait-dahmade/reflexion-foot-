"""SQLAlchemy repositories for identity / auth."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.identity.infrastructure.models import (
    RefreshToken,
    Role,
    RolePermission,
    User,
    UserRole,
)
from app.shared.infrastructure.database.models import import_all_models

# Ensure related mappers (e.g. TrainingSession) are registered before configure.
import_all_models()

STAFF_ROLES = frozenset({"admin", "coach", "staff"})


def _user_auth_options():
    return (
        selectinload(User.user_roles)
        .selectinload(UserRole.role)
        .selectinload(Role.role_permissions)
        .selectinload(RolePermission.permission),
    )


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        stmt = select(User).where(User.id == user_id).options(*_user_auth_options())
        return await self._session.scalar(stmt)

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email.lower()).options(*_user_auth_options())
        return await self._session.scalar(stmt)

    async def list_users(self) -> list[User]:
        stmt = (
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .order_by(User.created_at.desc())
        )
        result = await self._session.scalars(stmt)
        return list(result.all())

    async def add(self, user: User) -> User:
        self._session.add(user)
        await self._session.flush()
        return user

    async def get_role_by_name(self, name: str) -> Role | None:
        return await self._session.scalar(select(Role).where(Role.name == name))

    async def count_users_with_role(self, role_name: str) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.name == role_name)
        )
        return int(await self._session.scalar(stmt) or 0)

    async def count_active_admins(self, *, excluding_user_id: uuid.UUID | None = None) -> int:
        stmt = (
            select(func.count())
            .select_from(User)
            .join(UserRole, UserRole.user_id == User.id)
            .join(Role, Role.id == UserRole.role_id)
            .where(Role.name == "admin", User.is_active.is_(True))
        )
        if excluding_user_id is not None:
            stmt = stmt.where(User.id != excluding_user_id)
        return int(await self._session.scalar(stmt) or 0)


class RefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: RefreshToken) -> RefreshToken:
        self._session.add(token)
        await self._session.flush()
        return token

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        """Lookup any token by hash (active or revoked) for reuse detection."""
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        return await self._session.scalar(stmt)

    async def lock_by_id(self, token_id: uuid.UUID) -> RefreshToken | None:
        """Row lock for concurrent refresh safety."""
        stmt = (
            select(RefreshToken)
            .where(RefreshToken.id == token_id)
            .options(selectinload(RefreshToken.user).options(*_user_auth_options()))
            .with_for_update()
        )
        return await self._session.scalar(stmt)

    async def revoke(self, token: RefreshToken, *, replaced_by: RefreshToken | None = None) -> None:
        token.revoked_at = datetime.now(UTC)
        if replaced_by is not None:
            token.replaced_by_id = replaced_by.id
        await self._session.flush()

    async def revoke_family(self, family_id: uuid.UUID) -> int:
        now = datetime.now(UTC)
        stmt = select(RefreshToken).where(
            RefreshToken.family_id == family_id,
            RefreshToken.revoked_at.is_(None),
        )
        tokens = list((await self._session.scalars(stmt)).all())
        for token in tokens:
            token.revoked_at = now
        await self._session.flush()
        return len(tokens)

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        now = datetime.now(UTC)
        stmt = select(RefreshToken).where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        tokens = list((await self._session.scalars(stmt)).all())
        for token in tokens:
            token.revoked_at = now
        await self._session.flush()
        return len(tokens)


def user_role_names(user: User) -> list[str]:
    return sorted({ur.role.name for ur in user.user_roles if ur.role is not None})


def user_permission_codes(user: User) -> list[str]:
    codes: set[str] = set()
    for ur in user.user_roles:
        if ur.role is None:
            continue
        for rp in ur.role.role_permissions:
            if rp.permission is not None:
                codes.add(rp.permission.code)
    return sorted(codes)


def user_is_admin(user: User) -> bool:
    return "admin" in user_role_names(user)
