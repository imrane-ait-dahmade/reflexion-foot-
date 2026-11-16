# Frontend ↔ FastAPI Integration

Prepared for Cognitif Connexion Foot V2. This layer sits **alongside** the existing Next.js Route Handlers (V1). It does not replace Better Auth, exercises, or AI reports yet.

## Architecture

```
React UI / future V2 pages
        │
        ▼
 hooks (usePlayers, useSessions, useExercises)
        │
        ▼
 domain services (lib/api/*.service.ts)
        │
        ▼
 apiRequest / apiClient (lib/api/client.ts)
        │  Authorization: Bearer <JWT>
        ▼
 FastAPI  /api/v1/...
```

V1 Coach/Player UI continues to call `/api/...` Next.js routes. Do not switch UI fetches until FastAPI coverage and auth migration are verified.

## Environment

| Variable | Scope | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_API_URL` | Public | FastAPI origin, e.g. `http://127.0.0.1:8000` |
| `DATABASE_URL` | Server-only | V1 Neon (unchanged) |
| `BETTER_AUTH_*` | Server-only | V1 coach auth (unchanged) |
| `OPENAI_*` / `AI_ANALYSIS_*` | Server-only | V1 AI reports (unchanged) |

Never put `JWT_SECRET` or database credentials in `NEXT_PUBLIC_*`.

## Authentication (FastAPI)

Discovered mechanism: **JWT Bearer**, not HTTP-only cookies.

### Staff

1. `POST /api/v1/auth/login` → `{ access_token, refresh_token, expires_in, user }`
2. Send `Authorization: Bearer <access_token>` on protected routes.
3. Access tokens expire (~15 minutes per backend settings).
4. `POST /api/v1/auth/refresh` with `{ refresh_token }` rotates tokens.
5. `POST /api/v1/auth/logout` (authenticated) revokes refresh token(s).

Frontend helpers:

- `authService.login / refresh / logout / me`
- `tokenStore` persists staff access + refresh in `localStorage` (keys `ccf_v2_staff_*`)
- `apiClient` retries once on **401** for staff by calling refresh

### Player session

1. `POST /api/v1/player/session/join` with `{ personal_code, session_code }`
2. Returns a **player** JWT (`type: player_session` on backend).
3. Subsequent player routes use `Authorization: Bearer <player access_token>`.
4. Stored in `tokenStore` as `ccf_v2_player_access`.

### Migration vs Better Auth (V1)

| Concern | V1 (current UI) | V2 (this layer) |
|---------|-----------------|-----------------|
| Coach login | Better Auth cookies | FastAPI JWT |
| Token store | Cookies | localStorage + Bearer |
| Protected pages | `requireCoach()` + proxy | Future: JWT gate |

**Strategy:** keep Better Auth until a V2 coach login page is verified against FastAPI. Then migrate coach screens to `authService` one route at a time. Player V1 join (`/api/sessions/join`) stays until player FastAPI join is wired.

## Available FastAPI endpoints

Prefix: `/api/v1` (plus `/` and `/health` on the app root).

### Auth / users

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/change-password`
- `GET|POST /users`, `GET|PATCH /users/{id}`, `PATCH .../status`, `PUT .../roles`

### Players / positions

- `GET /positions`
- `GET|POST /players`, import preview/confirm, CRUD-ish updates, notes, access-code rotate

### Teams

- Full team CRUD + staff/player membership routes

### Sessions / cognitive tests / player session

- `GET /cognitive-tests`
- Staff: list/create/get sessions, players, exercises, start/complete/cancel, rotate code
- Player: join, progress, start/complete exercise

### Missing on FastAPI HTTP API

- Dedicated **results** listing/analytics routes
- Dedicated **AI reports** routes (models/permissions exist; no router mounted)
- **Clubs** / player **categories**
- **CORS** middleware is not configured in `main.py`

**Browser workaround (frontend-only):** Next.js rewrites `/api/v1/:path*` to FastAPI (`next.config.ts` + `FASTAPI_PROXY_TARGET`). Client `getApiBaseUrl()` uses same-origin unless `NEXT_PUBLIC_API_DIRECT=true`.

## Service organization

| File | Responsibility |
|------|----------------|
| `auth.service.ts` | Staff auth + user admin |
| `players.service.ts` | Players, positions, import, notes |
| `sessions.service.ts` | Staff sessions + player join/progress |
| `exercises.service.ts` | Cognitive tests catalogue |
| `results.service.ts` | Thin wrapper → player complete exercise |
| `reports.service.ts` | Explicit unavailable stub |
| `teams.service.ts` | Teams (backend-ready) |

## Error handling

`ApiError` with codes: `validation_error`, `authentication_error`, `authorization_error`, `not_found`, `conflict`, `server_error`, `network_error`, `timeout`.

Backend bodies `{ detail, code }` are preserved when present.

## Local development

1. Start FastAPI (example): `uvicorn app.main:app --reload --port 8000` from the backend folder.
2. Set `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in frontend `.env.local`.
3. Ensure backend CORS allows the Next origin (currently missing — needs a backend change later).
4. Run Next: `npm run dev`.
5. Call services from experiments/scripts; do not point production UI at FastAPI until migration steps are done.

### OpenAPI

When the API is up: `GET http://127.0.0.1:8000/openapi.json` and `/docs`.  
Types in `lib/api/types.ts` were hand-aligned from Pydantic schemas because OpenAPI was unreachable during scaffolding. Prefer regenerating types from OpenAPI in a later task.

## Future migration plan

1. Add CORS on FastAPI for the frontend origin.
2. Verify staff login + refresh + me via `authService`.
3. Build V2 coach pages on FastAPI services (players → teams → sessions).
4. Wire player join/progress to `sessionsService.player*`.
5. Keep V1 exercise engines; only change result submission when FastAPI parity is confirmed.
6. Migrate AI reports when FastAPI report endpoints exist.
7. Retire Better Auth + Next Route Handlers after parity and soak tests.
