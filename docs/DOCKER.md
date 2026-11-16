# Docker — Cognitif Connexion Foot V2

## Services

| Service | Image | Role |
|---------|--------|------|
| `frontend` | Next.js 16 standalone (Node 22) | UI + V1 route handlers / Better Auth |
| `backend` | FastAPI + uvicorn (Python 3.12) | API `/api/v1` |
| `migrate` | same as backend | one-shot `alembic upgrade head` (V2 DB only) |
| `nginx` | nginx-unprivileged | HTTP reverse proxy (`80→8080`) |

No Postgres/Redis containers. Use **Neon** for tests (two DBs). RDS is the future AWS target.

## Files

- `frontend/Dockerfile`, `backend/Dockerfile`
- `docker-compose.yml` — local build
- `docker-compose.prod.yml` — GHCR images (EC2)
- `deploy/nginx/nginx.conf`
- `.env.example`

## Local

```bash
cp .env.example .env
# Set FRONTEND_DATABASE_URL (Neon V1) and BACKEND_DATABASE_URL (Neon V2)
# Set JWT_SECRET (>=32 chars) and BETTER_AUTH_SECRET

docker compose up --build
```

- App: http://localhost/
- API health: http://localhost/health
- API: http://localhost/api/v1/...

```bash
docker compose logs -f backend
docker compose ps
docker compose down
```

## Build images alone

```bash
docker build -t reflexion-foot-backend ./backend
docker build -t reflexion-foot-frontend ./frontend
```

## Resource limits (t3.small)

Compose sets approximate caps: backend 256MB, frontend 512MB, nginx 64MB.

## Notes

- `migrate` runs against `BACKEND_DATABASE_URL` only — never V1.
- Non-root users in app images; nginx unprivileged on 8080.
- HTTPS block is commented in nginx until a real domain/certs exist.
