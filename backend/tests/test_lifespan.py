"""Tests for FastAPI lifespan and health surface (no real DB)."""

from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app


def test_health_omits_database_secrets() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "healthy"
        assert "environment" in payload
        body = response.text.lower()
        assert "database_url" not in body
        assert "password" not in body
        assert "asyncpg" not in body


def test_root_and_health_preserved() -> None:
    with TestClient(app) as client:
        assert client.get("/").status_code == 200
        assert client.get("/health").status_code == 200


def test_lifespan_disposes_engine_on_shutdown() -> None:
    dispose = AsyncMock()
    with patch("app.main.dispose_engine", dispose):
        with TestClient(app):
            pass
        dispose.assert_awaited()
