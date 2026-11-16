"""HTTP integration: Digit Memory challenge engine against V2 TEST."""

from __future__ import annotations

import asyncio
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.main import app
from app.modules.cognitive_engines.challenge_token import challenge_secret, read_challenge
from app.modules.cognitive_engines import digit_memory
from app.modules.cognitive_tests.infrastructure.models import CognitiveTest
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.modules.players.infrastructure.models import Position
from app.modules.results.infrastructure.models import TestResult as ResultRow
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
    assert len(challenge_secret()) >= 32
    yield
    await dispose_engine()
    clear_settings_cache()


async def _ensure_staff(*, email: str, password: str, role_name: str) -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        repo = UserRepository(session)
        existing = await repo.get_by_email(email)
        if existing is not None:
            existing.password_hash = hash_password(password)
            existing.is_active = True
            role = await repo.get_role_by_name(role_name)
            assert role is not None
            if not any(ur.role_id == role.id for ur in existing.user_roles):
                session.add(UserRole(user_id=existing.id, role_id=role.id))
            await session.commit()
            return existing.id
        role = await repo.get_role_by_name(role_name)
        assert role is not None
        user = User(
            full_name="Exercise Staff",
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


async def _login(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def _digit_memory_id() -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        row = await session.scalar(
            select(CognitiveTest).where(CognitiveTest.slug == "digit-memory")
        )
        assert row is not None, "digit-memory seed missing"
        return row.id
    finally:
        await session.close()


async def _position_id() -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        pos = await session.scalar(
            select(Position).where(Position.is_active.is_(True)).order_by(Position.display_order)
        )
        assert pos is not None
        return pos.id
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_digit_memory_challenge_persists_result() -> None:
    admin_email = f"ex-admin-{uuid.uuid4().hex[:8]}@example.com"
    coach_email = f"ex-coach-{uuid.uuid4().hex[:8]}@example.com"
    password = "ExPassw0rd!"
    await _ensure_staff(email=admin_email, password=password, role_name="admin")
    coach_id = await _ensure_staff(email=coach_email, password=password, role_name="coach")
    digit_id = await _digit_memory_id()
    position_id = await _position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = {"Authorization": f"Bearer {await _login(client, admin_email, password)}"}
        coach_h = {"Authorization": f"Bearer {await _login(client, coach_email, password)}"}

        team = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"Ex Team {uuid.uuid4().hex[:6]}"},
        )
        assert team.status_code == 201, team.text
        team_id = team.json()["id"]
        assert (
            await client.post(
                f"/api/v1/teams/{team_id}/staff",
                headers=admin_h,
                json={"user_id": str(coach_id), "team_role": "head_coach"},
            )
        ).status_code == 201

        player = await client.post(
            "/api/v1/players",
            headers=coach_h,
            json={
                "first_name": "Digit",
                "last_name": f"Player{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(position_id),
                "team_id": team_id,
            },
        )
        assert player.status_code == 201, player.text
        player_id = player.json()["id"]
        personal_code = player.json()["access_code"]

        created = await client.post(
            "/api/v1/sessions",
            headers=coach_h,
            json={
                "player_ids": [player_id],
                "exercise_ids": [str(digit_id)],
                "team_id": team_id,
            },
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["id"]

        started = await client.post(f"/api/v1/sessions/{session_id}/start", headers=coach_h)
        assert started.status_code == 200, started.text
        session_code = started.json()["session_code"]

        join = await client.post(
            "/api/v1/player/session/join",
            json={"personal_code": personal_code, "session_code": session_code},
        )
        assert join.status_code == 200, join.text
        player_h = {"Authorization": f"Bearer {join.json()['access_token']}"}

        start = await client.post(
            "/api/v1/player/exercises/digit-memory",
            headers=player_h,
            json={"action": "start"},
        )
        assert start.status_code == 200, start.text
        token = start.json()["token"]

        secret = challenge_secret()
        for index in range(3):
            if index > 0:
                await asyncio.sleep(0.85)
            rev = await client.post(
                "/api/v1/player/exercises/digit-memory",
                headers=player_h,
                json={"action": "digit", "token": token},
            )
            assert rev.status_code == 200, rev.text
            token = rev.json()["token"]

        payload = read_challenge(token, secret)
        assert payload is not None
        expected = digit_memory.digit_sequence(str(payload["seed"]), 1, secret)
        wrong = [(d + 1) % 10 for d in expected]

        answer = await client.post(
            "/api/v1/player/exercises/digit-memory",
            headers=player_h,
            json={"action": "answer", "token": token, "answer": wrong},
        )
        assert answer.status_code == 200, answer.text
        body = answer.json()
        assert body["finished"] is True
        assert body["exact"] is False
        assert "summary" in body

        again = await client.post(
            "/api/v1/player/exercises/digit-memory",
            headers=player_h,
            json={"action": "start"},
        )
        assert again.status_code == 409

        factory = get_session_factory()
        db = factory()
        try:
            rows = list(
                (
                    await db.scalars(
                        select(ResultRow).order_by(ResultRow.created_at.desc()).limit(20)
                    )
                ).all()
            )
            matched = [
                r
                for r in rows
                if isinstance(r.result_data, dict)
                and r.result_data.get("scoringVersion") == "digit-memory-1"
            ]
            assert matched, "digit-memory result missing from V2 PostgreSQL"
            assert matched[0].result_data.get("incorrectSequences", 0) >= 1
        finally:
            await db.close()
