# Business Rules

IDs: `BR-xxx`. Rules marked **Confirmed** are enforced in current `frontend/` code/schema. **Proposed** are recommended for v2.

---

## Sessions

| ID | Rule | Status |
|----|------|--------|
| BR-001 | A session belongs to exactly one coach (`coach_id`). | Confirmed |
| BR-002 | Session codes are unique, uppercase alphanumeric, length 4–8. | Confirmed |
| BR-003 | A newly created product session is **active** immediately (not draft). | Confirmed |
| BR-004 | Default join window is 4 hours from creation (`endsAt`). | Confirmed |
| BR-005 | After close or expiry, results may still be submitted within a 15-minute grace. | Confirmed |
| BR-006 | Archiving a session hides it from the coach list but retains data (soft delete). | Confirmed |
| BR-007 | Exercise order for players is randomized at session creation when enabled. | Confirmed |
| BR-008 | A session must include at least one exercise (DB allows 1–10). | Confirmed |

## Players & attempts

| ID | Rule | Status |
|----|------|--------|
| BR-010 | Players join with display name only (no password) for a given session. | Confirmed |
| BR-011 | Display names are unique per session (case-insensitive). | Confirmed |
| BR-012 | A player may submit **at most one** result per exercise per session. | Confirmed |
| BR-013 | Players follow a forced exercise sequence; they cannot freely pick the next test. | Confirmed |
| BR-014 | Players must not see numeric scores/AI content in the player progress API/UI. | Confirmed |
| BR-015 | Closed sessions block starting unfinished exercises. | Confirmed |

## Results & interpretation

| ID | Rule | Status |
|----|------|--------|
| BR-020 | Each exercise owns its scoring semantics; scores are not freely comparable across exercises. | Confirmed |
| BR-021 | Dashboard must not invent a global average across heterogeneous exercises. | Confirmed (explicit unavailable copy) |
| BR-022 | Result submissions must be authorized (challenge/session checks) before persistence. | Confirmed |
| BR-023 | Stored metrics are the source of truth; AI must not recalculate invented stats. | Confirmed (AI prompts) |

## AI analysis

| ID | Rule | Status |
|----|------|--------|
| BR-030 | AI analysis runs only when enabled via env flag and API key. | Confirmed |
| BR-031 | A player **session** AI report requires the player to have finished all assigned exercises. | Confirmed |
| BR-032 | Coach-facing generation is limited to report types exposed by API (`session`, `group`). | Confirmed |
| BR-033 | Reports are bilingual FR + AR in the stored schema. | Confirmed |
| BR-034 | AI must not provide clinical diagnoses or talent/professional predictions. | Confirmed (prompts) |
| BR-035 | External study numbers may be cited only if present in curated references and use rules. | Confirmed |
| BR-036 | App cohort percentiles require a minimum sample; otherwise disclose small base. | Confirmed |
| BR-037 | Group report eligibility requires ≥1 fully finished player. | Confirmed |

## Access control

| ID | Rule | Status |
|----|------|--------|
| BR-040 | Only authenticated coaches access `/coach` and session dashboards. | Confirmed |
| BR-041 | Coaches may only manage sessions they own. | Confirmed |
| BR-042 | `requireCoach` currently does not re-check `users.role === 'coach'` after auth link. | Confirmed gap / risk |
| BR-043 | Org-scoped permissions. | Proposed |

## Proposed v2 rules (not enforced yet)

| ID | Rule |
|----|------|
| BR-050 | Players optionally link to a persistent identity across sessions. |
| BR-051 | Organizations own teams; coaches act within org membership. |
| BR-052 | Team assignment is optional for a session but recommended for academies. |
| BR-053 | Longitudinal progress requires stable player identity, not display-name matching alone. |
