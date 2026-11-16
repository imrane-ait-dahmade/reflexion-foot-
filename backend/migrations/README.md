# Migrations (V2)

Alembic manages the **independent V2** schema.

- Config: `alembic.ini`
- Environment: `migrations/env.py` (`import_all_models()` + `Base.metadata`)
- Initial revision: `versions/20261115_0001_v2_initial_schema.py`

## Rules

- Use a **dedicated V2 Neon / Postgres database** — never the V1 app database.
- Do not run `alembic upgrade` against production V1.
- Do not call `Base.metadata.create_all()` from FastAPI startup.
- Seed reference data from `app.shared.infrastructure.database.seeds` after schema exists.
