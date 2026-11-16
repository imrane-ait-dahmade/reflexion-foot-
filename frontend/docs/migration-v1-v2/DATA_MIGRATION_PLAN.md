# V1 → V2 Data Migration Plan

**Phase:** 2 — Plan only (no destructive operations)  
**Databases:** V1 Neon (Next/Drizzle) · V2 PostgreSQL (FastAPI/SQLAlchemy/Alembic)  
**Rule:** Never delete V1 Neon before successful migration **and explicit approval**.

## 1. Inventory of V1 data domains

| Domain | V1 table(s) | Notes |
| --- | --- | --- |
| Coach accounts | `users` (role=`coach`) + Better Auth user tables | Linked via `auth_user_id` |
| Player accounts (legacy) | `users` (role=`player`) | Rare; V1 join is mostly anonymous `display_name` |
| Training sessions | `training_sessions` | code, status, coach_id, ends_at, archived_at |
| Session exercises | `session_exercises` | test_slug + sort_order |
| Session participants | `session_players` | display_name; optional user_id |
| Results | `test_results` | score/accuracy/metrics keyed by session_player + slug |
| AI reports | `ai_reports` | test/session/progress/group + JSONB |

V1 does **not** have first-class roster `players`, `teams`, positions, or import codes. Those exist only in V2 (and may already contain TEST data from API tests / Players V2).

## 2. What already exists in FastAPI PostgreSQL

| V2 table / concept | Status | Overlap with V1 |
| --- | --- | --- |
| `users` + roles/permissions | Seeded + staff users | Different identity model than Better Auth |
| `players`, positions, credentials, notes | Live (Players V2) | **No 1:1 V1 roster** to import |
| `teams`, `team_players`, `team_staff` | Live | No V1 equivalent |
| `training_sessions`, `session_players`, `session_exercises` | Schema + APIs | Parallel to V1; **different FKs** |
| `test_attempts`, `test_results` | Schema; write via player complete | Shape differs from V1 |
| `ai_reports` | Schema only (no HTTP) | Similar JSONB intent |
| Cognitive test catalogue | Seeded | Maps to V1 `test_slug` enum |

**Assumption to verify with counts before ETL:** V1 Neon and V2 Postgres are **separate** databases. Do not treat them as the same Neon project.

## 3. Entity mapping strategy

### 3.1 Coaches / staff

| V1 | V2 | Strategy |
| --- | --- | --- |
| Better Auth user + `users` coach row | `users` + `user_roles` (admin/coach/staff) | Map by **email** (unique). Create FastAPI staff user if missing; store `v1_user_id` / `better_auth_id` in a one-time migration table or JSON note. **Do not copy password hashes** across frameworks — issue password-reset / bootstrap set. |
| Role `coach` | Role `coach` (or `admin` if platform) | Explicit role assignment via existing RBAC |

### 3.2 Session participants → Players

| V1 | V2 | Strategy |
| --- | --- | --- |
| `session_players.display_name` | `players` (+ credential) | **Synthetic player per distinct identity** within a coach’s history: key = `lower(trim(display_name))` + coach scope. Generate access codes. Flag `migrated_from_v1=true` in notes or a staging table. |
| Optional `session_players.user_id` | `players` | If linked V1 player user has email, prefer email match |

**Risk:** Display-name collisions. Mitigation: include session code + joined_at in disambiguation; prefer human review for high-collision names.

### 3.3 Sessions

| V1 field | V2 field | Notes |
| --- | --- | --- |
| `id` | `id` | Prefer **preserve UUID** if no collision |
| `code` | `session_code` | Preserve if unique in V2 |
| `coach_id` | `created_by` | After coach user map |
| `title` | `title` | Direct |
| `status` draft/active/closed | draft / active-like / completed | Map `closed` → `completed` (confirm enum); `archived_at` → `archived_at` |
| `starts_at` / `ends_at` | `scheduled_at` (+ optional derived) | Store ends_at into `report_data`/metadata if no column |
| `team_id` | `team_id` | Null unless coach chooses a default team |

### 3.4 Session exercises

| V1 | V2 |
| --- | --- |
| `test_slug` | Resolve `cognitive_tests.id` by slug, then `session_exercises` |
| `sort_order` | Preserve |

### 3.5 Session players

| V1 | V2 |
| --- | --- |
| `session_players.id` | Prefer preserve UUID |
| `display_name` | Via linked `player_id` |
| — | `status` default `joined` |

### 3.6 Results

| V1 `test_results` | V2 |
| --- | --- |
| One row per (session_player, slug) | Create `test_attempts` (completed) + `test_results` |
| `score`, `accuracy` | Direct |
| `average_reaction_ms` / metrics | Map into `response_time_ms` + `result_data` JSONB (preserve full V1 metrics blob) |
| `test_slug` | Via session_exercise FK |

### 3.7 AI reports

| V1 | V2 |
| --- | --- |
| `report_type`, `report_data`, model, prompt_version | Map into `ai_reports` |
| status machine (pending/failed/…) | V2 model is thinner — store status inside `report_data` if needed |
| HTTP | **Blocked** until FastAPI AI router exists; DB load can still proceed |

## 4. Reconciliation & validation

### Pre-migration counts (run on both DBs)

```text
V1: users_by_role, sessions_by_status, session_players, test_results, ai_reports
V2: users, players, training_sessions, session_players, test_attempts, test_results, ai_reports
```

### Post-migration checks

1. Row counts: V1 historical rows ≤ V2 migrated + intentional skips (logged).  
2. FK integrity: every session has valid `created_by`; every session_player has player; every result has attempt + exercise.  
3. Uniqueness: session codes, player emails (if any), attempt uniqueness.  
4. Spot-check: N random sessions — exercises, participants, scores match.  
5. Coach ownership: sessions only visible to mapped staff user.  
6. Idempotency: re-run migration inserts 0 new rows (staging keys).

### Duplicate policy

- Coaches: email unique → update map, do not duplicate.  
- Players: email if present; else synthetic key.  
- Sessions: preserve UUID; skip if UUID already in V2.  
- Results: skip if attempt already exists for (session_player, session_exercise).

## 5. ETL approach (recommended)

1. **Read-only** V1 Neon snapshot / backup.  
2. Create staging schema on V2 (or temporary tables): `mig_v1_*` with source IDs.  
3. Ordered load: staff users → players → sessions → session_exercises → session_players → attempts/results → ai_reports.  
4. Write `mig_id_map(source_table, source_id, target_id)`.  
5. Dry-run on a **clone** of V2 TEST first.  
6. Production cutover only after sign-off.

Implementation home: FastAPI ops scripts / one-off Alembic data migration — **not** Next.js. Do not invent runtime APIs for ETL.

## 6. Backups & rollback

### Before any write

| Asset | Action |
| --- | --- |
| V1 Neon | Verified logical backup / branch / point-in-time restore documented |
| V2 Postgres | Snapshot / Neon branch / `pg_dump` of schema+data |
| Checksums | Store pre-count report in `docs/migration-v1-v2/runs/<date>/` |

### Rollback

1. Prefer **V2 restore from snapshot** (fastest).  
2. Or delete rows listed in `mig_id_map` for that run_id (only if no new prod activity).  
3. V1 remains untouched until final approval — primary rollback for product is “keep serving V1 Next routes”.

### Never

- Drop V1 Neon.  
- Drop V1 schemas.  
- Point Next `DATABASE_URL` at V2.  
- Delete Better Auth users before auth cutover.

## 7. What cannot be migrated yet / needs product decisions

| Item | Decision needed |
| --- | --- |
| Anonymous display-name players | Auto-create Players vs keep session-only ghost identities |
| Password continuity | Force reset vs temporary passwords |
| Session UX semantics | Keep V1 join/code UX vs adopt V2 personal_code |
| AI reports usability | Migrate JSON now vs wait for FastAPI AI API |
| Historical TEST noise in V2 | Optional purge of API-test fixtures before prod load |

## 8. Success criteria for Phase 2 closure

- [ ] Dual-DB count report captured  
- [ ] Mapping tables designed  
- [ ] Dry-run on TEST clone succeeds with validation checklist  
- [ ] Rollback drill documented  
- [ ] Explicit approval recorded before any production ETL  

## 9. Checkpoint

**Phase 2 plan delivered.** No data moved.

**Blocked for later phases until approval:**

- Phase 3 — Auth BFF (httpOnly cookies; retire localStorage JWT)  
- Phase 4 — Centralized BFF proxy  
- Phase 5 — Feature cutover  
- Phase 6 — Remove Neon/Drizzle/Better Auth  

**Request:** Approve Phase 2 dry-run on a TEST clone, and prioritize which FastAPI gaps to build first (dashboard/results vs AI vs challenges vs auth BFF).
