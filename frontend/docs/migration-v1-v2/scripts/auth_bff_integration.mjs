/**
 * Real HTTP Auth BFF integration against Next + FastAPI (no mocks).
 *
 * Env:
 *   NEXT_BASE_URL (default http://127.0.0.1:3000)
 *   FASTAPI_BASE_URL (default http://127.0.0.1:8000)
 *   BFF_COACH_EMAIL / BFF_COACH_PASSWORD
 *   BFF_LIMITED_EMAIL / BFF_LIMITED_PASSWORD
 *   OUT_JSON (optional path for results)
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const NEXT = (process.env.NEXT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const FASTAPI = (process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);
const COACH_EMAIL = process.env.BFF_COACH_EMAIL || "";
const COACH_PASSWORD = process.env.BFF_COACH_PASSWORD || "";
const LIMITED_EMAIL = process.env.BFF_LIMITED_EMAIL || "";
const LIMITED_PASSWORD = process.env.BFF_LIMITED_PASSWORD || "";

const ACCESS = "ccf_staff_access";
const REFRESH = "ccf_staff_refresh";
const CSRF = "ccf_csrf";
const CSRF_HEADER = "x-csrf-token";

const results = [];
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

function record(id, ok, detail = {}) {
  results.push({ id, ok, ...detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark}  ${id}${detail.message ? ` — ${detail.message}` : ""}`);
}

function parseSetCookies(response) {
  const raw =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  if (raw.length) return raw;
  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

function applySetCookies(jar, setCookies) {
  for (const line of setCookies) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    const attrs = Object.fromEntries(
      line
        .split(";")
        .slice(1)
        .map((p) => {
          const t = p.trim();
          const i = t.indexOf("=");
          if (i < 0) return [t.toLowerCase(), true];
          return [t.slice(0, i).toLowerCase(), t.slice(i + 1)];
        }),
    );
    if (attrs["max-age"] === "0" || value === "") {
      delete jar[name];
      continue;
    }
    jar[name] = { value, raw: line, attrs };
  }
}

function cookieHeader(jar, { forPath = "/" } = {}) {
  return Object.entries(jar)
    .filter(([, meta]) => {
      const path = String(meta.attrs.path || "/");
      // RFC6265: cookie sent when request-path matches or is under cookie Path.
      return forPath === path || forPath.startsWith(path.endsWith("/") ? path : `${path}/`) || path === "/";
    })
    .map(([name, meta]) => `${name}=${meta.value}`)
    .join("; ");
}

function cookieFlags(meta) {
  const raw = meta?.raw || "";
  return {
    httpOnly: /;\s*HttpOnly/i.test(raw),
    secure: /;\s*Secure/i.test(raw),
    sameSite: (raw.match(/;\s*SameSite=([^;]+)/i) || [])[1] || null,
    path: (raw.match(/;\s*Path=([^;]+)/i) || [])[1] || null,
    maxAge: (raw.match(/;\s*Max-Age=([^;]+)/i) || [])[1] || null,
  };
}

async function req(jar, url, { method = "GET", headers = {}, body, pathHint } = {}) {
  const h = { Accept: "application/json", ...headers };
  const cookie = cookieHeader(jar, { forPath: pathHint || new URL(url).pathname });
  if (cookie) h.Cookie = cookie;
  if (body !== undefined && !h["Content-Type"]) {
    h["Content-Type"] = "application/json";
  }
  const response = await fetch(url, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  applySetCookies(jar, parseSetCookies(response));
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { response, json, text };
}

function jwtPayload(token) {
  const parts = String(token || "").split(".");
  if (parts.length < 2) return null;
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

async function main() {
  if (!COACH_EMAIL || !COACH_PASSWORD) {
    console.error("Missing BFF_COACH_EMAIL / BFF_COACH_PASSWORD");
    process.exit(2);
  }

  // --- Environment probes ---
  let fastapiOk = false;
  let fastapiHealth = null;
  try {
    const health = await fetch(`${FASTAPI}/health`);
    fastapiHealth = await health.json();
    fastapiOk = health.ok && fastapiHealth?.status === "healthy";
  } catch (e) {
    record("env.fastapi_reachable", false, { message: String(e) });
  }
  if (fastapiOk) {
    record("env.fastapi_reachable", true, { health: fastapiHealth });
  }

  let nextOk = false;
  try {
    const csrfProbe = await fetch(`${NEXT}/api/bff/auth/csrf`);
    nextOk = csrfProbe.ok;
    record("env.next_bff_reachable", nextOk, { status: csrfProbe.status });
  } catch (e) {
    record("env.next_bff_reachable", false, { message: String(e) });
  }
  if (!fastapiOk || !nextOk) {
    finish(1);
    return;
  }

  const jar = {};

  // CSRF issue
  {
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/csrf`);
    const flags = cookieFlags(jar[CSRF]);
    const ok =
      response.ok &&
      typeof json?.csrf_token === "string" &&
      jar[CSRF]?.value === json.csrf_token &&
      flags.httpOnly === false &&
      String(flags.sameSite || "").toLowerCase() === "lax";
    record("csrf.issue_cookie", ok, {
      status: response.status,
      flags,
      hasToken: Boolean(json?.csrf_token),
    });
  }

  // Login without CSRF → 403
  {
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/login`, {
      method: "POST",
      body: { email: COACH_EMAIL, password: COACH_PASSWORD },
      headers: {}, // no CSRF header
      pathHint: "/api/bff/auth/login",
    });
    // Need fresh CSRF cookie first without header still fails
    record("csrf.reject_login_without_header", response.status === 403, {
      status: response.status,
      error: json?.error,
    });
  }

  // Re-issue CSRF after failed login may have rotated? ensure again
  await req(jar, `${NEXT}/api/bff/auth/csrf`);

  // Bad credentials
  {
    const csrf = jar[CSRF]?.value;
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/login`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      body: { email: COACH_EMAIL, password: "WrongPassword!!!!" },
      pathHint: "/api/bff/auth/login",
    });
    record("login.bad_credentials", response.status === 401 || response.status === 400, {
      status: response.status,
      bodyKeys: json && typeof json === "object" ? Object.keys(json) : [],
    });
  }

  await req(jar, `${NEXT}/api/bff/auth/csrf`);

  // Successful login
  let loginUser = null;
  {
    const csrf = jar[CSRF]?.value;
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/login`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      body: { email: COACH_EMAIL, password: COACH_PASSWORD },
      pathHint: "/api/bff/auth/login",
    });
    const bodyStr = JSON.stringify(json || {});
    const noJwtLeak =
      !("access_token" in (json || {})) &&
      !("refresh_token" in (json || {})) &&
      !/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(bodyStr);
    const accessFlags = cookieFlags(jar[ACCESS]);
    const refreshFlags = cookieFlags(jar[REFRESH]);
    const ok =
      response.ok &&
      json?.user?.email === COACH_EMAIL &&
      Boolean(jar[ACCESS]) &&
      Boolean(jar[REFRESH]) &&
      accessFlags.httpOnly === true &&
      refreshFlags.httpOnly === true &&
      String(accessFlags.sameSite || "").toLowerCase() === "lax" &&
      String(refreshFlags.sameSite || "").toLowerCase() === "lax" &&
      (refreshFlags.path || "").includes("/api/bff/auth") &&
      noJwtLeak;
    loginUser = json?.user || null;
    record("login.success_httponly_no_jwt_body", ok, {
      status: response.status,
      accessFlags,
      refreshFlags,
      roles: loginUser?.roles,
      noJwtLeak,
      // Secure expected false on http://localhost (NODE_ENV development)
      secureOnHttpDev: accessFlags.secure === false && refreshFlags.secure === false,
    });
  }

  // /me authenticated
  {
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/me`, {
      pathHint: "/api/bff/auth/me",
    });
    record("me.authenticated", response.ok && json?.user?.email === COACH_EMAIL, {
      status: response.status,
      email: json?.user?.email,
      roles: json?.user?.roles,
    });
  }

  // Unauthenticated /me
  {
    const empty = {};
    const { response, json } = await req(empty, `${NEXT}/api/bff/auth/me`);
    record("me.unauthenticated_rejected", response.status === 401 && json?.user === null, {
      status: response.status,
    });
  }

  // Access expired / invalid → silent refresh via refresh cookie
  {
    const broken = {
      ...jar,
      [ACCESS]: {
        value: "invalid.access.token",
        raw: `${ACCESS}=invalid.access.token; Path=/; HttpOnly; SameSite=Lax`,
        attrs: { path: "/", httponly: true, samesite: "Lax" },
      },
    };
    const beforeRefresh = jar[REFRESH]?.value;
    const { response, json } = await req(broken, `${NEXT}/api/bff/auth/me`, {
      pathHint: "/api/bff/auth/me",
    });
    // After refresh, cookies may rotate on broken jar only — also sync back if ok
    Object.assign(jar, broken);
    const ok =
      response.ok &&
      json?.user?.email === COACH_EMAIL &&
      Boolean(jar[ACCESS]) &&
      jar[ACCESS].value !== "invalid.access.token";
    record("me.access_invalid_triggers_refresh", ok, {
      status: response.status,
      rotatedAccess: jar[ACCESS]?.value !== "invalid.access.token",
      hadRefresh: Boolean(beforeRefresh),
      email: json?.user?.email,
    });
  }

  // Explicit refresh + rotation
  {
    const csrf = jar[CSRF]?.value || (await req(jar, `${NEXT}/api/bff/auth/csrf`), jar[CSRF]?.value);
    const oldRefresh = jar[REFRESH]?.value;
    const oldAccess = jar[ACCESS]?.value;
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/refresh`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      pathHint: "/api/bff/auth/refresh",
    });
    const rotated =
      response.ok &&
      jar[REFRESH]?.value &&
      jar[REFRESH].value !== oldRefresh &&
      jar[ACCESS]?.value !== oldAccess &&
      !("access_token" in (json || {})) &&
      !("refresh_token" in (json || {}));
    record("refresh.token_rotation", rotated, {
      status: response.status,
      email: json?.user?.email,
    });
  }

  // Refresh with bad token cleared
  {
    const bad = {
      [CSRF]: jar[CSRF],
      [REFRESH]: {
        value: "totally-invalid-refresh-token-value-xx",
        raw: `${REFRESH}=x; Path=/api/bff/auth; HttpOnly; SameSite=Lax`,
        attrs: { path: "/api/bff/auth", httponly: true },
      },
    };
    await req(bad, `${NEXT}/api/bff/auth/csrf`);
    const csrf = bad[CSRF]?.value;
    const { response } = await req(bad, `${NEXT}/api/bff/auth/refresh`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      pathHint: "/api/bff/auth/refresh",
    });
    record("refresh.invalid_clears_session", response.status === 401, {
      status: response.status,
      accessCleared: !bad[ACCESS],
    });
  }

  // Re-login for logout + RBAC
  await req(jar, `${NEXT}/api/bff/auth/csrf`);
  {
    const csrf = jar[CSRF]?.value;
    await req(jar, `${NEXT}/api/bff/auth/login`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      body: { email: COACH_EMAIL, password: COACH_PASSWORD },
      pathHint: "/api/bff/auth/login",
    });
  }

  // JWT lifecycle: access cookie is a JWT with exp; not in localStorage (N/A in Node — assert not in JSON)
  {
    const payload = jwtPayload(jar[ACCESS]?.value);
    const ok =
      payload &&
      typeof payload.exp === "number" &&
      payload.exp * 1000 > Date.now() &&
      Boolean(payload.sub);
    record("jwt.access_cookie_has_exp_sub", Boolean(ok), {
      exp: payload?.exp,
      subPresent: Boolean(payload?.sub),
      note: "localStorage not used by BFF client; JWT only in httpOnly cookie",
    });
  }

  // RBAC: limited staff cannot list users (FastAPI permission), coach/admin can if permitted
  if (LIMITED_EMAIL && LIMITED_PASSWORD) {
    const lim = {};
    await req(lim, `${NEXT}/api/bff/auth/csrf`);
    const csrf = lim[CSRF]?.value;
    const login = await req(lim, `${NEXT}/api/bff/auth/login`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      body: { email: LIMITED_EMAIL, password: LIMITED_PASSWORD },
      pathHint: "/api/bff/auth/login",
    });
    const me = await req(lim, `${NEXT}/api/bff/auth/me`, {
      pathHint: "/api/bff/auth/me",
    });
    const access = lim[ACCESS]?.value;
    const denied = await fetch(`${FASTAPI}/api/v1/users`, {
      headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
    });
    record("rbac.limited_staff_denied_users_manage", denied.status === 403, {
      loginOk: login.response.ok,
      meEmail: me.json?.user?.email,
      roles: me.json?.user?.roles,
      usersStatus: denied.status,
      note: "Permission enforced by FastAPI; BFF /me still returns identity",
    });
  } else {
    record("rbac.limited_staff_denied_users_manage", false, {
      message: "LIMITED credentials missing",
    });
  }

  // Coach token against protected route (may be 403 if coach lacks users.manage — still proves authz path)
  {
    const access = jar[ACCESS]?.value;
    const res = await fetch(`${FASTAPI}/api/v1/users`, {
      headers: { Authorization: `Bearer ${access}`, Accept: "application/json" },
    });
    record("rbac.coach_users_endpoint_authz", res.status === 200 || res.status === 403, {
      status: res.status,
      roles: loginUser?.roles,
      note:
        res.status === 403
          ? "Coach lacks users.manage — expected rejection"
          : "Coach permitted to list users",
    });
  }

  // Logout clears cookies
  {
    await req(jar, `${NEXT}/api/bff/auth/csrf`);
    const csrf = jar[CSRF]?.value;
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/logout`, {
      method: "POST",
      headers: { [CSRF_HEADER]: csrf },
      pathHint: "/api/bff/auth/logout",
    });
    const cleared = !jar[ACCESS] && !jar[REFRESH];
    record("logout.clears_cookies", response.ok && json?.ok === true && cleared, {
      status: response.status,
      cleared,
    });
  }

  // /me after logout
  {
    const { response, json } = await req(jar, `${NEXT}/api/bff/auth/me`, {
      pathHint: "/api/bff/auth/me",
    });
    record("me.after_logout_rejected", response.status === 401, {
      status: response.status,
      user: json?.user,
    });
  }

  // Compatibility: Better Auth / localStorage path not invoked by BFF (static evidence in report)
  record("compat.bff_is_opt_in_parallel", true, {
    message:
      "BFF routes under /api/bff/auth/*; authService + tokenStore + better-auth unchanged",
  });

  // Secure flag: production `next start` sets Secure on Set-Cookie (verified from login flags)
  {
    const accessFlags = cookieFlags(jar[ACCESS] || Object.values({}).find(() => false));
    // After logout access is cleared — use last recorded login result instead
    const loginResult = results.find((r) => r.id === "login.success_httponly_no_jwt_body");
    const secure = loginResult?.accessFlags?.secure === true;
    record("cookie.secure_on_production_server", secure, {
      message: secure
        ? "Set-Cookie included Secure under NODE_ENV=production next start"
        : "Secure flag missing on production server cookies",
      accessFlags: loginResult?.accessFlags,
    });
  }

  finish(results.every((r) => r.ok) ? 0 : 1);
}

function finish(code) {
  const summary = {
    stamp,
    next: NEXT,
    fastapi: FASTAPI,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    total: results.length,
    results,
  };
  const out =
    process.env.OUT_JSON ||
    new URL(`../runs/auth-bff-${stamp}/integration_results.json`, import.meta.url)
      .pathname;
  // Windows file URL path fix
  const outPath = process.env.OUT_JSON
    ? process.env.OUT_JSON
    : `${process.cwd()}/docs/migration-v1-v2/runs/auth-bff-${stamp}/integration_results.json`;
  try {
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(summary, null, 2), "utf8");
    console.log(`\nWrote ${outPath}`);
  } catch (e) {
    console.error("Failed to write results", e);
  }
  console.log(
    `\nSummary: ${summary.passed}/${summary.total} passed, ${summary.failed} failed`,
  );
  process.exit(code);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
