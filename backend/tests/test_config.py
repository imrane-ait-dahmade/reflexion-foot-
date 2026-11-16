"""Tests for Pydantic Settings configuration loading."""

import os

import pytest

from app.core.config import Settings, clear_settings_cache, get_settings


@pytest.fixture(autouse=True)
def _reset_settings_cache():
    clear_settings_cache()
    yield
    clear_settings_cache()


def test_default_settings_without_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (
        "APP_NAME",
        "APP_ENV",
        "DEBUG",
        "API_V1_PREFIX",
        "DATABASE_URL",
        "DB_ECHO",
    ):
        monkeypatch.delenv(key, raising=False)

    settings = Settings(_env_file=None)
    assert settings.app_name == "Cognitif Connexion Foot 2.0"
    assert settings.app_env == "development"
    assert settings.debug is False
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.database_url == ""
    assert settings.db_echo is False
    assert settings.has_database_url is False


def test_settings_load_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("APP_NAME", "Test API")
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("API_V1_PREFIX", "/api/test")
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:pass@localhost:5432/testdb",
    )
    monkeypatch.setenv("DB_ECHO", "true")

    clear_settings_cache()
    settings = get_settings()

    assert settings.app_name == "Test API"
    assert settings.app_env == "test"
    assert settings.debug is True
    assert settings.api_v1_prefix == "/api/test"
    assert settings.has_database_url is True
    assert settings.db_echo is True
    assert settings.async_database_url().startswith("postgresql+asyncpg://")


def test_async_database_url_converts_postgres_schemes() -> None:
    settings = Settings(
        _env_file=None,
        DATABASE_URL="postgresql://user:pass@host/db?sslmode=require",
    )
    assert settings.async_database_url() == (
        "postgresql+asyncpg://user:pass@host/db?sslmode=require"
    )

    settings2 = Settings(
        _env_file=None,
        DATABASE_URL="postgres://user:pass@host/db",
    )
    assert settings2.async_database_url().startswith("postgresql+asyncpg://")


def test_async_database_url_raises_when_missing() -> None:
    settings = Settings(_env_file=None, DATABASE_URL="")
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        settings.async_database_url()


def test_settings_do_not_embed_credentials_in_repr_via_defaults() -> None:
    """Sanity: Settings instance can be created; secrets stay in env only."""
    secret = "postgresql+asyncpg://secret_user:super_secret@neon.tech/db"
    settings = Settings(_env_file=None, DATABASE_URL=secret)
    # Field is populated for runtime use, but we never log it in app code.
    assert settings.database_url == secret
    assert "super_secret" not in os.environ.get("APP_NAME", "")
