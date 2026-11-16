# Exercise Configuration Architecture (Audit Only)

**Status:** Documentation / architecture proposal  
**Scope:** Cognitif Connexion Foot V2 — prepare for future per-session exercise configuration  
**Constraints honored:** No migrations, API changes, frontend changes, coach UI, or `config.ts` behavior changes in this phase.

---

## 1. Current state summary

| Layer | Behavior today |
| --- | --- |
| Coach UX | Selects **which** exercises and **order** only (`CreateSessionDialog`, FastAPI `exercise_ids`) |
| Engine parameters | Hardcoded in frontend `lib/tests/*/config.ts` (and related modules) |
| `cognitive_tests.configuration` | JSONB, seeded as `{}`, **not** exposed in `CognitiveTestResponse` |
| `session_exercises.configuration` | JSONB default `{}`, **not** set on create/replace, **not** in API schemas |
| Player challenge APIs | Start/complete attempt; no configuration payload |
| Historical attempts | `test_attempts` has no configuration column; `test_results.result_data` holds metrics only |

**Implication:** Effective difficulty is entirely client/engine constants. Two sessions with the same exercise list are indistinguishable by configuration.

---

## 2. Audit of all eight exercises

Sources: `lib/tests/registry.ts`, per-exercise `config.ts` / engines, seeds in `backend/.../seeds.py`.

### 2.1 Parameter inventory

#### A. `visual-tracking` — Suivi de numéros

| Parameter | Current value | Category |
| --- | --- | --- |
| `itemCount` | 30 | Default / potentially coach |
| `minNumber` / `maxNumber` | 10–99 | Internal |
| `durationMs` | 30_000 | Coach-configurable candidate |
| `itemSize` | 44 px | Internal / presentation |
| `minSpeed` / `maxSpeed` | 0.12–0.25 (fraction of area/s) | Coach-configurable candidate (as “speed band”) |
| `maxFrameDeltaMs` | 50 | Internal engine |
| `spawnAttempts` | 40 | Internal engine |
| Scoring weights / goals | see `VISUAL_TRACKING_SCORING` | Internal scoring (not coach) |
| Adaptive difficulty | **None** (fixed for full attempt) | — |

#### B. `visual-memory` — Mémoire visuelle

| Parameter | Current value | Category |
| --- | --- | --- |
| `gridColumns` × `gridRows` | 5 × 5 | Default (coach only with care) |
| `targetsPerRound` | 5 | Coach-configurable candidate |
| `memorizeMs` | 1_500 | Coach-configurable candidate |
| `durationMs` | 30_000 | Coach-configurable candidate |
| Scoring | `VISUAL_MEMORY_SCORING` | Internal |
| Adaptive | **None** (rounds repeat until timer) | — |

#### C. `reaction-time` — Temps de réaction

| Parameter | Current value | Category |
| --- | --- | --- |
| `attempts` | 10 | Coach-configurable candidate |
| `minDelayMs` / `maxDelayMs` | 1_500–4_000 | Coach-configurable candidate |
| `tooEarlyMs` | 1_000 | Internal UX |
| Scoring | `REACTION_TIME_SCORING` | Internal |
| Adaptive | **None** | — |

#### D. `peripheral-vision` — Vision périphérique

| Parameter | Current value | Category |
| --- | --- | --- |
| `durationMs` | 30_000 | Coach-configurable candidate |
| `minIntervalMs` / `maxIntervalMs` | 800–1_800 | Coach-configurable candidate |
| `stimulusVisibleMs` | 500 | Coach-configurable candidate |
| Position set | 6 fixed peripheral slots | Internal |
| Scoring | `PERIPHERAL_VISION_SCORING` | Internal |
| Adaptive | **None** | — |

#### E. `football-visual-scanning` — Lecture du jeu

| Parameter | Current value | Category |
| --- | --- | --- |
| Sequence pack | `sequences.json` — **9** fixed sequences | Content catalog / internal |
| Challenge types | `closest` \| `defender` \| `free` | Content |
| `SCANNING_LIMIT_MS` | 12_000 per question | Coach-configurable candidate |
| Pitch metrics | 105×68 m | Internal |
| Adaptive | **None** (linear through pack) | — |

#### F. `sequential-visual-search` — Recherche visuelle séquentielle

| Parameter | Current value | Category |
| --- | --- | --- |
| `SEQUENTIAL_TOTAL` | 50 | Coach-configurable candidate (subset end number) |
| Layout rings/radii | fixed geometry | Internal |
| Shuffle seed | session-derived | Runtime / internal |
| Time limit | **None** (untimed completion) | Possible future coach option |
| Adaptive | **None** | — |

#### G. `digit-memory` — Mémoire numérique séquentielle

| Parameter | Current value | Category |
| --- | --- | --- |
| `DIGIT_LEVELS` | `[3,4,5,6,7,8,9,10]` | Ladder definition (coach may pick start/max) |
| Start level | always `1` | Coach-configurable candidate (`startLevel`) |
| Advance rule | exact match → next length; fail → end | Adaptive **runtime** |
| `DIGIT_VISIBLE_MS` | 800 | Coach-configurable candidate |
| `DIGIT_GAP_MS` | 300 | Declared; **unused in engine today** (see Unknowns) |
| Adaptive | **Yes** — length increases only on success; attempt ends on first miss or max level | Runtime, not coach “initial difficulty” alone |

#### H. `dual-target-tracking` — Suivi de deux cibles mobiles

| Parameter | Current value | Category |
| --- | --- | --- |
| `DUAL_LEVELS` | 5 steps: objects 6→14, duration 5–12s, speed 0.12→0.22 | Ladder |
| Start level | always `1` | Coach-configurable candidate |
| Progression | **Always advances through all levels** (success tracked via `difficultyLevelReached`) | Progressive ladder (not stop-on-fail) |
| `DUAL_HIGHLIGHT_MS` | 2_000 | Coach-configurable candidate |
| `ORB_RADIUS` | 0.045 | Internal |
| Adaptive vs coach | Level **hardness** increases by design; coach may later set start level / subset of ladder — distinct from mid-run metrics | — |

### 2.2 Category definitions (used below)

| Category | Meaning |
| --- | --- |
| **Default configuration** | Platform defaults (today: frontend constants; future: also `cognitive_tests.configuration`) |
| **Coach-configurable** | Safe knobs exposed in session setup after validation |
| **Internal engine** | Must stay server/engine-owned (scoring weights, spawn physics, layout geometry, content packs) |
| **Adaptive runtime** | Values that change **during** an attempt based on performance; never stored as coach “settings” alone |

---

## 3. Proposed typed configuration model

### 3.1 Envelope (all exercises)

```ts
type ExerciseConfigEnvelope<T extends string, P> = {
  schema_version: 1;
  slug: T;
  // Coach-facing + resolved defaults only — never scoring weights or secrets
  params: P;
};
```

Rules:

- Unknown keys → **reject** (no arbitrary JSON).
- Missing keys → fill from defaults (treat `{}` as “all defaults”).
- `schema_version` required once non-empty configs exist; `{}` implies “legacy empty → resolve to v1 defaults”.

### 3.2 Per-exercise schemas (proposed)

#### `visual-tracking`

```ts
type VisualTrackingParams = {
  durationMs: number;      // default 30000; range 15000–90000; step 5000
  itemCount: number;       // default 30; range 10–50
  speedPreset: "slow" | "standard" | "fast"; // maps to min/maxSpeed bands
};
```

Example effective JSON:

```json
{
  "schema_version": 1,
  "slug": "visual-tracking",
  "params": {
    "durationMs": 30000,
    "itemCount": 30,
    "speedPreset": "standard"
  }
}
```

Internal (not in coach JSON): `itemSize`, `spawnAttempts`, `maxFrameDeltaMs`, number range, scoring.

#### `visual-memory`

```ts
type VisualMemoryParams = {
  durationMs: number;       // 15000–90000; default 30000
  memorizeMs: number;       // 800–4000; default 1500
  targetsPerRound: number;  // 3–8; default 5
  // grid fixed 5×5 initially (changing grid is a breaking UX change)
};
```

#### `reaction-time`

```ts
type ReactionTimeParams = {
  attempts: number;     // 5–20; default 10
  minDelayMs: number;   // 800–3000; default 1500
  maxDelayMs: number;   // >= minDelayMs + 500; max 8000; default 4000
};
```

#### `peripheral-vision`

```ts
type PeripheralVisionParams = {
  durationMs: number;          // 15000–90000; default 30000
  minIntervalMs: number;       // 400–2000; default 800
  maxIntervalMs: number;       // >= min+200; max 4000; default 1800
  stimulusVisibleMs: number;   // 250–1000; default 500
};
```

#### `football-visual-scanning`

```ts
type FootballVisualScanningParams = {
  questionLimitMs: number;           // 5000–20000; default 12000
  sequencePackId: "metrica-sample-v1"; // locked until more packs exist
  // optional later: challengeFilter: ChallengeType[]
};
```

#### `sequential-visual-search`

```ts
type SequentialVisualSearchParams = {
  totalNumbers: number;  // 20 | 30 | 40 | 50; default 50
  // layout geometry stays internal
};
```

#### `digit-memory`

```ts
type DigitMemoryParams = {
  startLevel: number;          // 1–8; default 1 (index into DIGIT_LEVELS)
  maxLevel: number;            // >= startLevel; default 8
  digitVisibleMs: number;      // 400–1500; default 800
  stopOnFirstError: boolean;   // default true (current behavior)
  // lengths array remains platform default unless a future “custom ladder” feature is approved
};
```

Adaptive runtime (not coach fields): current `level`, `phase`, digits shown — live in challenge token only.

#### `dual-target-tracking`

```ts
type DualTargetTrackingParams = {
  startLevel: number;       // 1–5; default 1
  maxLevel: number;         // >= start; default 5
  highlightMs: number;      // 1000–4000; default 2000
  // per-level objects/duration/speed remain platform ladder unless extended later
};
```

Runtime: current level, movement timers, `difficultyLevelReached` — attempt metrics, not configuration.

---

## 4. Default / override resolution

```
effective = deepMerge(
  PLATFORM_CODE_DEFAULTS[slug],          // today’s config.ts values (source of truth until migrated)
  cognitive_tests.configuration[slug], // optional global overrides (catalog)
  session_exercises.configuration      // session overrides (wins)
)
→ validate(slug, effective)
→ persist validated effective on session_exercises (recommended)
→ snapshot same effective onto attempt at start
```

Principles:

1. **Session overrides exercise (catalog) defaults.**  
2. Empty `{}` at any layer means “no override”.  
3. Resolution is **server-side only**; clients receive the **validated effective** config for playback.  
4. Never accept client-authored configuration on result submit without re-checking against the attempt snapshot.

---

## 5. Where each JSONB should live

### 5.1 `cognitive_tests.configuration` — global defaults?

**Recommendation: YES, as optional catalog defaults / feature flags for the test type.**

| Role | Guidance |
| --- | --- |
| Hold | Default coach-facing params for that slug (`schema_version` + `params`) |
| Not hold | Scoring formulas, secrets, per-session choices |
| Today | Keep `{}` → engines keep using code defaults (backward compatible) |
| Later | Seed non-empty defaults **matching** current `config.ts` so DB and code agree |

Catalog defaults let ops tune platform baselines without redeploying every constant; code defaults remain the fallback and the regression baseline.

### 5.2 `session_exercises.configuration` — effective session config

**Recommendation: store the coach override patch *or* the fully resolved effective object.**

Preferred for clarity and auditability:

- On session create/update: accept **coach patch** (partial params).  
- Backend merges + validates.  
- Persist **`effective` full envelope** on `session_exercises.configuration` (not the raw patch alone).  

That way play, reporting, and support always read one row.

Compatibility: existing rows with `{}` resolve at read-time to code/catalog defaults until backfilled.

### 5.3 Attempt historical snapshot

`test_attempts` currently has **no** configuration column.

**Recommendation (future migration — not in this phase):**

Add `test_attempts.configuration_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb`.

| When | Action |
| --- | --- |
| Attempt `start` | Copy **effective** `session_exercises.configuration` (after resolve) into snapshot |
| Attempt `complete` | Do not overwrite snapshot |
| Result presentation / AI | Read snapshot for “under what settings was this score earned?” |

Fallback until column exists: embed `configurationSnapshot` inside `test_results.result_data` at complete time (weaker — missing if abandoned mid-attempt). Prefer attempt-level column.

**Do not** treat adaptive mid-run state as configuration snapshot; optionally store `runtime_summary` (e.g. `difficultyLevelReached`, `levelsCompleted`) in `result_data` as today.

---

## 6. Backend validation strategy

1. **Discriminated union by slug** (Pydantic models per exercise; reject extra fields).  
2. **Range / enum checks** as in §3.  
3. **Cross-field rules** (e.g. `maxDelayMs >= minDelayMs + 500`, `maxLevel >= startLevel`).  
4. **Allowlist only** — no free-form nested JSON.  
5. **Resolve then validate** so partial patches cannot leave illegal combinations.  
6. **Playback API** returns server effective config; challenge engines (when on FastAPI) must use snapshot, not client body.  
7. **Submit path** ignores client config; scores verified with snapshot + engine rules.

Trust boundary: coach UI is untrusted; only authenticated staff may set session config; players never set it.

---

## 7. Compatibility and migration considerations

| Topic | Approach |
| --- | --- |
| Existing `{}` | Valid forever → resolve to current hardcoded defaults |
| Historical results | Without snapshots, assume “platform defaults as of attempt date” (document uncertainty) |
| Seeding catalog | Optional later: fill `cognitive_tests.configuration` with v1 envelopes matching today’s constants |
| Frontend `config.ts` | Remain behavioral source until engines read server config; **no change in this phase** |
| Scoring weights | Stay out of coach config to preserve score comparability |
| Content packs (scanning) | Version with `sequencePackId`; changing pack is a new id, not silent mutation |
| Adaptive vs initial difficulty | Document in UI copy when implemented; store initial knobs in config, outcomes in metrics |

---

## 8. Implementation roadmap (future — not started)

| Phase | Work | Touches |
| --- | --- | --- |
| **0 — This doc** | Architecture audit | Docs only |
| **1 — Contracts** | Shared TypeScript + Pydantic schemas; unit tests for merge/validate; `{}` compatibility | Backend + shared types (no UI) |
| **2 — Persistence** | Resolve+store effective on session create/replace; expose read-only config on session/player exercise DTOs | API (Track B adjacent) |
| **3 — Snapshot** | `configuration_snapshot` on `test_attempts` at start | Migration + attempt start |
| **4 — Engine consumption** | Challenge engines / client players consume server effective config | Frontend engines + FastAPI (Track D) |
| **5 — Coach UX** | Per-exercise knobs on session create | New UI (separate approval) |
| **6 — Catalog defaults** | Populate/maintain `cognitive_tests.configuration` | Seeds / admin |

**Out of scope for Track B:** coach configuration screens and engine rewrites. Track B may later *expose* read-only configuration fields if schemas exist; writing knobs is a dedicated follow-on.

---

## 9. Unknowns / open questions

1. **`DIGIT_GAP_MS` (300)** is exported but unused by presentation/engine — clarify intended gap vs `DIGIT_VISIBLE_MS` before exposing to coaches.  
2. **Dual-target progression** always runs all levels; product may want stop-on-fail like digit-memory — needs product decision before a `stopOnFirstError`-style flag.  
3. **Sequential search** has no duration limit today; whether coaches should set a time cap is undecided.  
4. **Football scanning** pack is a single static JSON (9 items); multi-pack strategy and licensing constraints unknown.  
5. **Score comparability:** if coaches shorten duration or lower item counts, norms/AI baselines may need config-aware interpretation — AI router (Track C) should consume snapshots.  
6. **Grid size / number range / orb radius:** changing these alters motor/visual demand; recommend keeping internal until evidence shows coaches need them.  
7. **Whether session row stores patch vs effective:** proposal prefers effective; product/ops may want both (`overrides` + `effective`) — defer to Phase 1 schema review.  
8. **Abandoned attempts:** snapshot-at-start still valuable; confirm retention policy.

---

## 10. Non-goals (reaffirmed)

- No database migrations in this phase  
- No API / frontend / coach UI changes  
- No modification of existing `config.ts` behavior  
- No Track B scope expansion here  
- No conflation of adaptive runtime difficulty with coach-selected initial settings  

---

## Appendix A — Current hardcoded defaults quick reference

| Slug | Duration / length | Targets / items | Speed / timing | Adaptive |
| --- | --- | --- | --- | --- |
| visual-tracking | 30s | 30 items | speed 0.12–0.25 | No |
| visual-memory | 30s; memorize 1.5s | 5/25 cells | — | No |
| reaction-time | 10 attempts | — | delay 1.5–4s | No |
| peripheral-vision | 30s | trials until time | interval 0.8–1.8s; flash 0.5s | No |
| football-visual-scanning | 9 questions × 12s | pack-fixed | — | No |
| sequential-visual-search | until 50 found | 50 | — | No |
| digit-memory | up to 8 levels | lengths 3–10 | show 800ms | Yes (stop on miss) |
| dual-target-tracking | 5 levels | 6–14 objects | speed 0.12–0.22; move 5–12s | Progressive ladder |

## Appendix B — Evidence paths

| Asset | Path |
| --- | --- |
| Registry | `frontend/lib/tests/registry.ts` |
| Config modules | `frontend/lib/tests/{visual-tracking,visual-memory,reaction-time,peripheral-vision,digit-memory,dual-target-tracking}/config.ts` |
| Sequential | `frontend/lib/tests/sequential-visual-search/{layout,engine}.ts` |
| Scanning | `frontend/lib/tests/football-visual-scanning/{answers.ts,sequences.json}` |
| Seeds (`configuration: {}`) | `backend/app/shared/infrastructure/database/seeds.py` |
| Models | `backend/app/modules/cognitive_tests/infrastructure/models.py` |
| Attempts/results | `backend/app/modules/results/infrastructure/models.py` |
| API (no config fields) | `backend/app/modules/test_sessions/application/schemas.py` |
