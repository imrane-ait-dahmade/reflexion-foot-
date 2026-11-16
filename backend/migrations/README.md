# Migrations

Alembic is configured for future SQLAlchemy migrations.

- Config: `alembic.ini` (project root)
- Environment: `migrations/env.py` (uses `Base.metadata` + `DATABASE_URL`)
- Revisions: `migrations/versions/` (empty until V1 Drizzle schema is inspected)

## Rules

- Do not invent business tables or player models yet.
- Do not generate revisions until the V1 Drizzle schema is reviewed.
- Do not run `alembic upgrade` against production without an explicit plan.
- Keep credentials in `.env` / environment only — never in `alembic.ini`.
