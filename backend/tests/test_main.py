"""Minimal smoke tests for the FastAPI foundation."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_app_imports() -> None:
    assert app.title == "Cognitif Connexion Foot 2.0"


def test_root_returns_200_and_expected_fields() -> None:
    response = client.get("/")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "Cognitif Connexion Foot 2.0" in payload["message"]


def test_health_returns_200_and_expected_fields() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "healthy"
    assert payload["service"] == "cognitif-connexion-foot-api"


def test_openapi_docs_available() -> None:
    assert client.get("/docs").status_code == 200
    assert client.get("/redoc").status_code == 200
    assert client.get("/openapi.json").status_code == 200
