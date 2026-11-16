# Product Overview — Cognitif Connexion Foot / RealScouting Academy

**Document type:** Functional discovery (read-only audit)  
**Source of truth:** `frontend/` (Next.js product currently in production use)  
**Date:** 2026-11-14  
**Branch inspected:** `master`

## 1. What the product is today

RealScouting Academy (UI brand) / Cognitif Connexion Foot (product line in PDF/demo naming) is a **web platform for short cognitive–visual sessions** aimed at football coaches and players.

Coaches create a timed session, share a join code, and observe how players look, decide, and respond on browser exercises. Players join with **code + display name** (no account). Scores are hidden from players and shown to the coach. Optional **AI reports** (French + Arabic) summarize a finished player or the whole session.

This is an **existing product**, not a greenfield concept. Version 2.0 should evolve it (clarity, multi-org structure, clearer progress) without discarding proven flows.

## 2. Confirmed product surface

### Navigation map

| Route | Audience | Status |
|-------|----------|--------|
| `/` | Public | Marketing home + demo video + CTAs |
| `/coach/register` | Coach | Account creation |
| `/coach/login` | Coach | Sign-in |
| `/coach` | Coach | Session create + list |
| `/coach/sessions/[code]` | Coach | Live dashboard + AI |
| `/join` | Player | Join with code + name |
| `/play/[code]` | Player | Hub / completion |
| `/play/[code]/[slug]` | Player | Forced exercise run |
| `/tests/*`, `/exercises/*` | — | **Redirect to `/join`** (free play disabled) |

### Confirmed roles in code

| Role | How it works |
|------|----------------|
| **Coach** | Better Auth email/password; app `users.role = coach` |
| **Player** | Session-scoped `session_players` row; `sessionStorage`; **no login** |

Schema also defines `user_role = player`, but player **accounts are not used** in the join flow today.

### Confirmed cognitive exercises (8)

1. Suivi de numéros (`visual-tracking`)
2. Mémoire visuelle (`visual-memory`)
3. Temps de réaction (`reaction-time`)
4. Vision périphérique (`peripheral-vision`)
5. Lecture du jeu (`football-visual-scanning`) — Metrica tracking frames
6. Recherche visuelle séquentielle (`sequential-visual-search`)
7. Mémoire numérique séquentielle (`digit-memory`)
8. Suivi de deux cibles mobiles (`dual-target-tracking`)

### Confirmed core workflows

1. Coach registers / signs in  
2. Coach creates an **active** session (code, exercise set, ~4h TTL)  
3. Players join and complete exercises in **forced random order**, **one attempt** each  
4. Coach watches live progress and per-exercise indicators  
5. Coach optionally generates **player session AI report** and/or **group AI report** (+ PDF)

## 3. What is not in the current product (evidence gap)

These appear in the **v2 architecture modules** as targets, but **no frontend/schema entities** exist yet:

- Organizations / academies / clubs as first-class tenants  
- Teams / squads  
- Academy / club administrator roles  
- Player persistent accounts and profiles  
- Coach UI for longitudinal progress across many sessions  
- Billing / subscriptions  
- Real-time websockets (dashboard uses HTTP polling ~5s)

## 4. Dual codebase context

| Area | Location | Role today |
|------|----------|------------|
| Live product | `frontend/` | Next.js UI + API routes + Neon/Drizzle + Better Auth + OpenAI |
| v2 backend foundation | `backend/` | FastAPI modular monolith scaffold (no business migration yet) |
| Architecture ADRs | `docs/architecture/` | Technical decisions for v2 |

## 5. Product principles to preserve in 2.0

1. **Observational, not clinical** — browser exercises ≠ medical diagnosis.  
2. **Coach sees; player focuses** — hide scores from players during the run.  
3. **Session code join** — low friction for groups on pitch/meeting room.  
4. **One attempt per exercise per session** — comparable results.  
5. **Cite sources honestly** (e.g. Metrica for Lecture du jeu).  
6. **AI is assistive and on-demand**, bilingual (FR/AR), with limitations.

## 6. Related documents

- [user-personas.md](user-personas.md)  
- [feature-inventory.md](feature-inventory.md)  
- [functional-requirements.md](functional-requirements.md)  
- [user-journeys.md](user-journeys.md)  
- [business-rules.md](business-rules.md)  
- [cognitive-assessment-domain.md](cognitive-assessment-domain.md)  
- [product-roadmap.md](product-roadmap.md)  
