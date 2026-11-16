# Players Management V2 — Deliverable

## 1. API audit

See `API_AUDIT.md`.

**Supported via FastAPI:** list/create/update/soft-deactivate players, positions catalog, multi positions, Excel import preview/confirm (duplicates surfaced), teams + assign/remove, notes, access-code rotate.

**Unsupported (UI labels only, no fake data):** clubs, player categories, hard delete, staff test history, performance charts, AI reports, team membership history listing.

## 2. Implemented UI

| Route | Purpose |
| --- | --- |
| `/coach/players` | Overview, search, filters, list, create, import |
| `/coach/players/[playerId]` | Profile, teams assign/remove, notes, archive, history stub |

Auth model:

- Page access: Better Auth coach cookie (unchanged)
- Data: FastAPI staff JWT (`StaffApiGate` + `authService`)

Same-origin Next rewrite `/api/v1/*` → FastAPI avoids CORS without backend changes.

## 3. Files created / modified

### Created

- `app/coach/players/page.tsx`
- `app/coach/players/[playerId]/page.tsx`
- `components/coach/players/*` (header, toolbar, filters, list, card, form, import, profile, history, gate, utils)
- `hooks/useStaffApiSession.ts`, `usePositions.ts`, `useTeams.ts`
- `unit/player-utils.test.ts`
- `docs/players-management-v2/*`

### Modified

- `components/coach/layout/CoachNavigation.tsx` — Joueurs enabled
- `components/coach/dashboard/CoachDashboard.tsx` — quick action link
- `proxy.ts` — protect `/coach/players`
- `next.config.ts` — `/api/v1` rewrite
- `lib/api/config.ts`, `lib/api/client.ts` — same-origin browser base
- `.env.example`

## 4. Screenshots

- `ipad-landscape-players-api-gate.png` (1194×834)
- `ipad-portrait-players-api-gate.png` (834×1194)

Captured with FastAPI offline → staff JWT gate (real integration state).

## 5. Test results

| Check | Result |
| --- | --- |
| TypeScript | pass |
| ESLint | pass (existing warnings only) |
| Vitest | **81/81** |
| `next build` | pass (`/coach/players` routes present) |

Live FastAPI validation: see `INTEGRATION_VALIDATION.md` (CRUD, import, screenshots with real data).

## 6. Unsupported backend operations

Clubs, categories, hard delete, staff results history, AI reports, inactive team-membership history API.

## 7. Remaining integration tasks

1. Start FastAPI + seed staff user; connect via Staff API gate.
2. Confirm rewrite proxy with live backend (`FASTAPI_PROXY_TARGET`).
3. Optional: unify Better Auth coach identity with FastAPI staff JWT.
4. When FastAPI adds clubs/categories/results, extend filters + `PlayerHistory`.
5. CORS still absent on FastAPI — keep Next rewrite (or enable CORS later without inventing endpoints).
