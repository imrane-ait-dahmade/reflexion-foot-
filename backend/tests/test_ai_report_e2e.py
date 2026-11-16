"""Real OpenAI session report generation against V2 TEST (skips if AI disabled)."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.main import app
from app.modules.ai_analysis.application.config import load_ai_settings
from app.modules.ai_analysis.infrastructure.models import AiReport
from app.modules.cognitive_tests.infrastructure.models import CognitiveTest
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.modules.players.infrastructure.models import Position
from app.shared.infrastructure.database.enums import AiReportType
from app.shared.infrastructure.database.models import import_all_models
from app.shared.infrastructure.database.session import dispose_engine, get_session_factory


@pytest.fixture(autouse=True)
async def _require_db_jwt_ai():
    clear_settings_cache()
    settings = get_settings()
    if not settings.has_database_url or not settings.has_jwt_secret:
        pytest.skip("DATABASE_URL / JWT_SECRET required")
    import_all_models()
    ai = load_ai_settings()
    if not ai.enabled:
        pytest.skip("AI_ANALYSIS_ENABLED + OPENAI_API_KEY required for real AI E2E")
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
            full_name="AI Staff",
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


async def _first_test_id() -> uuid.UUID:
    factory = get_session_factory()
    session = factory()
    try:
        row = await session.scalar(
            select(CognitiveTest)
            .where(CognitiveTest.is_active.is_(True))
            .order_by(CognitiveTest.name)
        )
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
async def test_real_openai_session_report_from_v2_attempts() -> None:
    admin_email = f"ai-admin-{uuid.uuid4().hex[:8]}@example.com"
    coach_email = f"ai-coach-{uuid.uuid4().hex[:8]}@example.com"
    password = "AiPassw0rd!"
    await _ensure_staff(email=admin_email, password=password, role_name="admin")
    coach_id = await _ensure_staff(email=coach_email, password=password, role_name="coach")
    test_id = await _first_test_id()
    position_id = await _position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test", timeout=120.0) as client:
        admin_h = {"Authorization": f"Bearer {await _login(client, admin_email, password)}"}
        coach_h = {"Authorization": f"Bearer {await _login(client, coach_email, password)}"}

        team = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"AI Team {uuid.uuid4().hex[:6]}"},
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
                "first_name": "AI",
                "last_name": f"P{uuid.uuid4().hex[:5]}",
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
                "exercise_ids": [str(test_id)],
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
        session_player_id = join.json()["session_player_id"]

        progress = await client.get("/api/v1/player/session", headers=player_h)
        assert progress.status_code == 200
        ex_id = progress.json()["exercises"][0]["session_exercise_id"]
        slug = progress.json()["exercises"][0]["slug"]

        # Persist a real observation result (or generic complete for challenge slugs)
        if slug in {
            "visual-tracking",
            "visual-memory",
            "reaction-time",
            "peripheral-vision",
            "football-visual-scanning",
            "sequential-visual-search",
        }:
            done = await client.post(
                f"/api/v1/player/exercises/{slug}/complete",
                headers=player_h,
                json={
                    "score": 78,
                    "accuracy": 78.0,
                    "response_time_ms": 1500,
                    "correct_answers": 7,
                    "errors": 2,
                    "average_reaction_ms": 420,
                    "best_reaction_ms": 310,
                    "duration_ms": 1500,
                    "metrics": {"source": "ai-e2e"},
                },
            )
        else:
            done = await client.post(
                f"/api/v1/player/session/exercises/{ex_id}/complete",
                headers=player_h,
                json={
                    "score": 78,
                    "accuracy": "78.0",
                    "response_time_ms": 1500,
                    "result_data": {"source": "ai-e2e"},
                },
            )
        assert done.status_code == 200, done.text

        # Insufficient-data abstention path for progress with force on empty focus
        abstain = await client.post(
            "/api/v1/ai/reports",
            headers=coach_h,
            json={
                "report_type": "test",
                "session_player_id": session_player_id,
                "training_session_id": session_id,
                "focus_test_slug": "nonexistent-slug-xyz",
                "force": True,
            },
        )
        assert abstain.status_code == 200, abstain.text
        assert abstain.json()["report_data"]["status"] == "abstained"

        report = await client.post(
            "/api/v1/ai/reports",
            headers=coach_h,
            json={
                "report_type": "session",
                "session_player_id": session_player_id,
                "training_session_id": session_id,
                "force": True,
            },
        )
        assert report.status_code == 200, report.text
        body = report.json()
        assert body["report_type"] == "session"
        assert body["model_name"]
        assert body["prompt_version"]
        data = body["report_data"]
        assert data.get("status") == "ready"
        assert data.get("fr", {}).get("executive_summary")
        assert data.get("ar", {}).get("executive_summary")
        assert data.get("source_attempt_ids")
        usage = data.get("token_usage") or {}
        assert int(usage.get("input") or 0) > 0 or int(usage.get("output") or 0) > 0
        assert "estimated_cost_usd" in data

        # Duplicate prevention
        dup = await client.post(
            "/api/v1/ai/reports",
            headers=coach_h,
            json={
                "report_type": "session",
                "session_player_id": session_player_id,
                "training_session_id": session_id,
                "force": False,
            },
        )
        assert dup.status_code == 409

        # Group report with one finished player
        group = await client.post(
            "/api/v1/ai/reports",
            headers=coach_h,
            json={
                "report_type": "group",
                "training_session_id": session_id,
                "force": True,
            },
        )
        assert group.status_code == 200, group.text
        assert group.json()["report_type"] == "group"
        assert group.json()["session_player_id"] is None
        gdata = group.json()["report_data"]
        assert gdata.get("status") in {"ready", "abstained"}
        assert gdata.get("source_attempt_ids")

        factory = get_session_factory()
        db = factory()
        try:
            rows = list(
                (
                    await db.scalars(
                        select(AiReport).where(AiReport.training_session_id == uuid.UUID(session_id))
                    )
                ).all()
            )
            assert any(_val(r.report_type) == AiReportType.SESSION.value for r in rows)
            assert any(_val(r.report_type) == AiReportType.GROUP.value for r in rows)
        finally:
            await db.close()


def _val(value: object) -> str:
    return str(getattr(value, "value", value))
