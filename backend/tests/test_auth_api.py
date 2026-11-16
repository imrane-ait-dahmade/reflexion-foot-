"""Identity API integration tests against V2 TEST database."""

from __future__ import annotations

import secrets
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
        pytest.skip("DATABASE_URL / JWT_SECRET required for auth API tests")
    import_all_models()
    yield
    await dispose_engine()
    clear_settings_cache()


async def _ensure_staff_user(
    *,
    email: str,
    password: str,
    role_name: str = "admin",
    full_name: str = "Test Admin",
) -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        repo = UserRepository(session)
        existing = await repo.get_by_email(email)
        if existing is not None:
            # Reset password for deterministic tests
            existing.password_hash = hash_password(password)
            existing.is_active = True
            existing.full_name = full_name
            await session.commit()
            return existing.id

        role = await repo.get_role_by_name(role_name)
        assert role is not None, f"Role {role_name} missing — run seeds"
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
async def test_login_me_refresh_logout_flow() -> None:
    email = f"auth-test-{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPassw0rd!"
    await _ensure_staff_user(email=email, password=password, role_name="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": password},
        )
        assert login.status_code == 200, login.text
        body = login.json()
        assert body["token_type"] == "bearer"
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["user"]["email"] == email
        assert "admin" in body["user"]["roles"]

        me = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {body['access_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["email"] == email

        old_refresh = body["refresh_token"]
        refreshed = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert refreshed.status_code == 200
        new_body = refreshed.json()
        assert new_body["refresh_token"] != old_refresh

        # Rotated token must be invalid
        reuse = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": old_refresh},
        )
        assert reuse.status_code == 401

        logout = await client.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {new_body['access_token']}"},
            json={"refresh_token": new_body["refresh_token"]},
        )
        assert logout.status_code == 204


@pytest.mark.asyncio
async def test_login_rejects_bad_password() -> None:
    email = f"auth-bad-{uuid.uuid4().hex[:8]}@example.com"
    await _ensure_staff_user(email=email, password="GoodPassw0rd!", role_name="coach")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "WrongPassw0rd!"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_admin_can_create_staff_user() -> None:
    admin_email = f"admin-{uuid.uuid4().hex[:8]}@example.com"
    admin_password = "AdminPassw0rd!"
    await _ensure_staff_user(
        email=admin_email,
        password=admin_password,
        role_name="admin",
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": admin_email, "password": admin_password},
        )
        assert login.status_code == 200
        token = login.json()["access_token"]

        coach_email = f"coach-{uuid.uuid4().hex[:8]}@example.com"
        create = await client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "full_name": "New Coach",
                "email": coach_email,
                "password": "CoachPassw0rd!",
                "roles": ["coach"],
            },
        )
        assert create.status_code == 201, create.text
        created = create.json()
        assert created["email"] == coach_email
        assert created["roles"] == ["coach"]
        assert "password" not in created
        assert "password_hash" not in created

        # player role rejected
        bad = await client.post(
            "/api/v1/users",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "full_name": "Bad Player Staff",
                "email": f"bad-{secrets.token_hex(4)}@example.com",
                "password": "BadPassw0rd!",
                "roles": ["player"],
            },
        )
        assert bad.status_code == 422
