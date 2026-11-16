# User Journeys

Journeys marked **Confirmed** match current `frontend/` behavior.  
Steps marked **Proposed** are v2 targets without current UI/API evidence.

---

## A. Coach registration and onboarding — **Confirmed**

1. Land on `/` → choose **Entraîneur**.  
2. If no cookie → `/coach` redirects to `/coach/login`.  
3. Create account on `/coach/register` (name, email, password ≥8).  
4. Full page navigation to `/coach` after auth (hard reload).  
5. See empty/previous session list + create-session entry.

**Edge cases**
- Email already exists → French error.  
- Soft client navigation after auth historically flaky → mitigated by hard redirect.

---

## B. Creating an organization or using independently

### Independent use — **Confirmed**
Coach works alone under personal account; sessions belong to `coach_id`.

### Organization onboarding — **Proposed**
1. Create organization.  
2. Invite coaches.  
3. Optionally create teams.  
4. Sessions attributed to org and/or coach.

**Gap:** No organization entity or invite flow today.

---

## C. Creating teams and adding players

### Current reality — **Confirmed (session-only players)**
Players are **not** pre-rostered. They appear when they join a session.

### Proposed v2
1. Create team under org.  
2. Add player profiles.  
3. Assign team to a session or invite roster.

---

## D. Selecting and assigning a cognitive test — **Confirmed**

1. Coach opens create-session UI.  
2. Sets title.  
3. Toggles exercises from the 8-test catalog.  
4. Submits → server creates **active** session, stores `session_exercises` with shuffle order.  
5. Coach copies code.

**Notes**
- Free play of individual tests is disabled (redirect `/join`).  
- Assignment is **per session**, not per player.

---

## E. Starting and completing a test session — **Confirmed**

### Coach
1. Shares code.  
2. Opens `/coach/sessions/[code]`.  
3. Watches players appear and progress.  
4. May close session early.  
5. May archive session later (soft delete).

### Player
1. `/join` → code + name.  
2. Redirect `/play/[code]` → auto to first unfinished slug.  
3. Completes exercise → auto next.  
4. Wrong slug URL → redirected to correct next.  
5. All done → completion message (no scores).

**Business constraints**
- One attempt per exercise.  
- Session joinable while active and before `endsAt`.  
- Submit grace after close/expiry (~15 min).

---

## F. Calculating and reviewing results — **Confirmed**

1. Each exercise client computes metrics and submits once.  
2. Server authorizes/stores `test_results`.  
3. Coach expands player → `presentResult` cards (headline, notes, indicator lines).  
4. No single composite “IQ-like” score across exercises (explicitly unavailable).

---

## G. Viewing player development over time

### Current — **Partial / mostly absent in UI**
- Coach can open **multiple historical sessions** (if not archived from list).  
- AI orchestrator can build `progress` reports when ≥2 comparable sessions exist for same coach + same displayName.  
- **No dedicated progress dashboard** or coach button for progress reports.

### Proposed
1. Player identity stable across sessions.  
2. Timeline of sessions + exercise trends.  
3. Optional AI progress narrative.

---

## H. Generating AI-assisted analysis — **Confirmed** (session + group)

### Player report
1. Player finished all assigned exercises.  
2. Coach clicks generate on player panel.  
3. System builds context from stored results (+ benchmarks when available).  
4. OpenAI structured bilingual report stored.  
5. Coach opens modal / downloads PDF.

### Group report
1. ≥1 player finished all exercises.  
2. Coach generates group report.  
3. Synthesis for the session; charts from finished players’ averages.  
4. Modal + PDF.

**Not exposed:** automatic generation on every result submit; per-exercise AI reports in UI.
