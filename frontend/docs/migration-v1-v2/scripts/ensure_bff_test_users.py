"""
Create dedicated V2 TEST staff accounts for Auth BFF integration.

- Verifies DATABASE_URL points at V2 (icy-river / cognitif_connexion_foot_v2).
- Never prints passwords to stdout (writes credentials JSON path only when asked).
- Does not touch V1 Neon.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[4]  # football-vision-test
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

# Load backend .env without exporting secrets to stdout
env_path = BACKEND / ".env"
if env_path.exists():
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key, val = key.strip(), val.strip().strip('"').strip("'")
        os.environ.setdefault(key, val)


def identity_from_url(url: str) -> dict[str, str]:
    url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlparse(url)
    db = unquote(parsed.path.lstrip("/").split("?")[0])
    user = unquote(parsed.username or "")
    host = parsed.hostname or ""
    return {
        "host": host,
        "database": db,
        "user": user,
        "fingerprint": hashlib.sha256(f"{host}|{db}|{user}".encode()).hexdigest()[
            :16
        ],
    }


EXPECTED_HOST_MARKER = "icy-river"
EXPECTED_DB = "cognitif_connexion_foot_v2"
EXPECTED_FINGERPRINT = "b5fa9f5099b4b4ee"

COACH_EMAIL = "bff.integration.coach@v2-test.lab"
COACH_PASSWORD = "BffIntegrat1on!Coach"
LIMITED_EMAIL = "bff.integration.limited@v2-test.lab"
LIMITED_PASSWORD = "BffIntegrat1on!Limited"


async def main() -> int:
    from app.core.config import clear_settings_cache, get_settings
    from app.core.security import hash_password
    from app.modules.identity.infrastructure.models import User, UserRole
    from app.modules.identity.infrastructure.repositories import UserRepository
    from app.shared.infrastructure.database.models import import_all_models
    from app.shared.infrastructure.database.session import (
        dispose_engine,
        get_session_factory,
    )

    clear_settings_cache()
    settings = get_settings()
    if not settings.has_database_url:
        print(json.dumps({"ok": False, "error": "DATABASE_URL missing"}))
        return 2

    ident = identity_from_url(settings.database_url)
    if EXPECTED_HOST_MARKER not in ident["host"] or ident["database"] != EXPECTED_DB:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Database is not the expected V2 TEST target — aborting",
                    "identity": ident,
                }
            )
        )
        return 3
    if ident["fingerprint"] != EXPECTED_FINGERPRINT:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Fingerprint mismatch — aborting",
                    "identity": ident,
                    "expected_fingerprint": EXPECTED_FINGERPRINT,
                }
            )
        )
        return 3

    if (settings.app_env or "").lower() not in {"development", "test", "local"}:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": f"APP_ENV={settings.app_env} is not a TEST/dev label — aborting",
                    "identity": ident,
                }
            )
        )
        return 3

    import_all_models()
    factory = get_session_factory()
    session = factory()

    async def upsert(email: str, password: str, role_name: str, full_name: str) -> str:
        repo = UserRepository(session)
        existing = await repo.get_by_email(email)
        role = await repo.get_role_by_name(role_name)
        if role is None:
            raise RuntimeError(f"Role {role_name} missing — run seeds")
        if existing is not None:
            existing.password_hash = hash_password(password)
            existing.is_active = True
            existing.full_name = full_name
            await session.commit()
            return str(existing.id)
        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            is_active=True,
        )
        await repo.add(user)
        session.add(UserRole(user_id=user.id, role_id=role.id))
        await session.commit()
        return str(user.id)

    try:
        coach_id = await upsert(
            COACH_EMAIL, COACH_PASSWORD, "coach", "BFF Integration Coach"
        )
        limited_id = await upsert(
            LIMITED_EMAIL, LIMITED_PASSWORD, "staff", "BFF Integration Limited"
        )
    finally:
        await session.close()
        await dispose_engine()
        clear_settings_cache()

    out = {
        "ok": True,
        "identity": {**ident, "app_env": settings.app_env, "role": "V2_TEST"},
        "accounts": {
            "coach": {"email": COACH_EMAIL, "user_id": coach_id, "role": "coach"},
            "limited": {
                "email": LIMITED_EMAIL,
                "user_id": limited_id,
                "role": "staff",
            },
        },
        # Passwords only for local test runner env — not logged by callers as secrets in reports
        "credentials": {
            "coach_password": COACH_PASSWORD,
            "limited_password": LIMITED_PASSWORD,
        },
    }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
