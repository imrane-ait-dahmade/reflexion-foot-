"""HMAC challenge tokens — compatible with the former Next.js challenge-token.ts."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from typing import Any

from app.core.config import get_settings


def challenge_seed() -> str:
    return secrets.token_hex(16)


def challenge_secret() -> str:
    settings = get_settings()
    secret = (settings.jwt_secret or "").strip()
    if len(secret) < 32:
        raise RuntimeError("missing_challenge_secret")
    return secret


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    pad = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + pad)


def sign_challenge(payload: dict[str, Any], secret: str) -> str:
    body = _b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
    mac = _b64url_encode(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return f"{body}.{mac}"


def read_challenge(token: str, secret: str) -> dict[str, Any] | None:
    parts = token.split(".")
    if len(parts) != 2:
        return None
    body, mac = parts
    expected = _b64url_encode(
        hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    )
    given = mac.encode("ascii")
    wanted = expected.encode("ascii")
    if len(given) != len(wanted) or not hmac.compare_digest(given, wanted):
        return None
    try:
        return json.loads(_b64url_decode(body).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError):
        return None


def unit_float(secret: str, message: str) -> float:
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    return int.from_bytes(digest[:4], "big") / 0x100000000
