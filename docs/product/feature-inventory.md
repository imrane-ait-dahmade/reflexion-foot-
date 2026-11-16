# Feature Inventory

Status values: **Exists** · **Partial** · **Absent** · **Disabled**

---

## 1. Identity & Access Management

| Feature | Status | Evidence |
|---------|--------|----------|
| Coach registration | Exists | `/coach/register`, Better Auth hook → `users.role=coach` |
| Coach login / logout | Exists | `/coach/login`, sign-out control |
| Player login | Absent | Join only |
| Roles coach/player enum | Exists | DB enum; player role unused in join |
| Org/admin roles | Absent | — |
| Password reset / email verify | Uncertain | Not verified in UI flows audited |
| Session cookie auth for coaches | Exists | Better Auth + `requireCoach` |

## 2. Organizations

| Feature | Status |
|---------|--------|
| Create/manage organization | Absent |
| Multi-coach membership | Absent |
| Branding per org | Absent |

## 3. Teams

| Feature | Status |
|---------|--------|
| Team entity | Absent |
| Assign players to teams | Absent |

## 4. Players

| Feature | Status | Notes |
|---------|--------|-------|
| Session join with display name | Exists | Unique per session (case-insensitive) |
| Persistent player profile | Absent | `user_id` nullable, unused |
| Player history across sessions | Partial | AI progress logic can match same coach + same displayName; **no coach UI** |
| Player score visibility | Disabled by design | Progress API omits scores |

## 5. Cognitive Tests

| Feature | Status | Notes |
|---------|--------|-------|
| 8 exercises in registry | Exists | See domain doc |
| Free standalone play | Disabled | Routes redirect to `/join` |
| Coach selects tests for session | Exists | Create-session UI |
| Per-test animated intros | Exists | Exercise intro/demo components |
| Common result envelope | Exists | `test_results` columns + metrics JSON |
| Per-test scoring strategies | Exists | Domain-specific libs |

## 6. Test Sessions

| Feature | Status | Notes |
|---------|--------|-------|
| Create session with code | Exists | 4–8 A–Z0–9 |
| Active immediately | Exists | `draft` enum unused in create path |
| TTL ~4 hours | Exists | `SESSION_DURATION_MS` |
| Submit grace ~15 min | Exists | After close/expiry |
| Shuffle exercise order | Exists | On create |
| Live coach dashboard | Exists | Poll ~5s |
| Close session | Exists | |
| Soft archive (“Supprimer”) | Exists | Keeps data for cohort/AI |
| Hard delete | Absent | Soft archive only |

## 7. Results & Scoring

| Feature | Status | Notes |
|---------|--------|-------|
| One attempt per exercise/player/session | Exists | Unique constraint |
| Coach per-exercise detail cards | Exists | `presentResult` |
| Global average score across exercises | Explicitly unavailable | Different scales |
| HMAC / challenge tokens for integrity | Exists | Challenge token libs + authorize |
| Player-facing scoreboard | Absent (intentional) | |

## 8. Progress Tracking

| Feature | Status | Notes |
|---------|--------|-------|
| Within-session progress bars | Exists | Coach dashboard |
| Cross-session player progress UI | Absent | |
| AI `progress` report type | Partial | Orchestrator only; no coach API/UI |

## 9. AI Analysis

| Feature | Status | Notes |
|---------|--------|-------|
| Player session report (FR/AR) | Exists | Manual generate when finished |
| Group/session report | Exists | Manual generate |
| Per-test AI report | Partial | Types exist; coach API rejects non-session |
| Cohort vs app players | Exists | In prompts/context when enough N |
| Curated study references | Exists | Code-level, cautious use rules |
| Charts from real metrics | Exists | UI + PDF |
| Branded PDF export | Exists | Logo + “Généré par RealScouting Academy” |
| Feature flag + API key gate | Exists | `AI_ANALYSIS_ENABLED` |

## 10. Reporting

| Feature | Status |
|---------|--------|
| In-app report modal | Exists |
| PDF via print dialog | Exists |
| Scheduled email reports | Absent |
| Org-level rollups | Absent |

## 11. Marketing / UX shell

| Feature | Status |
|---------|--------|
| Home landing + Motion | Exists |
| Demo video popup | Exists |
| Idea strip (Code → Regard → Lecture) | Exists |
| Footer links | Exists |
| Desktop no-scroll home layout | Exists |

## Inventory summary

- **Strong today:** session join, forced exercise path, coach dashboard, 8 tests, AI session/group + PDF.  
- **Weak / missing for v2 ambitions:** orgs, teams, persistent players, longitudinal progress UI, admin roles.
