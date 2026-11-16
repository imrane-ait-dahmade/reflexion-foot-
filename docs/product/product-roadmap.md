# Product Roadmap Recommendations — Cognitif Connexion Foot 2.0

This roadmap is a **product recommendation**, not a committed delivery plan. It separates what already works from what to build next.

---

## Phase 0 — Preserve & harden (now)

**Goal:** Keep the live session product reliable while FastAPI architecture matures.

- Keep coach auth, session create/join, forced path, one attempt, dashboard, AI session/group + PDF.  
- Keep Metrica attribution and non-clinical AI policy.  
- Fix known product risks when touching code later: role check on `requireCoach`; clarify `draft` status; document exercise-count UX vs DB.  
- Continue dual-run: Next.js remains source of product truth until feature parity on FastAPI.

**Priority:** Must Have (stability)

---

## Phase 1 — Clarity & coach UX (near term)

**Goal:** Make existing value obvious without expanding tenants yet.

| Item | Type | Why |
|------|------|-----|
| Clearer session creation (presets by age/goal) | Improve | Faster setup |
| Dashboard empty states & “what to do next” | Improve | New coach onboarding |
| Stronger PDF/report hierarchy already started | Improve | Share with staff |
| In-app glossary of what each score means | Improve | Reduce misreading digit-memory etc. |
| Optional progress list: same displayName across sessions | Improve | Lightweight without full player accounts |

**Priority:** Should Have

---

## Phase 2 — Identity of players & progress (mid term)

**Goal:** Unlock journey G properly.

| Item | Type |
|------|------|
| Stable player identity (account or coach-managed roster) | New |
| Cross-session progress UI + comparable metrics charts | New |
| Expose AI progress report when eligible | Improve (surface existing capability) |

**Depends on:** product decision on guest vs accounts (open question).

**Priority:** Should Have / Could Have for AI progress button

---

## Phase 3 — Organizations & teams (mid/late)

**Goal:** Serve academies/clubs, not only independent coaches.

| Item | Type |
|------|------|
| Organizations module | New |
| Teams + roster | New |
| Org admin permissions | New |
| Session attribution to team/org | New |

**Priority:** Should Have for B2B academies; Could Have for solo coaches

---

## Phase 4 — Platform & assessment expansion (later)

| Item | Type | Caution |
|------|------|---------|
| Pluggable test SDK on FastAPI | New | Don’t break envelope rules |
| Club-owned video/tracking imports | Future | Rights, privacy |
| Free play / homework mode | Future | Was disabled for a reason |
| Email digests / scheduled reports | Future | Ops cost |
| Billing | Future | Only with clear packaging |

---

## Explicit non-goals (for now)

- Clinical claims or medical certification.  
- Replacing Metrica citation with fake “norms”.  
- Microservices before modular monolith proves limits.  
- Rewriting all eight exercises from scratch without evidence of need.

---

## Suggested implementation priorities (summary)

1. **Must:** Preserve session loop + scoring honesty + AI session/group.  
2. **Should:** Coach UX clarity + player identity/progress + org/teams if B2B is strategic.  
3. **Could:** Progress AI in UI, generation speed/UX, presets.  
4. **Future:** Free play, billing, advanced media pipelines.

---

## Open product decisions (blockers for design)

1. Is the primary buyer the **independent coach** or the **academy** in the next 12 months?  
2. Are players forever guests, or do we invest in accounts/rosters?  
3. Should 2.0 keep **Next.js as BFF** longer, or migrate session APIs to FastAPI first?  
4. Which languages beyond FR/AR are required?  
5. Do we need GDPR/parental consent flows for underage players (jurisdiction-specific)?
