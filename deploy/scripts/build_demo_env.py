"""Build local/demo .env from existing backend/frontend env files (never print secrets)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def get(path: Path, key: str) -> str:
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8", errors="ignore")
    match = re.search(rf"^{re.escape(key)}=(.*)$", text, re.M)
    if not match:
        return ""
    return match.group(1).strip().strip('"').strip("'")


def main() -> None:
    be = ROOT / "backend" / ".env"
    fe = ROOT / "frontend" / ".env.local"
    out = ROOT / ".env"
    vals = {
        "APP_NAME": "Cognitif Connexion Foot 2.0",
        "APP_ENV": "staging",
        "DEBUG": "false",
        "API_V1_PREFIX": "/api/v1",
        "APP_VERSION": "0.1.0",
        "LOG_LEVEL": "INFO",
        "HTTP_PORT": "8088",
        "GHCR_OWNER": "imrane-ait-dahmade",
        "IMAGE_TAG": "demo-local",
        "BACKEND_DATABASE_URL": get(be, "DATABASE_URL"),
        "JWT_SECRET": get(be, "JWT_SECRET"),
        "JWT_ALGORITHM": "HS256",
        "JWT_ISSUER": get(be, "JWT_ISSUER") or "cognitif-connexion-foot-v2",
        "JWT_AUDIENCE": get(be, "JWT_AUDIENCE") or "cognitif-connexion-foot-api",
        "ACCESS_TOKEN_EXPIRE_MINUTES": "15",
        "REFRESH_TOKEN_EXPIRE_DAYS": "14",
        "DB_ECHO": "false",
        "FRONTEND_DATABASE_URL": get(fe, "DATABASE_URL"),
        "BETTER_AUTH_SECRET": get(fe, "BETTER_AUTH_SECRET"),
        "BETTER_AUTH_URL": "http://localhost:8088",
        "NEXT_PUBLIC_API_URL": "",
        "AI_ANALYSIS_ENABLED": "true",
        "OPENAI_API_KEY": get(fe, "OPENAI_API_KEY") or get(be, "OPENAI_API_KEY"),
        "OPENAI_MODEL": get(fe, "OPENAI_MODEL") or get(be, "OPENAI_MODEL") or "gpt-4.1-mini",
        "AI_ANALYSIS_TIMEOUT_SECONDS": "90",
        "AI_ANALYSIS_MAX_RETRIES": "1",
    }
    optional = {"NEXT_PUBLIC_API_URL", "DB_ECHO"}
    missing = [k for k, v in vals.items() if not v and k not in optional]
    print("missing", missing)
    print("has_backend_db", bool(vals["BACKEND_DATABASE_URL"]))
    print("has_frontend_db", bool(vals["FRONTEND_DATABASE_URL"]))
    print("has_jwt", bool(vals["JWT_SECRET"]))
    print("has_openai", bool(vals["OPENAI_API_KEY"]))
    print("has_better_auth", bool(vals["BETTER_AUTH_SECRET"]))
    out.write_text("\n".join(f"{k}={v}" for k, v in vals.items()) + "\n", encoding="utf-8")
    print("wrote", out, "bytes", out.stat().st_size)


if __name__ == "__main__":
    main()
