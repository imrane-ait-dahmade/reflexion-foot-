"""FastAPI application entrypoint for Cognitif Connexion Foot 2.0."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.shared.infrastructure.database.session import dispose_engine

configure_logging()
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Manage application lifecycle.

    Does not open a database connection at startup (avoids import/boot coupling).
    Disposes the async engine on shutdown if it was created during the process life.
    """
    yield
    await dispose_engine()


app = FastAPI(
    title=settings.app_name,
    description="Backend API for football cognitive assessment (architecture foundation).",
    version=settings.app_version,
    debug=settings.debug,
    lifespan=lifespan,
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Cognitif Connexion Foot 2.0 API",
        "status": "ok",
    }


@app.get("/health")
def health() -> dict[str, str]:
    # Never include DATABASE_URL or other secrets here.
    return {
        "status": "healthy",
        "service": "cognitif-connexion-foot-api",
        "environment": settings.app_env,
    }
