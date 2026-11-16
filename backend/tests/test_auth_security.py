"""Unit tests for JWT and refresh-token helpers."""

import uuid

import jwt
import pytest

from app.core.config import clear_settings_cache, get_settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)


@pytest.fixture(autouse=True)
def _jwt_secret(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("JWT_SECRET", "test-secret-key-at-least-32-characters-long!!")
    monkeypatch.setenv("JWT_ISSUER", "cognitif-connexion-foot-v2")
    monkeypatch.setenv("JWT_AUDIENCE", "cognitif-connexion-foot-api")
    clear_settings_cache()
    yield
    clear_settings_cache()


def test_create_and_decode_access_token() -> None:
    user_id = uuid.uuid4()
    token, expires_in = create_access_token(
        user_id=user_id,
        email="coach@example.com",
        roles=["coach"],
        permissions=["sessions.view"],
    )
    assert expires_in > 0
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == "coach@example.com"
    assert payload["roles"] == ["coach"]
    assert payload["type"] == "access"
    assert payload["iss"] == "cognitif-connexion-foot-v2"
    assert payload["aud"] == "cognitif-connexion-foot-api"


def test_decode_rejects_non_access_token() -> None:
    settings = get_settings()
    bad = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "type": "refresh",
            "iss": settings.jwt_issuer,
            "aud": settings.jwt_audience,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(bad)


def test_decode_rejects_wrong_audience() -> None:
    settings = get_settings()
    bad = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "type": "access",
            "iss": settings.jwt_issuer,
            "aud": "wrong-audience",
            "exp": 9999999999,
            "iat": 1,
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(jwt.InvalidTokenError):
        decode_access_token(bad)


def test_refresh_token_hash_is_deterministic() -> None:
    raw, hashed = generate_refresh_token()
    assert hashed == hash_refresh_token(raw)
    assert raw not in hashed
