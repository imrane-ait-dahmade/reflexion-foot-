"""Alembic chain tests against an isolated temporary PostgreSQL (Docker).

Never uses Neon V1/V2. Skips if Docker is unavailable.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
import time
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from app.shared.infrastructure.database.models import V2_TABLES, import_all_models

BACKEND_ROOT = Path(__file__).resolve().parents[1]
CONTAINER_PREFIX = "ccf-v2-alembic-test"
PG_IMAGE = "postgres:16-alpine"
PG_USER = "ccf"
PG_PASSWORD = "ccf_test"
PG_DB = "ccf_v2_mig"


def _docker_available() -> bool:
    if shutil.which("docker") is None:
        return False
    try:
        subprocess.run(
            ["docker", "info"],
            check=True,
            capture_output=True,
            timeout=20,
        )
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError):
        return False


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _wait_pg(url: str, *, timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    last_err: Exception | None = None
    while time.time() < deadline:
        try:
            engine = create_engine(url, pool_pre_ping=True)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            engine.dispose()
            return
        except Exception as exc:  # noqa: BLE001 — retry until ready
            last_err = exc
            time.sleep(1.0)
    raise RuntimeError(f"Postgres not ready: {last_err}")


@pytest.fixture()
def isolated_postgres_url() -> Iterator[str]:
    if not _docker_available():
        pytest.skip("Docker not available for isolated Alembic tests")

    name = f"{CONTAINER_PREFIX}-{uuid.uuid4().hex[:8]}"
    port = str(_free_port())
    subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "-e",
            f"POSTGRES_USER={PG_USER}",
            "-e",
            f"POSTGRES_PASSWORD={PG_PASSWORD}",
            "-e",
            f"POSTGRES_DB={PG_DB}",
            "-p",
            f"{port}:5432",
            PG_IMAGE,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    url = (
        f"postgresql+psycopg://{PG_USER}:{PG_PASSWORD}"
        f"@127.0.0.1:{port}/{PG_DB}"
    )
    try:
        _wait_pg(url)
        yield url
    finally:
        subprocess.run(
            ["docker", "rm", "-f", name],
            check=False,
            capture_output=True,
        )


def _run_alembic(database_url: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    # Satisfy settings validators if they read JWT in same process tools
    env.setdefault("JWT_SECRET", "migration-test-secret-at-least-32-chars!!")
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_ROOT,
        env=env,
        check=True,
        capture_output=True,
        text=True,
    )


def test_alembic_upgrade_head_on_empty_database(isolated_postgres_url: str) -> None:
    result = _run_alembic(isolated_postgres_url, "upgrade", "head")
    assert result.returncode == 0

    engine = create_engine(isolated_postgres_url)
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        assert "alembic_version" in tables
        for name in V2_TABLES:
            assert name in tables, f"missing table after upgrade head: {name}"

        with engine.connect() as conn:
            version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
            assert version == "20261115_0006"

            # Enum remap from 0006
            labels = {
                row[0]
                for row in conn.execute(
                    text(
                        "SELECT enumlabel FROM pg_enum e "
                        "JOIN pg_type t ON e.enumtypid = t.oid "
                        "WHERE t.typname = 'session_status'"
                    )
                )
            }
            assert labels == {"draft", "in_progress", "completed", "cancelled"}

            # Refresh token family column from 0003
            cols = {c["name"] for c in insp.get_columns("refresh_tokens")}
            assert "family_id" in cols
            assert "token_hash" in cols

            # Players reshape from 0004
            player_cols = {c["name"] for c in insp.get_columns("players")}
            assert "first_name" in player_cols
            assert "last_name" in player_cols
            assert "primary_position_id" in player_cols
            assert "full_name" not in player_cols
            assert "position_id" not in player_cols

            # Teams from 0005
            assert "teams" in tables
            assert "team_staff" in tables
            assert "team_players" in tables

            # Session extras from 0006
            session_cols = {c["name"] for c in insp.get_columns("training_sessions")}
            assert "team_id" in session_cols
            assert "session_name_counters" in tables
    finally:
        engine.dispose()


def test_alembic_upgrade_matches_orm_table_set(isolated_postgres_url: str) -> None:
    _run_alembic(isolated_postgres_url, "upgrade", "head")
    import_all_models()
    from app.shared.infrastructure.database.base import Base

    engine = create_engine(isolated_postgres_url)
    try:
        db_tables = set(inspect(engine).get_table_names()) - {"alembic_version"}
        model_tables = set(Base.metadata.tables.keys())
        assert model_tables == set(V2_TABLES)
        missing = model_tables - db_tables
        extra = db_tables - model_tables
        assert not missing, f"ORM tables missing in DB: {missing}"
        assert not extra, f"Unexpected DB tables not in ORM: {extra}"
    finally:
        engine.dispose()


def test_alembic_downgrade_base_and_reupgrade(isolated_postgres_url: str) -> None:
    _run_alembic(isolated_postgres_url, "upgrade", "head")
    _run_alembic(isolated_postgres_url, "downgrade", "base")

    engine = create_engine(isolated_postgres_url)
    try:
        tables = set(inspect(engine).get_table_names())
        # alembic_version may remain empty or absent depending on version
        leftover = tables - {"alembic_version"}
        assert not leftover, f"tables remain after downgrade base: {leftover}"
    finally:
        engine.dispose()

    _run_alembic(isolated_postgres_url, "upgrade", "head")
    engine = create_engine(isolated_postgres_url)
    try:
        tables = set(inspect(engine).get_table_names())
        for name in V2_TABLES:
            assert name in tables
    finally:
        engine.dispose()
