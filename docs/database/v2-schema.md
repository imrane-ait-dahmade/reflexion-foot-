# Cognitif Connexion Foot V2 — Database Schema

Independent V2 schema. V1 (Drizzle / Better Auth / Neon production) is a **functional reference only**. Do not migrate or share the V1 database.

## Architecture

Modular monolith — ORM models live under each module’s `infrastructure/`:

| Module | Tables |
|--------|--------|
| identity | `users`, `roles`, `permissions`, `user_roles`, `role_permissions`, `refresh_tokens` |
| players | `positions`, `players`, `player_credentials` |
| test_sessions | `training_sessions`, `session_players` |
| cognitive_tests | `cognitive_tests`, `session_exercises` |
| results | `test_attempts`, `test_results` |
| ai_analysis | `ai_reports` |

Shared: enums + seeds + model registry in `backend/app/shared/infrastructure/database/`.

## Identity

- Staff users only (`admin`, `coach`, `staff`). **Players are not staff accounts and do not use this JWT auth.**
- Passwords hashed with **Argon2id** (`app.core.security`).
- RBAC via `roles` + `permissions` + join tables.
- Access JWT (short-lived, `iss`/`aud`/`type=access`) + opaque refresh tokens stored as SHA-256 hashes in `refresh_tokens`.
- Refresh rotation with `family_id` reuse detection (revokes the whole family) and row lock for concurrent refresh.
- Last active administrator cannot be deactivated or demoted.
- Password change: `POST /api/v1/auth/change-password` (authenticated). Forced first-login password change is **not** implemented.
- Bootstrap admin: `python -m app.modules.identity.application.bootstrap` with `BOOTSTRAP_ADMIN_*` env vars.

## Players

- Permanent player identity separate from users.
- Personal access code stored only as `player_credentials.code_hash` (Argon2id).
- At most one active credential per player (`revoked_at IS NULL`).

## Sessions & exercises

- `training_sessions.session_code` unique.
- Players may join many sessions (`session_players` unique on `(session_id, player_id)`).
- Exercises reference catalog `cognitive_tests` (not free-text slugs on the session row).

## Results

- `test_attempts`: **one row per** `(session_player_id, session_exercise_id)`.
- `test_results`: one result per attempt (`attempt_id` unique).
- Metrics payload in `result_data` JSONB.

## AI reports

- Types: `test`, `session`, `progress`, `group`.
- Payload in `report_data` JSONB; optional `model_name`, `prompt_version`.
- Optional FKs to `session_players` and/or `training_sessions`.

## Seeds (reference data)

Defined in `backend/app/shared/infrastructure/database/seeds.py`:

- Roles: admin, coach, staff
- Permissions + default role map
- Positions: GK, CB, LB, RB, CDM, CM, CAM, LW, RW, ST
- Eight cognitive tests from V1 `frontend/lib/tests/registry.ts` (slugs/names/descriptions verified)

## Alembic

- Metadata discovery via `import_all_models()` in `migrations/env.py`.
- Linear chain `20261115_0001` … `0006` (explicit DDL; **no** `create_all` in revisions).
- Apply only to an **empty dedicated V2 database**. Never against V1 Neon.
- Do not call `metadata.create_all()` from the FastAPI app startup.
- Details: [`docs/migrations/ALEMBIC_AUDIT.md`](../migrations/ALEMBIC_AUDIT.md), [`MIGRATION_STRATEGY.md`](../migrations/MIGRATION_STRATEGY.md).
