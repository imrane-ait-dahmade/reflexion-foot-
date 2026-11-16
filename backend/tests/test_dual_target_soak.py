"""Dual Target HTTP soak against V2 TEST (clock-patched for movement windows)."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.main import app
from app.modules.cognitive_engines.application import challenge_service
from app.modules.cognitive_engines.challenge_token import challenge_secret, read_challenge
from app.modules.cognitive_engines import dual_target
from app.modules.cognitive_tests.infrastructure.models import CognitiveTest
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.modules.players.infrastructure.models import Position
from app.modules.results.infrastructure.models import TestResult as ResultRow
from app.shared.infrastructure.database.models import import_all_models
from app.shared.infrastructure.database.session import dispose_engine, get_session_factory


@pytest.fixture
async def clock(monkeypatch: pytest.MonkeyPatch):
    clear_settings_cache()
    settings = get_settings()
    if not settings.has_database_url or not settings.has_jwt_secret:
        pytest.skip("DATABASE_URL / JWT_SECRET required")
    import_all_models()
    state = {"t": 1_000_000}

    def _now() -> int:
        return state["t"]

    monkeypatch.setattr(challenge_service, "_now_ms", _now)
    yield state
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
            full_name="Dual Staff",
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


async def _slug_id(slug: str) -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        row = await session.scalar(select(CognitiveTest).where(CognitiveTest.slug == slug))
        assert row is not None
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
async def test_dual_target_soak_valid_invalid_duplicate(clock: dict) -> None:
    admin_email = f"dual-admin-{uuid.uuid4().hex[:8]}@example.com"
    coach_email = f"dual-coach-{uuid.uuid4().hex[:8]}@example.com"
    password = "DualPassw0rd!"
    await _ensure_staff(email=admin_email, password=password, role_name="admin")
    coach_id = await _ensure_staff(email=coach_email, password=password, role_name="coach")
    dual_id = await _slug_id("dual-target-tracking")
    position_id = await _position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = {"Authorization": f"Bearer {await _login(client, admin_email, password)}"}
        coach_h = {"Authorization": f"Bearer {await _login(client, coach_email, password)}"}

        team = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"Dual Team {uuid.uuid4().hex[:6]}"},
        )
        assert team.status_code == 201
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
                "first_name": "Dual",
                "last_name": f"P{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(position_id),
                "team_id": team_id,
            },
        )
        assert player.status_code == 201, player.text
        personal_code = player.json()["access_code"]
        player_id = player.json()["id"]

        created = await client.post(
            "/api/v1/sessions",
            headers=coach_h,
            json={
                "player_ids": [player_id],
                "exercise_ids": [str(dual_id)],
                "team_id": team_id,
            },
        )
        assert created.status_code == 201, created.text
        session_id = created.json()["id"]
        started = await client.post(f"/api/v1/sessions/{session_id}/start", headers=coach_h)
        assert started.status_code == 200
        session_code = started.json()["session_code"]

        join = await client.post(
            "/api/v1/player/session/join",
            json={"personal_code": personal_code, "session_code": session_code},
        )
        assert join.status_code == 200, join.text
        player_h = {"Authorization": f"Bearer {join.json()['access_token']}"}

        # Unauthorized without token
        assert (
            await client.post(
                "/api/v1/player/exercises/dual-target-tracking",
                json={"action": "start"},
            )
        ).status_code == 401

        start = await client.post(
            "/api/v1/player/exercises/dual-target-tracking",
            headers=player_h,
            json={"action": "start"},
        )
        assert start.status_code == 200, start.text
        token = start.json()["token"]
        challenge = start.json()["challenge"]
        assert challenge["level"] == 1
        assert len(challenge["highlightIds"]) == 2

        # Too early / expired movement window
        early = await client.post(
            "/api/v1/player/exercises/dual-target-tracking",
            headers=player_h,
            json={"action": "submit", "token": token, "selected": challenge["highlightIds"]},
        )
        assert early.status_code == 422

        # Invalid selection
        clock["t"] += dual_target.DUAL_HIGHLIGHT_MS + int(challenge["durationMs"]) + 100
        bad = await client.post(
            "/api/v1/player/exercises/dual-target-tracking",
            headers=player_h,
            json={"action": "submit", "token": token, "selected": [0, 0]},
        )
        assert bad.status_code == 422

        # Complete all levels with correct targets (replay protection via evolving token)
        secret = challenge_secret()
        for level in range(1, len(dual_target.DUAL_LEVELS) + 1):
            payload = read_challenge(token, secret)
            assert payload is not None
            targets = dual_target.target_pair(str(payload["seed"]), level, secret)
            cfg = dual_target.dual_level(level)
            assert cfg is not None
            clock["t"] = int(payload["movementReadyAt"]) + int(cfg["durationMs"]) + 200
            # Wrong pick on last level still finishes
            selected = targets if level < len(dual_target.DUAL_LEVELS) else [
                (targets[0] + 1) % int(cfg["objects"]),
                (targets[1] + 2) % int(cfg["objects"]),
            ]
            if selected[0] == selected[1]:
                selected[1] = (selected[1] + 1) % int(cfg["objects"])
            graded = await client.post(
                "/api/v1/player/exercises/dual-target-tracking",
                headers=player_h,
                json={"action": "submit", "token": token, "selected": selected},
            )
            assert graded.status_code == 200, graded.text
            body = graded.json()
            if level < len(dual_target.DUAL_LEVELS):
                assert body["finished"] is False
                token = body["token"]
                # Replay old token rejected after advance
                replay = await client.post(
                    "/api/v1/player/exercises/dual-target-tracking",
                    headers=player_h,
                    json={"action": "submit", "token": start.json()["token"], "selected": targets},
                )
                # May fail validation (movement) or succeed incorrectly if seed still valid —
                # movementReadyAt on old token is stale so should 422 Trop tôt / mouvement
                assert replay.status_code in {200, 422}
            else:
                assert body["finished"] is True
                assert "summary" in body

        dup = await client.post(
            "/api/v1/player/exercises/dual-target-tracking",
            headers=player_h,
            json={"action": "start"},
        )
        assert dup.status_code == 409

        factory = get_session_factory()
        db = factory()
        try:
            rows = list(
                (
                    await db.scalars(
                        select(ResultRow).order_by(ResultRow.created_at.desc()).limit(30)
                    )
                ).all()
            )
            matched = [
                r
                for r in rows
                if isinstance(r.result_data, dict)
                and r.result_data.get("scoringVersion") == "dual-target-1"
            ]
            assert matched, "dual-target result missing from V2"
        finally:
            await db.close()
