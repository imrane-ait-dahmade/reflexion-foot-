"""Secure initial admin creation (CLI / ops only).

Creates an admin staff user only when no admin exists yet.
Credentials come from environment variables — never hardcode passwords.
"""

from __future__ import annotations

import asyncio
import sys

from app.core.config import clear_settings_cache, get_settings
from app.core.security import hash_password
from app.modules.identity.infrastructure.models import User, UserRole
from app.modules.identity.infrastructure.repositories import UserRepository
from app.shared.infrastructure.database.models import import_all_models
from app.shared.infrastructure.database.session import (
    dispose_engine,
    get_session_factory,
)


async def bootstrap_admin() -> str:
    """Return a short status message (no secrets)."""
    import_all_models()
    clear_settings_cache()
    settings = get_settings()
    email = settings.bootstrap_admin_email.strip().lower()
    password = settings.bootstrap_admin_password
    full_name = settings.bootstrap_admin_full_name.strip() or "Platform Admin"

    if not email or not password:
        raise RuntimeError(
            "BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set.",
        )
    if len(password) < 8:
        raise RuntimeError("BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.")

    factory = get_session_factory()
    session = factory()
    try:
        repo = UserRepository(session)
        existing_admins = await repo.count_users_with_role("admin")
        if existing_admins > 0:
            return "Admin already exists — bootstrap skipped."

        if await repo.get_by_email(email) is not None:
            raise RuntimeError("Bootstrap email already exists as a non-admin user.")

        admin_role = await repo.get_role_by_name("admin")
        if admin_role is None:
            raise RuntimeError("Role 'admin' is missing — run seeds first.")

        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            is_active=True,
        )
        await repo.add(user)
        session.add(UserRole(user_id=user.id, role_id=admin_role.id))
        await session.commit()
        return f"Admin created for email domain/local-part length={len(email)}."
    finally:
        await session.close()
        await dispose_engine()


def main() -> None:
    try:
        message = asyncio.run(bootstrap_admin())
    except Exception as exc:
        print(f"Bootstrap failed: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    print(message)


if __name__ == "__main__":
    main()
