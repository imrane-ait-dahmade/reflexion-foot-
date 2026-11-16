# Track A — Auth BFF Preparation (no cutover)

**Status:** Scaffolded, unit-tested, and **integration-validated** (`AUTH_BFF_INTEGRATION_REPORT.md`). Better Auth + `StaffApiGate`/localStorage path **unchanged** as default. Cutover: **NO**.

## What was added

| Path | Role |
| --- | --- |
| `app/api/bff/auth/csrf/route.ts` | Issues CSRF cookie + token |
| `app/api/bff/auth/login/route.ts` | FastAPI login → httpOnly cookies; **no JWT in JSON** |
| `app/api/bff/auth/refresh/route.ts` | Refresh rotation via cookie |
| `app/api/bff/auth/logout/route.ts` | Revoke + clear cookies |
| `app/api/bff/auth/me/route.ts` | Session check (+ silent refresh) |
| `lib/server/auth/*` | Cookie options, CSRF, session helpers |
| `lib/server/backend/*` | Server-side FastAPI fetch |
| `lib/api/auth-bff.client.ts` | Opt-in browser client (no localStorage JWTs) |
| `lib/auth-bff/constants.ts` | Shared cookie/header names |

## Security properties

- Access + refresh cookies: **httpOnly**, `Secure` in production, `SameSite=Lax`
- Refresh cookie path limited to `/api/bff/auth`
- Double-submit CSRF (`ccf_csrf` + `x-csrf-token`) on mutating BFF auth routes
- `Cache-Control: no-store` on auth responses
- JWTs never returned to browser in BFF JSON bodies

## Explicitly not done

- Final authentication cutover
- Removal of Better Auth
- Switching `StaffApiGate` / `tokenStore` off
- Deleting localStorage JWT keys

## Next approval gate (before cutover)

1. Integration test BFF login/refresh/logout/me against running FastAPI  
2. Optional dual-run: StaffApiGate can call `authBffClient` behind a flag  
3. Only then retire `tokenStore` staff keys and change coach page gate
