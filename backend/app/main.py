"""FastAPI application entrypoint for Cognitif Connexion Foot 2.0."""

from fastapi import FastAPI

app = FastAPI(
    title="Cognitif Connexion Foot 2.0",
    description="Backend API foundation",
    version="0.1.0",
)


@app.get("/")
def root() -> dict[str, str]:
    return {
        "message": "Cognitif Connexion Foot 2.0 API",
        "status": "ok",
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "healthy",
        "service": "cognitif-connexion-foot-api",
    }
