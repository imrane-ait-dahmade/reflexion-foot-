"""Players management API integration tests against V2 TEST database."""

from __future__ import annotations

import io
import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from openpyxl import Workbook
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
        pytest.skip("DATABASE_URL / JWT_SECRET required for players API tests")
    import_all_models()
    yield
    await dispose_engine()
    clear_settings_cache()


async def _ensure_staff_user(
    *,
    email: str,
    password: str,
    role_name: str = "admin",
    full_name: str = "Players Test Admin",
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
            # Ensure role assignment
            role = await repo.get_role_by_name(role_name)
            assert role is not None
            has_role = any(ur.role_id == role.id for ur in existing.user_roles)
            if not has_role:
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
        assert pos is not None, "Positions missing — run seeds"
        return pos.id
    finally:
        await session.close()


async def _position_ids(n: int = 2) -> list[uuid.UUID]:
    factory = get_session_factory()
    session = factory()
    try:
        rows = list(
            (
                await session.scalars(
                    select(Position)
                    .where(Position.is_active.is_(True))
                    .order_by(Position.display_order)
                    .limit(n)
                )
            ).all()
        )
        assert len(rows) >= n
        return [r.id for r in rows]
    finally:
        await session.close()


def _xlsx_bytes(rows: list[list[object]]) -> bytes:
    wb = Workbook()
    ws = wb.active
    assert ws is not None
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_players_crud_validation_positions_and_access_code() -> None:
    email = f"players-admin-{uuid.uuid4().hex[:8]}@example.com"
    password = "PlayersPassw0rd!"
    await _ensure_staff_user(email=email, password=password, role_name="admin")
    primary_id, secondary_id = await _position_ids(2)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, email, password)
        headers = {"Authorization": f"Bearer {token}"}

        positions = await client.get("/api/v1/positions", headers=headers)
        assert positions.status_code == 200
        assert len(positions.json()) >= 10

        bad = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "Ada",
                "last_name": "Lovelace",
                "primary_position_id": str(primary_id),
                "secondary_position_ids": [str(primary_id)],
                "height_cm": 90,
            },
        )
        assert bad.status_code == 422

        create = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "Ada",
                "last_name": f"Player{uuid.uuid4().hex[:6]}",
                "primary_position_id": str(primary_id),
                "secondary_position_ids": [str(secondary_id)],
                "date_of_birth": "2001-05-12",
                "gender": "female",
                "preferred_foot": "left",
                "height_cm": 170,
                "weight_kg": "62.5",
                "jersey_number": 10,
            },
        )
        assert create.status_code == 201, create.text
        body = create.json()
        player_id = body["id"]
        assert body["access_code"]
        assert body["primary_position_id"] == str(primary_id)
        assert str(secondary_id) in body["secondary_position_ids"]
        access_code = body["access_code"]

        listed = await client.get(
            "/api/v1/players",
            headers=headers,
            params={"search": body["last_name"], "is_active": True},
        )
        assert listed.status_code == 200
        assert listed.json()["total"] >= 1

        got = await client.get(f"/api/v1/players/{player_id}", headers=headers)
        assert got.status_code == 200
        assert "access_code" not in got.json()

        patched = await client.patch(
            f"/api/v1/players/{player_id}",
            headers=headers,
            json={"jersey_number": 7, "nationality": "FR"},
        )
        assert patched.status_code == 200
        assert patched.json()["jersey_number"] == 7
        assert patched.json()["nationality"] == "FR"

        rotated = await client.post(
            f"/api/v1/players/{player_id}/access-code/rotate",
            headers=headers,
        )
        assert rotated.status_code == 200
        assert rotated.json()["access_code"]
        assert rotated.json()["access_code"] != access_code


@pytest.mark.asyncio
async def test_staff_read_only_cannot_create_player() -> None:
    email = f"players-staff-{uuid.uuid4().hex[:8]}@example.com"
    password = "StaffPassw0rd!"
    await _ensure_staff_user(email=email, password=password, role_name="staff")
    primary_id = await _first_position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, email, password)
        headers = {"Authorization": f"Bearer {token}"}

        ok_list = await client.get("/api/v1/players", headers=headers)
        assert ok_list.status_code == 200

        denied = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "No",
                "last_name": "Create",
                "primary_position_id": str(primary_id),
            },
        )
        assert denied.status_code == 403


@pytest.mark.asyncio
async def test_notes_authorship_rules() -> None:
    admin_email = f"notes-admin-{uuid.uuid4().hex[:8]}@example.com"
    author_email = f"notes-author-{uuid.uuid4().hex[:8]}@example.com"
    other_email = f"notes-other-{uuid.uuid4().hex[:8]}@example.com"
    password = "NotesPassw0rd!"
    await _ensure_staff_user(email=admin_email, password=password, role_name="admin")
    author_id = await _ensure_staff_user(
        email=author_email,
        password=password,
        role_name="coach",
        full_name="Note Author",
    )
    other_id = await _ensure_staff_user(
        email=other_email,
        password=password,
        role_name="coach",
        full_name="Other Coach",
    )
    primary_id = await _first_position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_token = await _login(client, admin_email, password)
        author_token = await _login(client, author_email, password)
        other_token = await _login(client, other_email, password)
        admin_headers = {"Authorization": f"Bearer {admin_token}"}
        author_headers = {"Authorization": f"Bearer {author_token}"}
        other_headers = {"Authorization": f"Bearer {other_token}"}

        team = await client.post(
            "/api/v1/teams",
            headers=admin_headers,
            json={"name": f"Notes Team {uuid.uuid4().hex[:6]}"},
        )
        assert team.status_code == 201
        team_id = team.json()["id"]
        for uid, role in ((author_id, "head_coach"), (other_id, "assistant_coach")):
            assigned = await client.post(
                f"/api/v1/teams/{team_id}/staff",
                headers=admin_headers,
                json={"user_id": str(uid), "team_role": role},
            )
            assert assigned.status_code == 201, assigned.text

        created = await client.post(
            "/api/v1/players",
            headers=author_headers,
            json={
                "first_name": "Note",
                "last_name": f"Subject{uuid.uuid4().hex[:6]}",
                "primary_position_id": str(primary_id),
                "team_id": team_id,
            },
        )
        assert created.status_code == 201, created.text
        player_id = created.json()["id"]

        note = await client.post(
            f"/api/v1/players/{player_id}/notes",
            headers=author_headers,
            json={"content": "Strong peripheral vision"},
        )
        assert note.status_code == 201
        assert note.json()["author_user_id"] == str(author_id)
        note_id = note.json()["id"]

        # Other coach with notes.manage can edit
        edited = await client.patch(
            f"/api/v1/players/{player_id}/notes/{note_id}",
            headers=other_headers,
            json={"content": "Updated by manager"},
        )
        assert edited.status_code == 200
        assert edited.json()["content"] == "Updated by manager"

        deleted = await client.delete(
            f"/api/v1/players/{player_id}/notes/{note_id}",
            headers=author_headers,
        )
        assert deleted.status_code == 204


@pytest.mark.asyncio
async def test_import_preview_rejects_and_duplicates() -> None:
    email = f"players-import-{uuid.uuid4().hex[:8]}@example.com"
    password = "ImportPassw0rd!"
    await _ensure_staff_user(email=email, password=password, role_name="admin")
    primary_id = await _first_position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, email, password)
        headers = {"Authorization": f"Bearer {token}"}

        unique_last = f"Import{uuid.uuid4().hex[:6]}"
        seeded = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "Existing",
                "last_name": unique_last,
                "primary_position_id": str(primary_id),
                "date_of_birth": "1999-01-01",
            },
        )
        assert seeded.status_code == 201

        content = _xlsx_bytes(
            [
                [
                    "first_name",
                    "last_name",
                    "primary_position_code",
                    "date_of_birth",
                    "height_cm",
                ],
                ["Existing", unique_last, "ST", "1999-01-01", 180],
                ["Bad", "Row", "ZZ", None, 50],
                ["Fresh", f"New{uuid.uuid4().hex[:4]}", "CM", "2000-02-02", 175],
            ]
        )
        preview = await client.post(
            "/api/v1/players/import/preview",
            headers=headers,
            files={
                "file": (
                    "players.xlsx",
                    content,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
            },
        )
        assert preview.status_code == 200, preview.text
        body = preview.json()
        assert body["duplicate_count"] >= 1
        assert body["reject_count"] >= 1
        assert body["valid_count"] >= 1

        confirm = await client.post(
            "/api/v1/players/import/confirm",
            headers=headers,
            json={"rows": body["valid_rows"]},
        )
        assert confirm.status_code == 200, confirm.text
        assert confirm.json()["created_count"] == body["valid_count"]
        for player in confirm.json()["created_players"]:
            assert player["access_code"]


@pytest.mark.asyncio
async def test_deactivate_preserves_session_history() -> None:
    email = f"players-deact-{uuid.uuid4().hex[:8]}@example.com"
    password = "DeactPassw0rd!"
    user_id = await _ensure_staff_user(email=email, password=password, role_name="admin")
    primary_id = await _first_position_id()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = await _login(client, email, password)
        headers = {"Authorization": f"Bearer {token}"}

        created = await client.post(
            "/api/v1/players",
            headers=headers,
            json={
                "first_name": "Keep",
                "last_name": f"History{uuid.uuid4().hex[:6]}",
                "primary_position_id": str(primary_id),
            },
        )
        assert created.status_code == 201
        player_id = uuid.UUID(created.json()["id"])

        factory = get_session_factory()
        session = factory()
        try:
            training = TrainingSession(
                title="History check",
                session_code=f"H{uuid.uuid4().hex[:8].upper()}",
                status=SessionStatus.DRAFT,
                created_by=user_id,
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

        deactivated = await client.patch(
            f"/api/v1/players/{player_id}/status",
            headers=headers,
            json={"is_active": False},
        )
        assert deactivated.status_code == 200
        assert deactivated.json()["is_active"] is False
        assert deactivated.json()["archived_at"] is not None

        factory = get_session_factory()
        session = factory()
        try:
            still_there = await session.scalar(
                select(SessionPlayer).where(SessionPlayer.id == participation_id)
            )
            assert still_there is not None
            player = await session.scalar(select(Player).where(Player.id == player_id))
            assert player is not None
            assert player.is_active is False
        finally:
            await session.close()
