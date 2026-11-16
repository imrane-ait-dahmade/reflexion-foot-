"""Security acceptance tests for Identity V2 audit fixes."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.main import app
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.shared.infrastructure.database.models import import_all_models
from app.shared.infrastructure.database.session import (
    dispose_engine,
    get_session_factory,
)


@pytest.fixture(autouse=True)
async def _require_db_and_jwt():
    clear_settings_cache()
    settings = get_settings()
    if not settings.has_database_url or not settings.has_jwt_secret:
        pytest.skip("DATABASE_URL / JWT_SECRET required")
    import_all_models()
    yield
    await dispose_engine()
    clear_settings_cache()


async def _ensure_user(
    *,
    email: str,
    password: str,
    role_name: str,
    full_name: str = "Audit User",
) -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        repo = UserRepository(session)
        existing = await repo.get_by_email(email)
        role = await repo.get_role_by_name(role_name)
        assert role is not None
        if existing is not None:
            existing.password_hash = hash_password(password)
            existing.is_active = True
            existing.full_name = full_name
            existing.user_roles.clear()
            await session.flush()
            session.add(UserRole(user_id=existing.id, role_id=role.id))
            await session.commit()
            return existing.id
        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            is_active=True,
        )
        await repo.add(user)
        session.add(UserRole(user_id=user.id, role_id=role.id))
        await session.commit()
        return user.id
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_refresh_reuse_revokes_token_family() -> None:
    email = f"reuse-{uuid.uuid4().hex[:8]}@example.com"
    password = "ReusePassw0rd!"
    await _ensure_user(email=email, password=password, role_name="coach")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login.status_code == 200
        old_refresh = login.json()["refresh_token"]

        rotated = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert rotated.status_code == 200
        new_refresh = rotated.json()["refresh_token"]

        reuse = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert reuse.status_code == 401
        assert reuse.json()["code"] == "authentication_error"
        assert "reuse" in reuse.json()["detail"].lower()

        # Family revoked → new token also invalid
        family = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": new_refresh},
        )
        assert family.status_code == 401


@pytest.mark.asyncio
async def test_cannot_deactivate_last_active_admin() -> None:
    email = f"last-admin-{uuid.uuid4().hex[:8]}@example.com"
    password = "LastAdminPass1!"
    admin_id = await _ensure_user(email=email, password=password, role_name="admin")

    # Ensure this is the only active admin by counting — if others exist from prior
    # tests, create a second admin first then demote/deactivate only when safe.
    # Strategy: use a dedicated admin and attempt self-demotion via another admin
    # if needed. Simpler path: if multiple admins exist, deactivate is allowed for
    # one of them; for this test create TWO admins and then deactivate all but one
    # then try to deactivate the last.
    second_email = f"second-admin-{uuid.uuid4().hex[:8]}@example.com"
    second_password = "SecondAdminPass1!"
    second_id = await _ensure_user(
        email=second_email,
        password=second_password,
        role_name="admin",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Deactivate second admin — OK if first remains
        ok = await client.patch(
            f"/api/v1/users/{second_id}/status",
            headers=headers,
            json={"is_active": False},
        )
        assert ok.status_code == 200
        assert ok.json()["is_active"] is False

        # Now only first admin is active among these two; still may be other test
        # admins. Force a scenario by demoting all other active admins to coach
        # through SQL-less approach: only assert that demoting last remaining
        # among known set fails when count_active_admins would be 0.
        # Count via attempting to deactivate first after ensuring uniqueness:
        factory = get_session_factory()
        session = factory()
        try:
            repo = UserRepository(session)
            # Demote every other active admin to coach for this assertion window.
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            from app.modules.identity.infrastructure.models import UserRole
            from app.modules.identity.infrastructure.repositories import user_is_admin

            users = list(
                (
                    await session.scalars(
                        select(User).options(
                            selectinload(User.user_roles).selectinload(UserRole.role)
                        )
                    )
                ).all()
            )
            coach_role = await repo.get_role_by_name("coach")
            assert coach_role is not None
            for u in users:
                if u.id == admin_id:
                    continue
                if user_is_admin(u) and u.is_active:
                    u.user_roles.clear()
                    await session.flush()
                    session.add(UserRole(user_id=u.id, role_id=coach_role.id))
            await session.commit()
        finally:
            await session.close()

        # Re-login in case roles/token invalidated somehow (roles change doesn't
        # invalidate access JWT immediately — that's OK for this test).
        blocked = await client.patch(
            f"/api/v1/users/{admin_id}/status",
            headers=headers,
            json={"is_active": False},
        )
        assert blocked.status_code == 422
        assert "last active administrator" in blocked.json()["detail"].lower()

        roles_blocked = await client.put(
            f"/api/v1/users/{admin_id}/roles",
            headers=headers,
            json={"roles": ["coach"]},
        )
        assert roles_blocked.status_code == 422


@pytest.mark.asyncio
async def test_change_password_and_rejects_old_login() -> None:
    email = f"pwd-{uuid.uuid4().hex[:8]}@example.com"
    old_password = "OldPassw0rd!"
    new_password = "NewPassw0rd!"
    await _ensure_user(email=email, password=old_password, role_name="staff")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": old_password},
        )
        assert login.status_code == 200
        access = login.json()["access_token"]
        refresh = login.json()["refresh_token"]

        changed = await client.post(
            "/api/v1/auth/change-password",
            headers={"Authorization": f"Bearer {access}"},
            json={
                "current_password": old_password,
                "new_password": new_password,
            },
        )
        assert changed.status_code == 204

        old_login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": old_password},
        )
        assert old_login.status_code == 401

        new_login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": new_password},
        )
        assert new_login.status_code == 200

        # Old refresh sessions revoked
        refresh_resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh},
        )
        assert refresh_resp.status_code == 401


@pytest.mark.asyncio
async def test_coach_cannot_escalate_privileges() -> None:
    email = f"coach-esc-{uuid.uuid4().hex[:8]}@example.com"
    password = "CoachPassw0rd!"
    user_id = await _ensure_user(email=email, password=password, role_name="coach")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        create = await client.post(
            "/api/v1/users",
            headers=headers,
            json={
                "full_name": "Hacker",
                "email": f"hack-{uuid.uuid4().hex[:6]}@example.com",
                "password": "HackPassw0rd!",
                "roles": ["admin"],
            },
        )
        assert create.status_code == 403

        roles = await client.put(
            f"/api/v1/users/{user_id}/roles",
            headers=headers,
            json={"roles": ["admin"]},
        )
        assert roles.status_code == 403
