# V1 → V2 Data Migration — TEST Dry-Run Report

**Stamp:** `20261115T215523Z`  
**Mode:** READ-ONLY simulation (`writes_performed: false`)  
**Artifacts:** `runs/20261115T215523Z/{inventory_backup.json,dry_run.json}`  
**Script:** `scripts/dry_run_simulate.py`

> This is **not** a successful migration claim. It is a reconciliation simulation with evidence. No V1 or V2 rows were inserted, updated, or deleted.

---

## 1. Database identity verification

| Role | Host (pooler) | Database | User | Fingerprint |
| --- | --- | --- | --- | --- |
| **Source V1 Neon** | `ep-silent-sunset-b9gxjxnx-pooler…eu-central-1` | `neondb` | `neondb_owner` | `eed74849c9417ea9` |
| **Target V2 Postgres** | `ep-icy-river-b9e1499d-pooler…eu-central-1` | `cognitif_connexion_foot_v2` | `cognitif_connexion_foot_v2_owner` | `b5fa9f5099b4b4ee` |

- **Identities distinct:** `true` (different host + database + user fingerprints).
- **Target env:** `APP_ENV=development` — treated as TEST/dev for this run.
- **Stop rule:** Identities positively identified; simulation continued.
- **Note:** No dedicated Neon branch clone was created in this run. Target is the existing V2 development database. Prefer a Neon branch/PITR snapshot before any future **write** ETL.

---

## 2. Backups

| Artifact | Purpose |
| --- | --- |
| `inventory_backup.json` | Logical pre-run inventory (counts + identities) |
| Neon PITR / branch | **Not taken this run** — required before write ETL |

Logical inventory only — not a full `pg_dump`. V1 remains untouched source of truth.

---

## 3. Source record counts (V1)

| Entity | Count |
| --- | --- |
| Users (total) | 8 |
| Users (coach) | 8 |
| Users (player) | 0 |
| Training sessions | 25 |
| Session exercises | 68 |
| Session players | 22 |
| Test results | 78 |
| AI reports | 16 |

---

## 4. Existing target counts (V2)

| Entity | Count |
| --- | --- |
| Users | 181 |
| Players | 108 |
| Teams | 32 |
| Training sessions | 42 |
| Session exercises | 42 |
| Session players | 43 |
| Test attempts | 15 |
| Test results | 12 |
| AI reports | 0 |
| Positions | 10 |
| Cognitive tests | 8 |

---

## 5. Identity & relationship mappings (simulated)

### Coaches → V2 staff users

| Metric | Value |
| --- | --- |
| Matched existing by email | **0** |
| To create (no password copy) | **8** |
| Passwords / Better Auth hashes copied | **false** |

All eight V1 coaches would be created as staff accounts **without** copying passwords or Better Auth credential hashes. Password reset / invite flow required at write time.

### Players (synthetic from session_players)

V1 has **0** dedicated player users. Identities are synthesized from `(coach_id, normalized display name)`:

| Metric | Value |
| --- | --- |
| Synthetic identities | **17** |
| V1 session_player rows covered | 22 |
| Name collisions with existing V2 players | **0** |
| Multi-session shared identities | **3** |
| Writes | **false** |

No silent duplicates: each synth key is unique; collisions with V2 would have been flagged (`player_name_collisions_with_v2: 0`).

### Sessions

| Metric | Value |
| --- | --- |
| Sessions simulated | 25 |
| Action | `insert_preserve_uuid` |
| Status map | `draft→draft`, `active→in_progress`, `closed→completed` |
| UUID collisions vs V2 | **0** |
| Session code collisions vs V2 | **0** |

### Results → attempts + results

| Metric | Value |
| --- | --- |
| Results migratable | 78 |
| Results skipped | 0 |
| Catalogue slug coverage (sampled) | all sample slugs in catalogue |
| Action | `create_attempt_and_result` |

### AI reports

| Metric | Value |
| --- | --- |
| Reports | 16 |
| Action | `load_json_only_http_blocked` |

JSON payloads are loadable for migration planning; HTTP-blocked / external content is not fetched in this dry-run.

---

## 6. Duplicate & missing-relationship detection

| Check | Result |
| --- | --- |
| V1 coach duplicate emails | none |
| Session UUID collisions | 0 |
| Session code collisions | 0 |
| Player name collisions with V2 | 0 |
| Missing relationships | **[]** (empty) |

---

## 7. Validation summary

| Check | Evidence |
| --- | --- |
| UUIDs preservable (sessions) | 25 / 25 |
| Session codes unique vs V2 | yes (0 collisions) |
| Foreign-key plan | coach → session → session_player → result/report via mapped IDs |
| Passwords copied | **false** |
| Writes performed | **false** |
| V1 untouched | **true** |

---

## 8. Rollback procedures

| Scenario | Action |
| --- | --- |
| **This dry-run** | N/A — no writes; nothing to roll back |
| **Future write ETL (approval required)** | 1) Restore V2 from Neon branch / PITR taken immediately before write. 2) Re-run inventory counts. 3) V1 remains read-only; never roll “forward” by mutating V1. |
| **Partial write failure** | Abort; restore V2 snapshot; do not retry without new approval and fresh inventory |

---

## 9. Strict rules compliance

| Rule | Status |
| --- | --- |
| Never modify production data | Observed (dev/TEST target; SELECT only) |
| Never delete/update V1 Neon | Observed |
| Never execute destructive SQL | Observed |
| Never perform production ETL | Observed |
| Stop if identities unknown | Identities verified; continued |
| Do not copy passwords / BA hashes | Observed |
| Do not silently create duplicate players | Collision checks; 0 name collisions |
| Do not claim success without reconciliation | **Simulation only** — see evidence files |

---

## 10. Verdict & next approval gates

**Verdict:** Dry-run **completed successfully as a simulation**. Mapping is coherent; no blocking collisions found. **Migration writes are NOT approved by this report.**

**Request explicit approval before:**

1. Creating a dedicated V2 Neon TEST branch + PITR snapshot  
2. Any write ETL (INSERT) into that branch  
3. Production-impacting database operations  

**Track A (Auth BFF)** proceeds in parallel without data cutover — see `AUTH_BFF_PREP.md` and updated `CHECKPOINT.md`.
