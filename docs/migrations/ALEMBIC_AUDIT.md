# Alembic audit — Cognitif Connexion Foot V2

Date: 2026-11-16  
Branch: `master`  
Scope: `backend/migrations` + SQLAlchemy models under `backend/app/**/infrastructure/models.py`  
No Neon V1/V2 connections during this audit.

## Findings (before fix)

| Issue | Detail |
|-------|--------|
| `create_all` in `0001` | `Base.metadata.create_all()` created the **current** full ORM schema, including objects later “added” by `0002`–`0006`. |
| Redundant creates | `0002` recreates `refresh_tokens`; `0004` alters columns already present; `0005` recreates teams; `0006` remaps enum already at final values if `0001` used today’s models. |
| Non-reproducible empty DB | `upgrade head` on a fresh DB **failed** once models evolved past the incremental revisions. |
| Enum ownership | ORM enums used `create_type=True`, racing Alembic for type creation. |
| V1 risk | Documented correctly, but a broken V2 chain increased pressure to “stamp” or point at the wrong DB. |

## Model registry

`import_all_models()` registers 23 tables (`V2_TABLES` in `app/shared/infrastructure/database/models.py`):

identity · players · teams · test_sessions · cognitive_tests · results · ai_analysis

## Revision-by-revision (after fix)

| Rev | Role vs models |
|-----|----------------|
| `0001` | Explicit **baseline** DDL only: users/RBAC, positions, players with `full_name` + nullable `position_id`, credentials, sessions with legacy `session_status` (`draft\|active\|closed`), session_players, cognitive_tests, exercises, attempts, results, ai_reports + enums. **No** refresh_tokens / teams / secondary positions / notes / session counters / `team_id`. |
| `0002` | Adds `refresh_tokens` (no `family_id`). |
| `0003` | Adds `family_id` + index; drops server default. |
| `0004` | Players → `first_name`/`last_name`, profile fields, `primary_position_id` NOT NULL, secondary positions, notes. |
| `0005` | `teams`, `team_staff`, `team_players` (+ partial unique indexes). |
| `0006` | Remaps `session_status` → `draft\|in_progress\|completed\|cancelled`, adds `training_sessions.team_id`, `session_name_counters`. |

## Residual differences (acceptable)

- Model `UserRole` / `RolePermission` declare named `UniqueConstraint`s that duplicate the composite PK; DB uses PK only (same uniqueness).
- `teams_active_name_uidx` (`lower(name)` where active) exists in DB via `0005`; not declared on the ORM `Team` class (DB-enforced).
- `session_name_counters_nonneg` check exists in DB via `0006`; not on the ORM class.

These do not block runtime or `upgrade head`.

## Corrective actions taken

1. Rewrote `20261115_0001_v2_initial_schema.py` as explicit DDL (no `create_all`).
2. Set ORM PG enums to `create_type=False`.
3. Minor hardening of `0006` server default for `last_value`.
4. Added isolated Docker Postgres tests + docs under `docs/migrations/`.
