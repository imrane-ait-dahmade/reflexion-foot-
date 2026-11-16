"""Async SQLAlchemy engine and session helpers (asyncpg).

The engine is created lazily — importing this module does not open a DB connection.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Return the process-wide async engine (created on first use)."""
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        if not settings.has_database_url:
            raise RuntimeError(
                "DATABASE_URL is not configured. Set it in the environment or .env file.",
            )
        # Neon expects TLS in production; callers should include sslmode/ssl in DATABASE_URL.
        _engine = create_async_engine(
            settings.async_database_url(),
            echo=settings.db_echo,
            pool_pre_ping=True,
        )
        _session_factory = async_sessionmaker(
            bind=_engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the async session factory, ensuring the engine exists."""
    global _session_factory
    if _session_factory is None:
        get_engine()
    assert _session_factory is not None
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an AsyncSession and always closes it."""
    session_factory = get_session_factory()
    session = session_factory()
    try:
        yield session
    finally:
        await session.close()


async def dispose_engine() -> None:
    """Dispose the engine and drop process-local singletons (app shutdown / tests)."""
    global _engine, _session_factory
    engine = _engine
    _engine = None
    _session_factory = None
    if engine is not None:
        await engine.dispose()
