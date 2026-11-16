# Phase A2 — Auth BFF Integration Validation Report

**Status:** PASSED (18/18 real HTTP scenarios)  
**Cutover authorized:** **NO**  
**Stamp:** `20261116T003330Z`  
**Evidence:** `runs/auth-bff-20261116T003330Z/integration_results.json`

---

## 1. Environment identification

| Check | Evidence |
| --- | --- |
| Target DB | `ep-icy-river-…` / `cognitif_connexion_foot_v2` |
| Fingerprint | `b5fa9f5099b4b4ee` (matches prior dry-run V2 TEST) |
| APP_ENV | `development` (backend health + settings) |
| FastAPI | `http://127.0.0.1:8000` — `/health` → `cognitif-connexion-foot-api`, `environment: development` |
| Next BFF | `http://127.0.0.1:3000` — production `next start` with `FASTAPI_PROXY_TARGET=http://127.0.0.1:8000` |
| V1 Neon | Not used for auth calls |

Stop rule satisfied: identities positively identified as V2 TEST / development before account provisioning and BFF calls.

Dedicated TEST accounts (created only on V2 TEST DB):

| Account | Role | Purpose |
| --- | --- | --- |
| `bff.integration.coach@v2-test.lab` | coach | Happy-path login / me / refresh / logout |
| `bff.integration.limited@v2-test.lab` | staff | RBAC denial for `users.manage` |

Passwords are not recorded in this report.

---

## 2. Test scenarios and results

Runner: `docs/migration-v1-v2/scripts/auth_bff_integration.mjs` (real `fetch` against Next + FastAPI — **no mocks**).

| ID | Result | Notes |
| --- | --- | --- |
| `env.fastapi_reachable` | PASS | Health JSON healthy |
| `env.next_bff_reachable` | PASS | `/api/bff/auth/csrf` 200 |
| `csrf.issue_cookie` | PASS | Readable CSRF cookie + token |
| `csrf.reject_login_without_header` | PASS | 403 `Invalid CSRF token` |
| `login.bad_credentials` | PASS | 401 |
| `login.success_httponly_no_jwt_body` | PASS | User + cookies; no JWT in JSON |
| `me.authenticated` | PASS | Email + `coach` role |
| `me.unauthenticated_rejected` | PASS | 401, `user: null` |
| `me.access_invalid_triggers_refresh` | PASS | Invalid access → silent refresh → 200 |
| `refresh.token_rotation` | PASS | Access + refresh values changed |
| `refresh.invalid_clears_session` | PASS | 401 + cookies cleared |
| `jwt.access_cookie_has_exp_sub` | PASS | JWT only inside httpOnly cookie |
| `rbac.limited_staff_denied_users_manage` | PASS | FastAPI `/users` → 403 |
| `rbac.coach_users_endpoint_authz` | PASS | Coach `/users` → 403 (no `users.manage`) |
| `logout.clears_cookies` | PASS | Access + refresh removed |
| `me.after_logout_rejected` | PASS | 401 |
| `compat.bff_is_opt_in_parallel` | PASS | Paths unchanged for Better Auth / localStorage |
| `cookie.secure_on_production_server` | PASS | `Secure` present under production `next start` |

**Score: 18/18 passed, 0 failed, 0 skipped.**

---

## 3. Cookie security configuration

Observed `Set-Cookie` flags on production server (`NODE_ENV=production`):

| Cookie | HttpOnly | Secure | SameSite | Path | Max-Age |
| --- | --- | --- | --- | --- | --- |
| `ccf_staff_access` | true | true | Lax | `/` | 900 |
| `ccf_staff_refresh` | true | true | Lax | `/api/bff/auth` | 1209600 |
| `ccf_csrf` | false | true | Lax | `/` | 28800 |

Unit coverage (`unit/auth-bff-cookies.test.ts`): Secure on/off by `NODE_ENV`, SameSite=Lax, HttpOnly policy.

---

## 4. CSRF validation evidence

- CSRF issued via `GET /api/bff/auth/csrf`.
- Mutating login without `x-csrf-token` → **403**.
- Double-submit cookie `ccf_csrf` + header required for login / refresh / logout.

---

## 5. JWT lifecycle behavior

| Stage | Behavior verified |
| --- | --- |
| Login | FastAPI issues access + refresh; BFF stores both in httpOnly cookies; **JSON omits tokens** |
| Access use | `/me` calls FastAPI with cookie-derived Bearer |
| Access invalid/expired | `/me` attempts refresh using refresh cookie; rotates cookies |
| Refresh rotation | Explicit `POST /api/bff/auth/refresh` returns new cookies; old refresh invalidated server-side (FastAPI family rotation) |
| Refresh failure | Invalid refresh → 401 + cookie clear |
| Logout | FastAPI logout best-effort + cookies cleared |
| Browser storage | BFF client does not write JWTs to `localStorage` (opt-in `authBffClient` only) |

Natural clock-wait for 15-minute access expiry was not used; invalid-access + refresh path exercises the same recovery code as expiry.

---

## 6. RBAC validation

| Actor | `/api/bff/auth/me` | `GET /api/v1/users` |
| --- | --- | --- |
| Coach | 200, roles `[coach]` | **403** (lacks `users.manage`) |
| Limited staff | 200, roles `[staff]` | **403** |

Authorization is enforced by FastAPI permissions. BFF `/me` returns identity for any authenticated staff account; it does **not** yet gate “coach-only UI” roles.

---

## 7. Compatibility with existing authentication

| System | Status |
| --- | --- |
| Better Auth | Unchanged (`better-auth` imports / `proxy.ts` intact) |
| `authService` + `tokenStore` localStorage path | Unchanged; still used by `useStaffApiSession` / `StaffApiGate` |
| BFF | Opt-in under `/api/bff/auth/*` only — no redirect of existing users |

Existing unit tests for `authService` / `tokenStore` remain part of the Vitest suite.

---

## 8. Known limitations

1. **No final cutover** — coach UI still uses localStorage JWTs by default.  
2. **No staff-role gate on BFF login** — any FastAPI-authenticated staff can obtain BFF cookies.  
3. **No full HTTPS termination in this lab** — Secure flags verified via production `next start` Set-Cookie + unit tests, not via a TLS reverse proxy.  
4. **Access TTL clock wait** — 15-minute natural expiry not wall-clock tested; invalid-access refresh path covered instead.  
5. **BFF does not yet proxy dashboard/session APIs** — Track B still required.  
6. **Dedicated Neon branch clone** was not created; target is the identified V2 development/TEST database (same fingerprint as dry-run).

---

## 9. Remaining blockers before any future cutover

1. Feature-flag / dual-run wiring so `StaffApiGate` can optionally use `authBffClient` without removing Better Auth.  
2. Explicit staff/coach role checks at BFF boundary (if product requires).  
3. Integration on HTTPS staging with Secure cookies + real browsers.  
4. Track B session/dashboard APIs behind BFF auth.  
5. Explicit approval checkpoint for cutover (must remain **NO** until then).

---

## 10. Quality gates

| Gate | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | **PASS** (`TSC_EXIT=0`) |
| ESLint (BFF paths, `--max-warnings 0`) | **PASS** (`ESLINT_EXIT=0`) |
| Vitest (full suite) | **PASS** — 13 files / 87 tests (`VITEST_EXIT=0`) |
| Auth BFF HTTP integration | **PASS** — 18/18 real HTTP |
| Frontend production build (`npm run build`) | **PASS** (used for `next start` validation) |

---

## Scripts added for reproducibility

- `scripts/ensure_bff_test_users.py` — identity guard + TEST account upsert  
- `scripts/auth_bff_integration.mjs` — real HTTP integration runner
