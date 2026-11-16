# Migration test report

Date: 2026-11-16  
Branch: `master`  
Runner: local Windows + Docker Desktop  
Command:

```bash
cd backend
.\.venv\Scripts\python.exe -m pytest -v tests/test_alembic_migrations.py
```

## Environment

| Item | Value |
|------|-------|
| Python | 3.14.7 (venv) |
| Alembic | 1.20.1 |
| SQLAlchemy | 2.0.57 |
| Postgres image | `postgres:16-alpine` (ephemeral container per test) |
| Neon | **not used** |

## Results

| Test | Result |
|------|--------|
| `test_alembic_upgrade_head_on_empty_database` | **PASSED** |
| `test_alembic_upgrade_matches_orm_table_set` | **PASSED** |
| `test_alembic_downgrade_base_and_reupgrade` | **PASSED** |

Summary: **3 passed** in ~54s.

## Assertions covered

- `alembic upgrade head` on empty DB reaches `20261115_0006`.
- All `V2_TABLES` exist after upgrade.
- `session_status` enum labels = `draft`, `in_progress`, `completed`, `cancelled`.
- `refresh_tokens.family_id` present.
- Players use `first_name` / `last_name` / `primary_position_id` (no `full_name` / `position_id`).
- Teams + `session_name_counters` + `training_sessions.team_id` present.
- ORM table set == DB table set (excluding `alembic_version`).
- `downgrade base` leaves no app tables; re-`upgrade head` succeeds.

## Remaining risks

1. **Pre-existing Neon V2 DB** that applied the old `create_all` `0001` may be in a divergent state — recreate empty V2 or hand-reconcile; do not `stamp`.
2. **Partial unique indexes / checks** present only in migrations (teams name, session counter) are intentional; autogenerate may propose noise.
3. **Enum downgrade** collapses `completed`/`cancelled` → `closed`.
4. **Integration API tests** still need a real V2 URL + seeds; they are separate from this isolated suite.
5. Docker must be available for `test_alembic_migrations.py` (otherwise skipped).
