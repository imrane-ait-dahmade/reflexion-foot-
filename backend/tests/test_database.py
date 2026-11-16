"""Tests for SQLAlchemy base metadata and async session wiring (mocked)."""

from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.orm import DeclarativeBase

import app.shared.infrastructure.database.session as session_module
from app.core.config import clear_settings_cache
from app.shared.infrastructure.database.base import Base
from app.shared.infrastructure.database.session import (
    dispose_engine,
    get_db,
    get_engine,
    get_session_factory,
)


def _force_reset_engine_singletons() -> None:
    session_module._engine = None
    session_module._session_factory = None
    clear_settings_cache()


@pytest.fixture(autouse=True)
async def _reset_engine():
    _force_reset_engine_singletons()
    yield
    try:
        await dispose_engine()
    finally:
        _force_reset_engine_singletons()


def test_base_is_declarative_and_has_metadata() -> None:
    assert issubclass(Base, DeclarativeBase)
    assert Base.metadata is not None
    # No business tables registered yet.
    assert list(Base.metadata.tables.keys()) == []


def test_get_engine_requires_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    clear_settings_cache()
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_engine()


def test_get_engine_creates_async_engine(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pass@localhost:5432/testdb",
    )
    clear_settings_cache()

    fake_engine = AsyncMock(name="AsyncEngine")
    fake_factory = MagicMock(name="session_factory")

    with (
        patch(
            "app.shared.infrastructure.database.session.create_async_engine",
            return_value=fake_engine,
        ) as create_engine,
        patch(
            "app.shared.infrastructure.database.session.async_sessionmaker",
            return_value=fake_factory,
        ) as sessionmaker,
    ):
        engine = get_engine()
        assert engine is fake_engine
        create_engine.assert_called_once()
        kwargs = create_engine.call_args.kwargs
        assert kwargs.get("pool_pre_ping") is True
        assert create_engine.call_args.args[0].startswith("postgresql+asyncpg://")
        sessionmaker.assert_called_once()
        assert get_session_factory() is fake_factory
        # Second call reuses singleton
        assert get_engine() is fake_engine


@pytest.mark.asyncio
async def test_get_db_yields_and_closes_session(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pass@localhost:5432/testdb",
    )
    clear_settings_cache()

    mock_session = AsyncMock()
    mock_factory = MagicMock(return_value=mock_session)

    with patch(
        "app.shared.infrastructure.database.session.get_session_factory",
        return_value=mock_factory,
    ):
        gen: AsyncGenerator = get_db()
        session = await gen.__anext__()
        assert session is mock_session
        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()
        mock_session.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_dispose_engine_clears_singletons(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pass@localhost:5432/testdb",
    )
    clear_settings_cache()

    fake_engine = AsyncMock()
    with (
        patch(
            "app.shared.infrastructure.database.session.create_async_engine",
            return_value=fake_engine,
        ),
        patch(
            "app.shared.infrastructure.database.session.async_sessionmaker",
            return_value=MagicMock(),
        ),
    ):
        get_engine()
        await dispose_engine()
        fake_engine.dispose.assert_awaited_once()

    # After dispose, missing URL should fail again (fresh singleton)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    clear_settings_cache()
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        get_engine()
