# V1 → V2 Dependency Audit

**Project:** Cognitif Connexion Foot / RealScouting Academy  
**Scope:** `football-vision-test/frontend` (Next.js) ↔ `football-vision-test/backend` (FastAPI)  
**Phase:** 1 — Audit only (no deletions)  
**Date:** 2026-11-15

## Executive verdict

| Area | Still on Next.js V1 (Neon/Drizzle/Better Auth)? | FastAPI equivalent? | UI switched? |
| --- | --- | --- | --- |
| Coach page gate | **Yes** (`requireCoach`, `proxy.ts`) | Staff JWT exists | Dual-auth for players only |
| Players roster | No V1 roster CRUD | **Full** `/api/v1/players|teams` | **Yes** (via JWT + StaffApiGate) |
| Sessions create/list/close | **Yes** `/api/sessions*` | Partial lifecycle `/api/v1/sessions*` | **No** |
| Session dashboard / results read | **Yes** | **Missing** staff results/dashboard API | **No** |
| Player join / play / progress | **Yes** | Partial player-session APIs | **No** |
| Result write | **Yes** `/api/results` + challenge routes | `complete` exercise only | **No** |
| Digit-memory / dual-target challenges | **Yes** server routes | **Missing** | **No** |
| AI reports | **Yes** OpenAI in Next | Model only, **no router** | **No** |
| PDF | Client HTML print | N/A | Can keep as presentation |

**Bottom line:** Full backend separation is blocked until sessions, results, challenge engines, AI reports, and coach auth cutover are migrated. Players Management V2 already proves the FastAPI path.

---

## 1. Package dependencies (backend-ish)

| Package | Role | Remove only after |
| --- | --- | --- |
| `@neondatabase/serverless` | Neon HTTP/WS DB | All Next DB handlers gone |
| `drizzle-orm` / `drizzle-kit` | ORM + studio | Same |
| `better-auth` | Cookie coach auth | BFF + FastAPI auth cutover verified |
| `openai` | AI in Next Route Handlers | FastAPI AI router live |
| `ws` | Neon WS for Better Auth pool | Better Auth removed |
| `dotenv` (dev) | drizzle.config | drizzle removed |

Keep: Next/React/Tailwind/Radix/Motion/Lucide/Zod (frontend).

Script to retire later: `db:studio`.

---

## 2. Database / Neon / Drizzle map

| Path | Purpose |
| --- | --- |
| `lib/db/client.ts` | `neon(DATABASE_URL)` + drizzle |
| `lib/db/drizzle-schema.ts` | V1 tables |
| `lib/db/types.ts` | Shared TS types (UI imports `TestSlug`) |
| `lib/db/schema.sql` | SQL baseline |
| `lib/db/migrations/002_*.sql` … `007_*.sql` | Incremental DDL |
| `drizzle.config.ts` | Kit config → `DATABASE_URL` |
| `.env.example` | Documents `DATABASE_URL`, Better Auth, OpenAI |

### V1 tables

`users`, `training_sessions`, `session_exercises`, `session_players`, `test_results`, `ai_reports` (+ enums).

### Direct SQL / Drizzle consumers

- `lib/sessions/service.ts`
- `lib/tests/challenge-access.ts`
- `lib/ai-analysis/analysis-repository.ts`
- `lib/auth.ts`, `lib/auth-server.ts`

---

## 3. Better Auth map

| Path | Purpose |
| --- | --- |
| `lib/auth.ts` | betterAuth + Neon Pool + coach `users` sync |
| `lib/auth-client.ts` | Browser client |
| `lib/auth-server.ts` | `getAuthSession`, `requireCoach` |
| `app/api/auth/[...all]/route.ts` | Catch-all handler |
| `proxy.ts` | Cookie gate for `/coach/*` |
| `components/sessions/CoachAuthForm.tsx` | Login/register |
| `components/sessions/CoachSignOutButton.tsx` | Sign-out |

**Pages using `requireCoach()`:**  
`/coach`, `/coach/login`, `/coach/register`, `/coach/sessions/[code]`, `/coach/players`, `/coach/players/[playerId]`.

**Env:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (also used as HMAC secret in `lib/tests/challenge-token.ts`).

**Parallel V2:** `lib/api/auth.service.ts`, `tokenStore`, `hooks/useStaffApiSession.ts`, `StaffApiGate` (JWT in localStorage today — to be replaced by BFF httpOnly cookies).

---

## 4. Next.js API routes (V1)

| Route | Methods | Purpose | FastAPI counterpart |
| --- | --- | --- | --- |
| `/api/auth/*` | GET/POST | Better Auth | `/api/v1/auth/*` (different model) |
| `/api/sessions` | GET/POST | List/create | `/api/v1/sessions` (different create semantics) |
| `/api/sessions/join` | POST | Join by code + displayName | `/api/v1/player/session/join` (personal_code) |
| `/api/sessions/[code]` | GET/DELETE | Meta / archive | GET by UUID; cancel (no archive API parity) |
| `/api/sessions/[code]/dashboard` | GET | Coach live board | **Missing** |
| `/api/sessions/[code]/close` | POST | Close | `/complete` (different) |
| `/api/sessions/[code]/reports` | GET/POST | Group AI | **Missing** |
| `/api/sessions/[code]/players/[id]/reports` | GET/POST | Player AI | **Missing** |
| `/api/results` | POST | Persist result | `.../exercises/{id}/complete` |
| `/api/exercises/digit-memory` | POST | Server challenge | **Missing** |
| `/api/exercises/dual-target-tracking` | POST | Server challenge | **Missing** |
| `/api/players/[sessionPlayerId]/progress` | GET | Progress | `GET /api/v1/player/session` |

**Note:** `next.config.ts` rewrites `/api/v1/*` → FastAPI. V1 routes stay under `/api/*` (no `v1`).

---

## 5. UI still calling V1 `/api/*`

| Component | Calls |
| --- | --- |
| `CoachDashboard` / `CreateSessionDialog` | sessions list/create/delete |
| `CoachSessionDashboard` | dashboard / close / delete |
| `CoachGroupReportPanel` / `CoachAnalysisPanel` | AI reports |
| `JoinSessionForm` | join |
| `PlayerPlayHub` / `SessionTestRunner` / `SaveResultEffect` | progress + results |
| DigitMemory / DualTarget tests | challenge routes |
| `lib/sessions/submit-client.ts` | `POST /api/results` |

**Already on FastAPI:** `components/coach/players/**` via `playersService` / `teamsService`.

---

## 6. FastAPI mounted surface (`/api/v1`)

From `backend/app/api/v1/router.py`:

- Auth + users admin  
- Positions + players (CRUD, import, notes, access codes)  
- Teams (+ staff/players membership)  
- Cognitive tests catalogue  
- Sessions lifecycle + player join/progress/start/complete  

**Models without HTTP router:** `results` (`TestAttempt`/`TestResult`), `ai_analysis` (`AiReport`).

**Existing unused frontend clients:** `useSessions`, `useExercises`, `sessionsService` (ready, not wired in session UI).

---

## 7. Feature gap matrix (required backend work)

| Capability | Status | Backend requirement before Next removal |
| --- | --- | --- |
| Staff login/refresh/logout/me | Exists | BFF cookie wrapper |
| Coach self-register | Better Auth only | Decide: keep invite-only FastAPI users, or add register |
| Players/teams/import | Exists + UI done | Auth cutover only |
| Session create as active + code URL | V1 semantics | Align UI to V2 draft→start **or** add V1-compatible endpoints |
| Join by displayName | V1 only | Migrate UX to personal_code **or** add bridge |
| Coach dashboard aggregation | V1 only | **New** staff results/dashboard API |
| Staff list results by player/session | Missing | **New** endpoints |
| Challenge engines (digit/dual) | V1 only | **New** FastAPI challenge protocol |
| AI generate/list reports | V1 only | **New** FastAPI AI router (model exists) |
| PDF | Client HTML | Keep presentation; feed from FastAPI JSON |

---

## 8. Semantic mismatches (not path renames)

| Concern | V1 | V2 |
| --- | --- | --- |
| Join | `code` + `displayName` | `session_code` + `personal_code` → player JWT |
| Session URL key | join **code** | session **UUID** (+ rotatable code) |
| Create | title + slugs, immediately active | `player_ids` + `exercise_ids`, then `/start` |
| Close | `POST .../close` | `POST .../complete` / cancel |
| Soft delete | `archive` | `cancel` / `archived_at` field exists; API incomplete |
| Progress | `/api/players/:sessionPlayerId/progress` | Bearer player session |
| Coach results | `/dashboard` | Missing |

---

## 9. Proposed removal waves (after capability parity)

| Wave | Remove from Next | Prerequisite |
| --- | --- | --- |
| A | Session UI → `sessionsService` | Dashboard/results APIs or accepted UX change |
| B | Result submit + progress | Player JWT via BFF |
| C | Challenge routes | FastAPI challenge APIs |
| D | AI routes + `openai` dep | FastAPI AI router |
| E | Better Auth + proxy cookie gate | BFF httpOnly sessions |
| F | Neon/Drizzle/`DATABASE_URL`/`ws` | A–E complete + approval |

---

## 10. Checkpoint

**Phase 1 complete.** Nothing deleted.

**Next:** Phase 2 data migration plan (`DATA_MIGRATION_PLAN.md`).  
**Do not start Phase 3+ (auth BFF / route deletion) without explicit approval.**
