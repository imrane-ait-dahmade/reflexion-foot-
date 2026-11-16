# Alembic — Cognitif Connexion Foot V2

## Rules

- Target: **dedicated V2 PostgreSQL only** (Neon V2 test or future RDS `cognitif_v2`).
- **Never** run against V1 Drizzle / Better Auth Neon.
- Do **not** call `Base.metadata.create_all()` from FastAPI startup or from revisions.
- Do **not** use `alembic stamp` to hide failed upgrades on empty DBs.

## Chain (linear)

| Revision | Purpose |
|----------|---------|
| `20261115_0001` | Explicit baseline DDL (identity, players `full_name`, sessions with old `session_status`, catalog, results, AI) |
| `20261115_0002` | `refresh_tokens` |
| `20261115_0003` | `refresh_tokens.family_id` |
| `20261115_0004` | Players reshape + secondary positions + notes |
| `20261115_0005` | Teams / staff / player memberships |
| `20261115_0006` | Session status remap + `team_id` + name counters |

## Commands

From `backend/` with `DATABASE_URL` pointing at an **empty** V2 database:

```bash
alembic upgrade head
alembic current
alembic downgrade -1   # optional
```

Isolated tests (Docker Postgres, no Neon):

```bash
pytest -v tests/test_alembic_migrations.py
```

See `docs/migrations/` for audit, strategy, and test report.
