"""Training sessions API integration tests against V2 TEST database."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.main import app
from app.modules.cognitive_tests.infrastructure.models import CognitiveTest
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.modules.players.infrastructure.models import Position
from app.modules.results.infrastructure.models import TestAttempt as AttemptRow
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
        pytest.skip("DATABASE_URL / JWT_SECRET required for sessions API tests")
    import_all_models()
    yield
    await dispose_engine()
    clear_settings_cache()


async def _ensure_staff_user(
    *,
    email: str,
    password: str,
    role_name: str = "admin",
    full_name: str = "Sessions Test User",
) -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        repo = UserRepository(session)
        existing = await repo.get_by_email(email)
        if existing is not None:
            existing.password_hash = hash_password(password)
            existing.is_active = True
            existing.full_name = full_name
            role = await repo.get_role_by_name(role_name)
            assert role is not None
            if not any(ur.role_id == role.id for ur in existing.user_roles):
                session.add(UserRole(user_id=existing.id, role_id=role.id))
            await session.commit()
            return existing.id

        role = await repo.get_role_by_name(role_name)
        assert role is not None
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


async def _login(client: AsyncClient, email: str, password: str) -> str:
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


async def _first_position_id() -> uuid.UUID:
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


async def _exercise_ids(n: int = 2) -> list[uuid.UUID]:
    factory = get_session_factory()
    session = factory()
    try:
        rows = list(
            (
                await session.scalars(
                    select(CognitiveTest)
                    .where(CognitiveTest.is_active.is_(True))
                    .order_by(CognitiveTest.name)
                    .limit(n)
                )
            ).all()
        )
        assert len(rows) >= n
        return [r.id for r in rows]
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_session_lifecycle_team_and_manual_and_player_progress() -> None:
    admin_email = f"sess-admin-{uuid.uuid4().hex[:8]}@example.com"
    coach_email = f"sess-coach-{uuid.uuid4().hex[:8]}@example.com"
    other_email = f"sess-other-{uuid.uuid4().hex[:8]}@example.com"
    password = "SessPassw0rd!"
    await _ensure_staff_user(email=admin_email, password=password, role_name="admin")
    coach_id = await _ensure_staff_user(email=coach_email, password=password, role_name="coach")
    await _ensure_staff_user(email=other_email, password=password, role_name="coach")
    primary_id = await _first_position_id()
    exercise_ids = await _exercise_ids(2)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = {"Authorization": f"Bearer {await _login(client, admin_email, password)}"}
        coach_h = {"Authorization": f"Bearer {await _login(client, coach_email, password)}"}
        other_h = {"Authorization": f"Bearer {await _login(client, other_email, password)}"}

        team = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"Sess Team {uuid.uuid4().hex[:6]}"},
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

        # Catalog
        catalog = await client.get("/api/v1/cognitive-tests", headers=coach_h)
        assert catalog.status_code == 200
        assert len(catalog.json()) >= 2

        # Create player with access code
        player = await client.post(
            "/api/v1/players",
            headers=coach_h,
            json={
                "first_name": "Sess",
                "last_name": f"Player{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
                "team_id": team_id,
            },
        )
        assert player.status_code == 201, player.text
        player_id = player.json()["id"]
        personal_code = player.json()["access_code"]

        # Unauthorized player for other coach
        foreign = await client.post(
            "/api/v1/players",
            headers=admin_h,
            json={
                "first_name": "Foreign",
                "last_name": f"P{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
            },
        )
        foreign_id = foreign.json()["id"]

        denied = await client.post(
            "/api/v1/sessions",
            headers=coach_h,
            json={
                "team_id": team_id,
                "player_ids": [foreign_id],
                "exercise_ids": [str(x) for x in exercise_ids],
            },
        )
        assert denied.status_code == 404

        created = await client.post(
            "/api/v1/sessions",
            headers=coach_h,
            json={
                "team_id": team_id,
                "player_ids": [player_id],
                "exercise_ids": [str(x) for x in exercise_ids],
            },
        )
        assert created.status_code == 201, created.text
        body = created.json()
        session_id = body["id"]
        assert body["title"].startswith("Session #")
        assert body["session_code"]
        assert body["status"] == "draft"
        assert len(body["exercises"]) == 2
        assert body["exercises"][0]["display_order"] == 0
        session_code = body["session_code"]

        # Manual session without team
        player2 = await client.post(
            "/api/v1/players",
            headers=coach_h,
            json={
                "first_name": "Manual",
                "last_name": f"P{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
                "team_id": team_id,
            },
        )
        manual = await client.post(
            "/api/v1/sessions",
            headers=coach_h,
            json={
                "player_ids": [player2.json()["id"]],
                "exercise_ids": [str(exercise_ids[0])],
            },
        )
        assert manual.status_code == 201
        assert manual.json()["team_id"] is None
        assert manual.json()["title"] != body["title"]

        # Duplicate participant
        dup = await client.post(
            f"/api/v1/sessions/{session_id}/players",
            headers=coach_h,
            json={"player_ids": [player_id]},
        )
        assert dup.status_code == 409

        # Reorder exercises in draft
        reversed_ids = [str(exercise_ids[1]), str(exercise_ids[0])]
        replaced = await client.put(
            f"/api/v1/sessions/{session_id}/exercises",
            headers=coach_h,
            json={"exercise_ids": reversed_ids},
        )
        assert replaced.status_code == 200, replaced.text
        ordered = sorted(
            replaced.json()["exercises"],
            key=lambda e: e["display_order"],
        )
        assert [e["cognitive_test_id"] for e in ordered] == reversed_ids

        # Start
        started = await client.post(
            f"/api/v1/sessions/{session_id}/start",
            headers=coach_h,
        )
        assert started.status_code == 200
        assert started.json()["status"] == "in_progress"

        # Frozen mutations
        assert (
            await client.post(
                f"/api/v1/sessions/{session_id}/players",
                headers=coach_h,
                json={"player_ids": [player2.json()["id"]]},
            )
        ).status_code == 422
        assert (
            await client.put(
                f"/api/v1/sessions/{session_id}/exercises",
                headers=coach_h,
                json={"exercise_ids": [str(exercise_ids[0])]},
            )
        ).status_code == 422

        # Other coach IDOR
        assert (
            await client.get(f"/api/v1/sessions/{session_id}", headers=other_h)
        ).status_code == 404

        # Player join — not registered denied uses wrong personal
        bad_join = await client.post(
            "/api/v1/player/session/join",
            json={"personal_code": "definitely-wrong-code", "session_code": session_code},
        )
        assert bad_join.status_code == 401

        join = await client.post(
            "/api/v1/player/session/join",
            json={"personal_code": personal_code, "session_code": session_code},
        )
        assert join.status_code == 200, join.text
        player_token = join.json()["access_token"]
        player_h = {"Authorization": f"Bearer {player_token}"}

        progress = await client.get("/api/v1/player/session", headers=player_h)
        assert progress.status_code == 200
        assert progress.json()["remaining_count"] == 2
        first_ex = progress.json()["exercises"][0]["session_exercise_id"]
        second_ex = progress.json()["exercises"][1]["session_exercise_id"]

        # Skip ahead denied
        skip = await client.post(
            f"/api/v1/player/session/exercises/{second_ex}/start",
            headers=player_h,
        )
        assert skip.status_code == 422

        started_ex = await client.post(
            f"/api/v1/player/session/exercises/{first_ex}/start",
            headers=player_h,
        )
        assert started_ex.status_code == 200

        done1 = await client.post(
            f"/api/v1/player/session/exercises/{first_ex}/complete",
            headers=player_h,
            json={
                "score": 80,
                "accuracy": "75.0",
                "response_time_ms": 1200,
                "result_data": {"ok": True},
            },
        )
        assert done1.status_code == 200
        assert done1.json()["completed_count"] == 1

        done2 = await client.post(
            f"/api/v1/player/session/exercises/{second_ex}/complete",
            headers=player_h,
            json={
                "score": 90,
                "accuracy": "88.5",
                "response_time_ms": 900,
                "result_data": {},
            },
        )
        assert done2.status_code == 200, done2.text
        assert done2.json()["completed_count"] == 2
        assert done2.json()["remaining_count"] == 0
        assert done2.json()["participation_status"] == "completed"

        completed = await client.post(
            f"/api/v1/sessions/{session_id}/complete",
            headers=coach_h,
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"
        assert completed.json()["session_code"] is None

        # Attempts preserved
        factory = get_session_factory()
        db = factory()
        try:
            count = len(list((await db.scalars(select(AttemptRow))).all()))
            assert count >= 2
        finally:
            await db.close()


@pytest.mark.asyncio
async def test_cancel_and_draft_remove_participant() -> None:
    email = f"sess-cancel-{uuid.uuid4().hex[:8]}@example.com"
    password = "CancelPass1!"
    await _ensure_staff_user(email=email, password=password, role_name="admin")
    primary_id = await _first_position_id()
    exercise_ids = await _exercise_ids(1)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {await _login(client, email, password)}"}
        p1 = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "A",
                "last_name": f"X{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
            },
        )
        p2 = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "B",
                "last_name": f"Y{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
            },
        )
        created = await client.post(
            "/api/v1/sessions",
            headers=headers,
            json={
                "player_ids": [p1.json()["id"], p2.json()["id"]],
                "exercise_ids": [str(exercise_ids[0])],
            },
        )
        assert created.status_code == 201
        sid = created.json()["id"]

        removed = await client.delete(
            f"/api/v1/sessions/{sid}/players/{p2.json()['id']}",
            headers=headers,
        )
        assert removed.status_code == 200, removed.text
        remaining = [
            p
            for p in removed.json()["players"]
            if p["player_id"] == p2.json()["id"] and p["status"] != "withdrawn"
        ]
        assert remaining == []

        cancelled = await client.post(f"/api/v1/sessions/{sid}/cancel", headers=headers)
        assert cancelled.status_code == 200
        assert cancelled.json()["status"] == "cancelled"

        # Invalid transition
        assert (
            await client.post(f"/api/v1/sessions/{sid}/start", headers=headers)
        ).status_code == 422
