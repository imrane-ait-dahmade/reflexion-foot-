# Functional Requirements — Cognitif Connexion Foot 2.0

Priority: **Must Have** · **Should Have** · **Could Have** · **Future Consideration**  
Origin: **Existing** (preserve) · **Improve** · **New**

---

## FR-IAM — Identity & Access

### FR-IAM-001 — Coach registration  
**Priority:** Must Have · **Origin:** Existing  
**User story:** As a coach, I register with name/email/password so I can create sessions.  
**Acceptance**
- Given valid inputs (≥8 char password), when I submit, then I am authenticated and reach the coach hub.  
- Given an existing email, when I submit, then I see a clear error.  
**Edge cases:** network failure; weak password.

### FR-IAM-002 — Coach login / logout  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** Protected coach routes redirect unauthenticated users to login; logout clears session and returns to login.

### FR-IAM-003 — Player join without account  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** Code + display name creates session player; invalid/expired code fails clearly.

### FR-IAM-004 — Organization roles  
**Priority:** Should Have · **Origin:** New  
**Acceptance:** Org admin can invite coaches; permissions scoped to organization.  
**Note:** Not in current product.

### FR-IAM-005 — Persistent player accounts  
**Priority:** Could Have · **Origin:** New  
**Acceptance:** Optional link between guest join and lasting profile without breaking code join.

---

## FR-ORG / FR-TEAM

### FR-ORG-001 — Organizations  
**Priority:** Should Have · **Origin:** New  
Create/manage academy or club tenant.

### FR-TEAM-001 — Teams  
**Priority:** Should Have · **Origin:** New  
Create teams, list players, attach to sessions.

---

## FR-SES — Test sessions

### FR-SES-001 — Create session with selected exercises  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** Coach selects ≥1 exercise; receives shareable code; session active with `endsAt`.

### FR-SES-002 — Live dashboard  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** Shows players, completion progress, per-exercise details for selected player; refreshes without full reload.

### FR-SES-003 — Close session  
**Priority:** Must Have · **Origin:** Existing  

### FR-SES-004 — Soft archive  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** Removed from list; historical results remain for analytics/AI cohort.

### FR-SES-005 — Forced player path  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** Player cannot choose arbitrary exercise order; wrong slug redirects.

### FR-SES-006 — One attempt  
**Priority:** Must Have · **Origin:** Existing  

### FR-SES-007 — Hide scores from players  
**Priority:** Must Have · **Origin:** Existing  

---

## FR-TEST — Cognitive tests

### FR-TEST-001 — Maintain eight current exercises  
**Priority:** Must Have · **Origin:** Existing  

### FR-TEST-002 — Lecture du jeu (scanning) fidelity  
**Priority:** Must Have · **Origin:** Existing  
**Acceptance:** 9 scenarios; 12s limit; coordinate-derived answers; Metrica attribution visible.

### FR-TEST-003 — Pluggable test contract  
**Priority:** Should Have · **Origin:** Improve/New (backend v2)  
**Acceptance:** New tests register slug, scoring meaning, presenter, AI guide without rewriting session core.

### FR-TEST-004 — Re-enable free play mode  
**Priority:** Future Consideration · **Origin:** Improve  
Currently disabled by design.

---

## FR-RES — Results

### FR-RES-001 — Coach-readable indicators per exercise  
**Priority:** Must Have · **Origin:** Existing  

### FR-RES-002 — No false global composite score  
**Priority:** Must Have · **Origin:** Existing  

### FR-RES-003 — Result integrity checks  
**Priority:** Must Have · **Origin:** Existing  

---

## FR-PROG — Progress

### FR-PROG-001 — Within-session progress  
**Priority:** Must Have · **Origin:** Existing  

### FR-PROG-002 — Cross-session progress UI  
**Priority:** Should Have · **Origin:** New/Improve  
**Acceptance:** Stable player identity; timeline of sessions; trends per exercise where comparable.  
**Gap:** UI absent; name-matching only in AI backend logic.

---

## FR-AI — AI analysis

### FR-AI-001 — Player session report on demand  
**Priority:** Must Have · **Origin:** Existing  
FR/AR, finished player only, modal + PDF.

### FR-AI-002 — Group session report on demand  
**Priority:** Must Have · **Origin:** Existing  

### FR-AI-003 — Non-clinical / no talent claims  
**Priority:** Must Have · **Origin:** Existing (policy in prompts)  

### FR-AI-004 — Benchmarks (app cohort + curated studies)  
**Priority:** Should Have · **Origin:** Existing (recently enriched)  

### FR-AI-005 — Progress AI report in UI  
**Priority:** Could Have · **Origin:** Partial backend  

### FR-AI-006 — Faster/partial-language generation  
**Priority:** Could Have · **Origin:** Improve  

---

## FR-REP — Reporting

### FR-REP-001 — Branded PDF  
**Priority:** Must Have · **Origin:** Existing  

### FR-REP-002 — Org-level PDF packs  
**Priority:** Future Consideration · **Origin:** New  

---

## Role & permission requirements

| Capability | Player guest | Coach | Org admin (proposed) |
|------------|--------------|-------|----------------------|
| Join session | Yes | — | — |
| Play assigned tests | Yes | — | — |
| See own scores | No (current) | — | — |
| Create session | No | Yes | Yes (scoped) |
| View results | No | Own sessions | Org sessions |
| Generate AI | No | Own sessions | Org sessions |
| Manage org/coaches | No | No | Yes |

---

## Module dependency map (functional)

```
Identity → Sessions → Results → AI / Reporting
Sessions → Cognitive Tests
Players (guest) → Sessions
Organizations → Teams → Players → Sessions   (proposed)
Progress → Players + Results                 (proposed UI)
```
