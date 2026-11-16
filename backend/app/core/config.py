"""Application settings loaded from environment / `.env` (Pydantic Settings v2)."""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the FastAPI backend.

    Secrets such as DATABASE_URL / JWT_SECRET must come from the environment.
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

    app_version: str = Field(default="0.1.0", alias="APP_VERSION")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    # JWT / session
    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(
        default=15,
        alias="ACCESS_TOKEN_EXPIRE_MINUTES",
    )
    refresh_token_expire_days: int = Field(
        default=14,
        alias="REFRESH_TOKEN_EXPIRE_DAYS",
    )
    jwt_issuer: str = Field(
        default="cognitif-connexion-foot-v2",
        alias="JWT_ISSUER",
    )
    jwt_audience: str = Field(
        default="cognitif-connexion-foot-api",
        alias="JWT_AUDIENCE",
    )

    # One-time / ops bootstrap (never hardcode passwords in code)
    bootstrap_admin_email: str = Field(default="", alias="BOOTSTRAP_ADMIN_EMAIL")
    bootstrap_admin_password: str = Field(default="", alias="BOOTSTRAP_ADMIN_PASSWORD")
    bootstrap_admin_full_name: str = Field(
        default="Platform Admin",
        alias="BOOTSTRAP_ADMIN_FULL_NAME",
    )

    # AI analysis (server-side only)
    ai_analysis_enabled: bool = Field(default=False, alias="AI_ANALYSIS_ENABLED")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    openai_model: str = Field(default="gpt-4.1-mini", alias="OPENAI_MODEL")
    ai_analysis_timeout_seconds: float = Field(
        default=60.0,
        alias="AI_ANALYSIS_TIMEOUT_SECONDS",
    )
    ai_analysis_max_retries: int = Field(default=1, alias="AI_ANALYSIS_MAX_RETRIES")
    ai_input_cost_per_1m: float = Field(default=0.40, alias="AI_INPUT_COST_PER_1M")
    ai_output_cost_per_1m: float = Field(default=1.60, alias="AI_OUTPUT_COST_PER_1M")

    @field_validator("database_url", "jwt_secret", "openai_api_key", mode="before")
    @classmethod
    def strip_secrets(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value

    @property
    def has_database_url(self) -> bool:
        return bool(self.database_url)

    @property
    def has_jwt_secret(self) -> bool:
        return bool(self.jwt_secret) and len(self.jwt_secret) >= 32

    def async_database_url(self) -> str:
        """Return a SQLAlchemy async URL using the asyncpg driver."""
        if not self.database_url:
            raise RuntimeError("DATABASE_URL is not configured.")
        url = self.database_url
        if url.startswith("postgresql+asyncpg://"):
            pass
        elif url.startswith("postgres://"):
            url = "postgresql+asyncpg://" + url.removeprefix("postgres://")
        elif url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url.removeprefix("postgresql://")
        elif url.startswith("postgresql+psycopg://"):
            url = "postgresql+asyncpg://" + url.removeprefix("postgresql+psycopg://")
        return url.replace("sslmode=require", "ssl=require")


@lru_cache
def get_settings() -> Settings:
    return Settings()


def clear_settings_cache() -> None:
    """Reset cached settings (used by tests)."""
    get_settings.cache_clear()
