"""Application settings loaded from environment / `.env` (Pydantic Settings v2)."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the FastAPI backend.

    Secrets such as DATABASE_URL must come from the environment — never hardcode them.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = Field(default="Cognitif Connexion Foot 2.0", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=False, alias="DEBUG")
    api_v1_prefix: str = Field(default="/api/v1", alias="API_V1_PREFIX")
    database_url: str = Field(default="", alias="DATABASE_URL")
    db_echo: bool = Field(default=False, alias="DB_ECHO")

    # Optional extras (not required by the DB foundation task)
    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    @field_validator("database_url", mode="before")
    @classmethod
    def strip_database_url(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @property
    def has_database_url(self) -> bool:
        return bool(self.database_url)

    def async_database_url(self) -> str:
        """Return a SQLAlchemy async URL using the asyncpg driver."""
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is not configured.")
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            return url
        if url.startswith("postgres://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgres://")
        if url.startswith("postgresql://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgresql://")
        if url.startswith("postgresql+psycopg://"):
            return "postgresql+asyncpg://" + url.removeprefix("postgresql+psycopg://")
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    """Reset cached settings (used by tests)."""
    get_settings.cache_clear()
