# Migration strategy — V2 PostgreSQL

## Principles

1. **One dedicated V2 database** (Neon V2 test now; RDS `cognitif_v2` later).
2. **Never** migrate V1 (Better Auth / Drizzle).
3. **Linear Alembic chain** with explicit DDL — no `metadata.create_all()` in revisions.
4. **Empty DB → `alembic upgrade head`** must be reproducible.
5. **No `stamp head`** to paper over failures; fix revisions or recreate the empty V2 DB.
6. ORM enums: `create_type=False`; types owned by Alembic.

## Target databases

| Environment | Engine | Database |
|-------------|--------|----------|
| Local / CI migration tests | Docker `postgres:16` | ephemeral |
| Dev / staging test | Neon V2 | dedicated project/DB |
| Future AWS staging | RDS PostgreSQL | logical DB `cognitif_v2` |

Frontend V1 keeps its own URL (`FRONTEND_DATABASE_URL` / Neon V1). Backend uses `BACKEND_DATABASE_URL` / `DATABASE_URL` only.

## Applying on a new V2 database

```bash
cd backend
# DATABASE_URL=postgresql+asyncpg://.../cognitif_v2?ssl=require
alembic upgrade head
python -m app.shared.infrastructure.database.seed_runner
# optional: python -m app.modules.identity.application.bootstrap
```

## If an old broken chain was partially applied

If a previous run used `create_all` in `0001` and later revisions failed:

1. **Do not** point at V1.
2. Prefer **drop and recreate** the empty V2 database (dev/test only).
3. Re-run `alembic upgrade head` with the fixed chain.
4. Production data: take a logical dump first; do not use this doc as a destructive prod runbook without a restore plan.

## Adding future revisions

```bash
# After model changes
alembic revision -m "describe_change"
# Edit the file: explicit op.create_*/alter_*; never create_all
alembic upgrade head
pytest -v tests/test_alembic_migrations.py tests/test_v2_models.py
```

Prefer additive migrations. Destructive changes need an explicit data backfill step (as in `0004`).

## Downgrade policy

- Supported for the current chain (`base` ↔ `head`) on empty/dev DBs.
- Downgrades that remap enums (`0006`) can lose distinctions (`cancelled` → `closed`).
- Do not downgrade production without a backup.

## CI recommendation

Run `tests/test_alembic_migrations.py` on every push to `master` (Docker Postgres service or DinD). Keep Neon credentials out of that job.
