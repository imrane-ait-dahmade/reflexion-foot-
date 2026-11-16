# Players Management V2 — Live FastAPI Integration Validation

Date: 2026-11-15  
Scope: connect existing UI to running FastAPI without schema / auth migration changes.

## 1. Backend endpoints tested

| Method | Path | Result |
| --- | --- | --- |
| GET | `/health` | healthy (`development`) |
| GET | `/openapi.json` | available (23 auth/players/teams/positions paths) |
| POST | `/api/v1/auth/login` | 200, `expires_in=900` |
| GET | `/api/v1/auth/me` | 200, admin + 19 permissions |
| GET | `/api/v1/players` (no token) | 401 |
| GET | `/api/v1/players` (invalid bearer) | 401 |
| GET | `/api/v1/positions` | 200, 10 positions |
| POST | `/api/v1/teams` | 200/201 created U17 A/B Integration |
| POST | `/api/v1/players` | created Lina Martin (CM + CAM) |
| POST | `/api/v1/teams/{id}/players` | multi-team assign |
| DELETE | `/api/v1/teams/{id}/players/{playerId}` | soft leave; player still GET-able |
| PATCH | `/api/v1/players/{id}` | jersey/nationality update |
| POST | `/api/v1/players/{id}/notes` | note created |
| POST | `/api/v1/players/{id}/access-code/rotate` | rotated |
| PATCH | `/api/v1/players/{id}/status` | archive → reactivate |
| POST | `/api/v1/players/import/preview` | valid/reject/duplicate counts |
| POST | `/api/v1/players/import/confirm` | created 2 from valid rows |
| GET | `http://localhost:3000/api/v1/positions` | Next rewrite proxy 200 |

Startup used:

- `alembic` already at `20261115_0006 (head)`
- `python -m app.shared.infrastructure.database.seed_runner` (idempotent, 0 inserts)
- Local staff user via existing repository pattern (same as API tests)
- `uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`

OpenAPI UI: `http://127.0.0.1:8000/docs`

## 2. Authentication flow

```
Browser /coach/*  → Better Auth cookie (page gate, unchanged)
StaffApiGate      → POST /api/v1/auth/login (via Next /api/v1 rewrite)
tokenStore        → staff access + refresh (localStorage keys ccf_v2_staff_*)
playersService/*  → Authorization: Bearer <access>
apiClient         → one refresh retry on 401
```

Verified: successful login, JWT length present, `expires_in=900` (15 min), unauthorized + invalid token → 401, admin permissions usable for players/teams/import.

Credentials and JWT values are **not** documented here.

## 3. Successful CRUD / membership ops

- Create player with primary + secondary positions
- Update profile fields
- Soft archive + reactivate
- Assign to two teams; remove one team; player identity remains
- Notes + access-code rotate
- UI list shows live roster (total **99** active after import + prior test data)
- Profile UI shows Lina Martin (`CM · CAM`, jersey 7, nationality FR)

## 4. Excel import results

Preview (4 data rows):

- `valid_count=2`
- `reject_count=1` (invalid position code)
- `duplicate_count=1` (existing Lina Martin email/name)

Confirm:

- `created_count=2` (Noah Dupont, Emma Bernard)
- duplicates not silently imported

## 5. Screenshots (real backend data)

| File | Content |
| --- | --- |
| `ipad-landscape-players-live.png` | Live list (Emma Bernard, filters, FastAPI note) |
| `ipad-portrait-players-live.png` | Portrait with total 99 + actions |
| `ipad-landscape-player-profile-live.png` | Lina Martin profile + teams/notes |

## 6. Data integrity vs product rules

| Requirement | Backend reality |
| --- | --- |
| Multiple teams | **Yes** — multiple active `TeamPlayer` memberships |
| Multiple clubs | **No** — clubs API/model absent |
| Multiple positions | **Yes** — primary + secondary_position_ids |
| Test history survives team change | **Partially guaranteed** — player row + soft-leave membership history remain; **no staff HTTP API** to list results/history |

## 7. Remaining issues

1. Dual auth (Better Auth + FastAPI JWT) still required for Players screens.
2. Staff JWTs currently in `localStorage` (XSS-sensitive) — do not migrate yet; see architecture below.
3. DB contains many players from prior API tests (noisy roster).
4. Controlled search input may need native input events for some automation tools (manual/search UX OK).
5. Next.js 16.4 security nudge remains on build/dev.
6. FastAPI CORS still absent — Next rewrite remains the browser path.

## 8. Recommended next phase

1. **Auth unification design** (no code yet): BFF session cookie issuing FastAPI access via httpOnly cookies, or Federated Better Auth → staff JWT exchange.
2. Optional roster hygiene script for local TEST DB only.
3. When FastAPI adds results/clubs/categories, extend `PlayerHistory` / filters.
4. Only then start another major UI surface (Player Experience).

## Auth architecture recommendation (no migration performed)

**Current:** Coach page protection via Better Auth cookies; Players data via FastAPI Bearer JWT in localStorage (`StaffApiGate`). Works for local integration; splits identity and stores tokens in JS-readable storage.

**Long-term (recommended):**

1. Keep FastAPI as source of truth for staff RBAC/permissions.
2. Introduce a Next.js BFF route that performs FastAPI login/refresh and sets **httpOnly Secure SameSite** cookies for access/refresh (or a single opaque session).
3. Frontend `apiClient` calls same-origin `/api/v1` without reading JWTs in JS.
4. Optionally map Better Auth coach identity → FastAPI staff user via a one-time link table / email match during migration.
5. Retire `StaffApiGate` + `tokenStore` staff keys after BFF is verified.

Migration requirements: shared identity mapping, cookie CSRF strategy for mutating requests, refresh rotation parity with FastAPI, staged cutover per coach route, revoke plan for localStorage tokens.
