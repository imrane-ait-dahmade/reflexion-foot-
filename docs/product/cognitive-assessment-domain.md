# Cognitive Assessment Domain

Audit based on `frontend/lib/tests/**` and related result/AI guides.  
**Do not invent scoring formulas** — formulas below are from code.

---

## 1. Shared system (confirmed envelope)

All session exercises persist into `test_results` with a common envelope:

- `test_slug`
- `score` (integer; **meaning depends on slug**)
- `accuracy` (0–100 scale in storage)
- `correct_answers`, `errors`
- `average_reaction_ms`, `best_reaction_ms`
- `duration_ms`
- `metrics` (JSON; exercise-specific)
- `completed_at`

**Product implication:** a future test must (1) register a slug, (2) implement client play + authorize/submit, (3) map into this envelope, (4) provide `presentResult` copy and optional AI exercise guide.

Free standalone URLs under `/tests/*` are **disabled** (redirect to join). Tests run inside **sessions** only.

---

## 2. Catalog (confirmed)

| Slug | Name | Construct (from product copy / guides) |
|------|------|----------------------------------------|
| `visual-tracking` | Suivi de numéros | Track target among moving digits |
| `visual-memory` | Mémoire visuelle | Remember lit cells on 5×5 |
| `reaction-time` | Temps de réaction | Touch target when it appears |
| `peripheral-vision` | Vision périphérique | Detect side flash while fixating center |
| `football-visual-scanning` | Lecture du jeu | Decide on real tracking frames |
| `sequential-visual-search` | Recherche visuelle séquentielle | Find 1…50 in order |
| `digit-memory` | Mémoire numérique séquentielle | Recall digit sequences |
| `dual-target-tracking` | Suivi de deux cibles mobiles | Track two targets among distractors |

---

## 3. Deep dive — Football Visual Scanning (`football-visual-scanning`)

### Purpose
Assess quick game reading on **real tracking snapshots**: who is closest to the ball, who is the nearest opponent defender, who has most space (free teammate).

### Source & attribution (confirmed)
- Tracking data © **Metrica Sports** sample data.  
- Attribution string in `sequences.json` / UI.  
- Study caution in AI refs: Ward & Williams (2003) as related construct — **not** a validated battery for these 9 items.

### Questions & scenarios
- **9 sequences** total.  
- Challenge types (3 each):  
  - `closest` — player nearest the ball  
  - `defender` — nearest opponent relative to closest player logic in code  
  - `free` — teammate (not the closest) with maximum space vs opponents  

Answers are **derived from coordinates** (`correctPlayer`), not hand-labeled keys. Ties break on `playerId`.

Pitch scaling constants: width 105 m, height 68 m for distance.

### Timing
- Per-question limit: **`SCANNING_LIMIT_MS = 12_000`** (12 seconds).  
- No answer within limit → miss (recorded at limit).

### Scoring (from submission/presentation path)
- Attempts = number of questions in the run.  
- Correct answers counted when player selection matches `correctPlayer`.  
- **`score = round(correct / attempts * 100)`**  
- **`accuracy = score`** for this exercise  
- Errors include incorrect + missed (as stored by the test pipeline).

### Session lifecycle for this test
Same as other tests: only if assigned to the session; one attempt; forced order; result stored once.

### Result structure (coach-facing)
Presented via `presentResult` with exercise-specific headline/lines/notes (correct count, timing indicators as implemented in presentation layer).

### Limitations (product + scientific honesty)
1. Nine browser questions ≠ full perceptual–cognitive match test.  
2. Protocol differs from lab scanning studies.  
3. Score is % correct under 12s deadline — not a prediction of match performance.  
4. Depends on Metrica sample frames; not club’s own match footage today.

---

## 4. How other exercises differ (high level, evidenced)

| Slug | Score meaning (guide/code intent) |
|------|-----------------------------------|
| `reaction-time` | Emphasizes mean reaction ms; false starts excluded from mean |
| `digit-memory` | Score is max digits memorized (length), **not** a 0–100 grade |
| `sequential-visual-search` | Score aligns with precision over 1–50 search, not a speed ranking alone |
| `dual-target-tracking` | Targets recovered / opportunities style precision |
| `visual-memory` / `visual-tracking` / `peripheral-vision` | Task-specific hit/precision blends (see presenters & guides) |

**Rule:** never average raw `score` across slugs for a “global IQ”.

---

## 5. Common system for future tests (recommended contract)

Without inventing formulas, v2 should require each new test to supply:

1. **Slug + registry entry** (name, short description).  
2. **Domain scoring module** documenting what `score` and `accuracy` mean.  
3. **Authorization** compatible with session challenge rules.  
4. **Presenter** for coach UI (headline, lines, caveats).  
5. **AI exercise guide** + optional curated study reference with `useRule`.  
6. **Metrics JSON schema** keys allowed for AI evidence.

Strategy pattern (already aligned with architecture): one shared session runner, pluggable test strategies.

---

## 6. Uncertainties
- Exact on-screen UX copy variations per device not exhaustively screenshot-audited.  
- Whether all 9 scanning sequences always appear in fixed order or shuffled client-side — confirm in `FootballVisualScanningTest` when implementing v2 ports.  
- Live DB may contain historical results under older scoring revisions; migration policy TBD.
