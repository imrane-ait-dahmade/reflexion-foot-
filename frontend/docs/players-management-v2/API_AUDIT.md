# Players Management V2 — FastAPI API Audit

Base prefix: `/api/v1`

## Supported

| Capability | Endpoint(s) |
| --- | --- |
| List players | `GET /players` (`search`, `primary_position_id`, `is_active`, pagination) |
| Create player | `POST /players` |
| Get / update player | `GET|PATCH /players/{id}` |
| Soft deactivate | `PATCH /players/{id}/status` |
| Positions catalog | `GET /positions` |
| Multi positions | `primary_position_id` + `secondary_position_ids` |
| Import preview/confirm | `POST /players/import/preview`, `.../confirm` |
| Teams | `GET|POST /teams`, `PATCH`, status |
| Assign / remove team players | `POST|DELETE /teams/{id}/players[/{playerId}]` |
| Notes | `GET|POST /players/{id}/notes`, patch/delete note |
| Access code rotate | `POST /players/{id}/access-code/rotate` |

## Unsupported (not invented in UI)

| Capability | Status |
| --- | --- |
| Clubs | No router / model |
| Player categories (U15…) | No API (only cognitive-test `category`) |
| Hard delete player | Soft archive only |
| Player test history (staff) | No results list router |
| Performance evolution | No API |
| AI reports by player | Reports router not mounted |
| Team membership history list | DB keeps `left_at`; API lists active only |
| Position CRUD | Read-only catalog |

## Frontend integration notes

- Coach pages stay behind Better Auth (`requireCoach`).
- Players data uses FastAPI staff JWT via `authService` + `tokenStore`.
- Browser calls go same-origin `/api/v1/*` rewritten to FastAPI (`next.config.ts`) to avoid CORS without backend changes.
