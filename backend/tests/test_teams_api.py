"""Teams management API integration tests against V2 TEST database."""

from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.main import app
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.modules.players.infrastructure.models import Player, Position
from app.modules.test_sessions.infrastructure.models import (
    SessionPlayer,
    TrainingSession,
)
from app.shared.infrastructure.database.enums import SessionPlayerStatus, SessionStatus
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
        pytest.skip("DATABASE_URL / JWT_SECRET required for teams API tests")
    import_all_models()
    yield
    await dispose_engine()
    clear_settings_cache()


async def _ensure_staff_user(
    *,
    email: str,
    password: str,
    role_name: str = "admin",
    full_name: str = "Teams Test User",
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


@pytest.mark.asyncio
async def test_admin_team_crud_and_status() -> None:
    email = f"teams-admin-{uuid.uuid4().hex[:8]}@example.com"
    password = "TeamsAdminPass1!"
    await _ensure_staff_user(email=email, password=password, role_name="admin")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {await _login(client, email, password)}"}
        name = f"U17 A {uuid.uuid4().hex[:6]}"
        created = await client.post(
            "/api/v1/teams",
            headers=headers,
            json={"name": name, "description": "Academy side"},
        )
        assert created.status_code == 201, created.text
        team_id = created.json()["id"]

        listed = await client.get("/api/v1/teams", headers=headers, params={"search": name})
        assert listed.status_code == 200
        assert listed.json()["total"] >= 1

        patched = await client.patch(
            f"/api/v1/teams/{team_id}",
            headers=headers,
            json={"description": "Updated"},
        )
        assert patched.status_code == 200
        assert patched.json()["description"] == "Updated"

        deactivated = await client.patch(
            f"/api/v1/teams/{team_id}/status",
            headers=headers,
            json={"is_active": False},
        )
        assert deactivated.status_code == 200
        assert deactivated.json()["is_active"] is False


@pytest.mark.asyncio
async def test_coach_and_staff_team_visibility_and_idor() -> None:
    admin_email = f"tv-admin-{uuid.uuid4().hex[:8]}@example.com"
    coach_email = f"tv-coach-{uuid.uuid4().hex[:8]}@example.com"
    other_coach_email = f"tv-ocoach-{uuid.uuid4().hex[:8]}@example.com"
    staff_email = f"tv-staff-{uuid.uuid4().hex[:8]}@example.com"
    password = "TeamsVisPass1!"
    await _ensure_staff_user(email=admin_email, password=password, role_name="admin")
    coach_id = await _ensure_staff_user(email=coach_email, password=password, role_name="coach")
    other_coach_id = await _ensure_staff_user(
        email=other_coach_email, password=password, role_name="coach"
    )
    staff_id = await _ensure_staff_user(email=staff_email, password=password, role_name="staff")
    primary_id = await _first_position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = {"Authorization": f"Bearer {await _login(client, admin_email, password)}"}
        coach_h = {"Authorization": f"Bearer {await _login(client, coach_email, password)}"}
        other_h = {"Authorization": f"Bearer {await _login(client, other_coach_email, password)}"}
        staff_h = {"Authorization": f"Bearer {await _login(client, staff_email, password)}"}

        team_a = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"Team A {uuid.uuid4().hex[:6]}"},
        )
        team_b = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"Team B {uuid.uuid4().hex[:6]}"},
        )
        assert team_a.status_code == 201 and team_b.status_code == 201
        team_a_id = team_a.json()["id"]
        team_b_id = team_b.json()["id"]

        for tid, uid, role in (
            (team_a_id, coach_id, "head_coach"),
            (team_a_id, staff_id, "staff"),
            (team_b_id, other_coach_id, "head_coach"),
            (team_b_id, coach_id, "assistant_coach"),  # multi-team coach
        ):
            r = await client.post(
                f"/api/v1/teams/{tid}/staff",
                headers=admin_h,
                json={"user_id": str(uid), "team_role": role},
            )
            assert r.status_code == 201, r.text

        # Duplicate active membership rejected
        dup = await client.post(
            f"/api/v1/teams/{team_a_id}/staff",
            headers=admin_h,
            json={"user_id": str(coach_id), "team_role": "staff"},
        )
        assert dup.status_code == 409

        coach_teams = await client.get("/api/v1/teams", headers=coach_h)
        assert coach_teams.status_code == 200
        coach_ids = {t["id"] for t in coach_teams.json()["items"]}
        assert team_a_id in coach_ids and team_b_id in coach_ids

        staff_teams = await client.get("/api/v1/teams", headers=staff_h)
        staff_ids = {t["id"] for t in staff_teams.json()["items"]}
        assert team_a_id in staff_ids and team_b_id not in staff_ids

        # Coach cannot create/deactivate teams
        assert (
            await client.post(
                "/api/v1/teams",
                headers=coach_h,
                json={"name": f"Nope {uuid.uuid4().hex[:4]}"},
            )
        ).status_code == 403
        assert (
            await client.patch(
                f"/api/v1/teams/{team_a_id}/status",
                headers=coach_h,
                json={"is_active": False},
            )
        ).status_code == 403

        # Players: unassigned admin-only; team-scoped for coach
        unassigned = await client.post(
            "/api/v1/players",
            headers=admin_h,
            json={
                "first_name": "Free",
                "last_name": f"Agent{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
            },
        )
        assert unassigned.status_code == 201
        unassigned_id = unassigned.json()["id"]

        player_a = await client.post(
            "/api/v1/players",
            headers=coach_h,
            json={
                "first_name": "Alpha",
                "last_name": f"P{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
                "team_id": team_a_id,
            },
        )
        assert player_a.status_code == 201, player_a.text
        player_a_id = player_a.json()["id"]

        player_b = await client.post(
            "/api/v1/players",
            headers=other_h,
            json={
                "first_name": "Beta",
                "last_name": f"P{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
                "team_id": team_b_id,
            },
        )
        assert player_b.status_code == 201
        player_b_id = player_b.json()["id"]

        # Multi-team player
        multi = await client.post(
            f"/api/v1/teams/{team_a_id}/players",
            headers=coach_h,
            json={"player_id": player_b_id},
        )
        assert multi.status_code == 201, multi.text

        coach_list = await client.get("/api/v1/players", headers=coach_h)
        assert coach_list.status_code == 200
        visible = {p["id"] for p in coach_list.json()["items"]}
        assert player_a_id in visible
        assert player_b_id in visible  # via team A or B membership for coach
        assert unassigned_id not in visible

        assert (
            await client.get(f"/api/v1/players/{unassigned_id}", headers=coach_h)
        ).status_code == 404
        assert (
            await client.get(f"/api/v1/players/{player_a_id}", headers=other_h)
        ).status_code == 404  # other coach not on team A only... wait player_a only on A

        admin_list = await client.get(
            "/api/v1/players",
            headers=admin_h,
            params={"search": unassigned.json()["last_name"]},
        )
        assert any(p["id"] == unassigned_id for p in admin_list.json()["items"])

        # Staff cannot manage player memberships
        denied = await client.post(
            f"/api/v1/teams/{team_a_id}/players",
            headers=staff_h,
            json={"player_id": unassigned_id},
        )
        assert denied.status_code == 403

        # Leave + rejoin staff
        removed = await client.delete(
            f"/api/v1/teams/{team_a_id}/staff/{coach_id}",
            headers=admin_h,
        )
        assert removed.status_code == 204
        assert (await client.get(f"/api/v1/teams/{team_a_id}", headers=coach_h)).status_code == 404
        rejoin = await client.post(
            f"/api/v1/teams/{team_a_id}/staff",
            headers=admin_h,
            json={"user_id": str(coach_id), "team_role": "head_coach"},
        )
        assert rejoin.status_code == 201


@pytest.mark.asyncio
async def test_membership_remove_preserves_player_and_history() -> None:
    admin_email = f"hist-admin-{uuid.uuid4().hex[:8]}@example.com"
    coach_email = f"hist-coach-{uuid.uuid4().hex[:8]}@example.com"
    password = "HistPassw0rd!"
    admin_id = await _ensure_staff_user(email=admin_email, password=password, role_name="admin")
    coach_id = await _ensure_staff_user(email=coach_email, password=password, role_name="coach")
    primary_id = await _first_position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_h = {"Authorization": f"Bearer {await _login(client, admin_email, password)}"}
        coach_h = {"Authorization": f"Bearer {await _login(client, coach_email, password)}"}

        team = await client.post(
            "/api/v1/teams",
            headers=admin_h,
            json={"name": f"Hist {uuid.uuid4().hex[:6]}"},
        )
        team_id = team.json()["id"]
        await client.post(
            f"/api/v1/teams/{team_id}/staff",
            headers=admin_h,
            json={"user_id": str(coach_id), "team_role": "head_coach"},
        )
        player = await client.post(
            "/api/v1/players",
            headers=coach_h,
            json={
                "first_name": "Keep",
                "last_name": f"Me{uuid.uuid4().hex[:5]}",
                "primary_position_id": str(primary_id),
                "team_id": team_id,
            },
        )
        assert player.status_code == 201
        player_id = uuid.UUID(player.json()["id"])

        factory = get_session_factory()
        session = factory()
        try:
            training = TrainingSession(
                title="Keep history",
                session_code=f"T{uuid.uuid4().hex[:8].upper()}",
                status=SessionStatus.DRAFT,
                created_by=admin_id,
            )
            session.add(training)
            await session.flush()
            participation = SessionPlayer(
                session_id=training.id,
                player_id=player_id,
                status=SessionPlayerStatus.JOINED,
            )
            session.add(participation)
            await session.commit()
            participation_id = participation.id
        finally:
            await session.close()

        removed = await client.delete(
            f"/api/v1/teams/{team_id}/players/{player_id}",
            headers=coach_h,
        )
        assert removed.status_code == 204

        factory = get_session_factory()
        session = factory()
        try:
            assert (await session.scalar(select(Player).where(Player.id == player_id))) is not None
            assert (
                await session.scalar(
                    select(SessionPlayer).where(SessionPlayer.id == participation_id)
                )
            ) is not None
        finally:
            await session.close()

        # Coach no longer sees the player (unassigned from their teams)
        assert (
            await client.get(f"/api/v1/players/{player_id}", headers=coach_h)
        ).status_code == 404
        assert (
            await client.get(f"/api/v1/players/{player_id}", headers=admin_h)
        ).status_code == 200
