"""Idempotent seed runner for V2 reference data.

Usage:
  python -m app.shared.infrastructure.database.seed_runner

Does not create users or admin passwords.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.cognitive_tests.infrastructure.models import CognitiveTest
from app.modules.identity.infrastructure.models import Permission, Role, RolePermission
from app.modules.players.infrastructure.models import Position
from app.shared.infrastructure.database.models import import_all_models
from app.shared.infrastructure.database.seeds import (
    COGNITIVE_TEST_SEEDS,
    PERMISSION_SEEDS,
    POSITION_SEEDS,
    ROLE_PERMISSION_MAP,
    ROLE_SEEDS,
)
from app.shared.infrastructure.database.session import (
    dispose_engine,
    get_session_factory,
)


async def seed_all(session: AsyncSession) -> dict[str, int]:
    """Upsert reference rows. Returns counts of newly inserted rows."""
    import_all_models()
    inserted = {
        "roles": 0,
        "permissions": 0,
        "role_permissions": 0,
        "positions": 0,
        "cognitive_tests": 0,
    }

    roles_by_name: dict[str, Role] = {}
    for seed in ROLE_SEEDS:
        existing = await session.scalar(select(Role).where(Role.name == seed.name))
        if existing is None:
            existing = Role(name=seed.name, description=seed.description)
            session.add(existing)
            inserted["roles"] += 1
        else:
            existing.description = seed.description
        roles_by_name[seed.name] = existing

    await session.flush()

    perms_by_code: dict[str, Permission] = {}
    for seed in PERMISSION_SEEDS:
        existing = await session.scalar(select(Permission).where(Permission.code == seed.code))
        if existing is None:
            existing = Permission(code=seed.code, description=seed.description)
            session.add(existing)
            inserted["permissions"] += 1
        else:
            existing.description = seed.description
        perms_by_code[seed.code] = existing

    await session.flush()

    for role_name, codes in ROLE_PERMISSION_MAP.items():
        role = roles_by_name[role_name]
        for code in codes:
            permission = perms_by_code[code]
            existing = await session.scalar(
                select(RolePermission).where(
                    RolePermission.role_id == role.id,
                    RolePermission.permission_id == permission.id,
                )
            )
            if existing is None:
                session.add(RolePermission(role_id=role.id, permission_id=permission.id))
                inserted["role_permissions"] += 1

    for seed in POSITION_SEEDS:
        existing = await session.scalar(select(Position).where(Position.code == seed.code))
        if existing is None:
            session.add(
                Position(
                    code=seed.code,
                    name=seed.name,
                    display_order=seed.display_order,
                    is_active=True,
                )
            )
            inserted["positions"] += 1
        else:
            existing.name = seed.name
            existing.display_order = seed.display_order
            existing.is_active = True

    for seed in COGNITIVE_TEST_SEEDS:
        existing = await session.scalar(
            select(CognitiveTest).where(CognitiveTest.slug == seed.slug)
        )
        if existing is None:
            session.add(
                CognitiveTest(
                    slug=seed.slug,
                    name=seed.name,
                    description=seed.description,
                    category=seed.category,
                    is_active=True,
                    configuration=seed.configuration,
                )
            )
            inserted["cognitive_tests"] += 1
        else:
            existing.name = seed.name
            existing.description = seed.description
            existing.category = seed.category
            existing.is_active = True
            existing.configuration = seed.configuration

    await session.commit()
    return inserted


async def main() -> None:
    factory = get_session_factory()
    session = factory()
    try:
        counts = await seed_all(session)
        # Print only aggregate counts — never secrets.
        print("Seed completed:", counts)
    finally:
        await session.close()
        await dispose_engine()


if __name__ == "__main__":
    asyncio.run(main())
