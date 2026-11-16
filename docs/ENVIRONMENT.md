# Environment variables

Never commit real `.env` files. Template: repository root `.env.example`.  
On EC2 staging the live file is **`/opt/cognitif-connexion/app/.env`** (created once by an operator; deploy only updates `IMAGE_TAG`).

## Two databases (required)

| Variable | Mapped to | Purpose |
|----------|-----------|---------|
| `FRONTEND_DATABASE_URL` | frontend `DATABASE_URL` | **Neon V1** (Better Auth + Drizzle) |
| `BACKEND_DATABASE_URL` | backend + migrate `DATABASE_URL` | **Neon V2** (SQLAlchemy + Alembic) |

Do **not** point both at the same database. Never run Alembic against V1.

### URL formats (placeholders only)

- Frontend: `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`
- Backend: `postgresql+asyncpg://USER:PASSWORD@HOST/DB?ssl=require`

## Frontend (staging)

| Variable | Required | Notes |
|----------|----------|--------|
| `FRONTEND_DATABASE_URL` | yes | Neon V1 |
| `BETTER_AUTH_SECRET` | yes | Random ≥32 chars (independent of JWT) |
| `BETTER_AUTH_URL` | yes | **Public staging origin** (e.g. `http://<eip-or-dns>`) — no invented domain |
| `NEXT_PUBLIC_API_URL` | no | Prefer empty for same-origin `/api/v1` via nginx |
| `AI_ANALYSIS_ENABLED` | no | Default `false` |
| `OPENAI_API_KEY` | no | Optional; unused when AI disabled |
| `OPENAI_MODEL` | no | Default `gpt-4.1-mini` |

## Backend (staging)

| Variable | Required | Notes |
|----------|----------|--------|
| `BACKEND_DATABASE_URL` | yes | Neon V2 only |
| `JWT_SECRET` | yes | Random ≥32 chars; **independent** of Better Auth |
| `JWT_ALGORITHM` | no | `HS256` |
| `JWT_ISSUER` / `JWT_AUDIENCE` | no | Defaults in `.env.example` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | Default `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | no | Default `14` |
| `APP_ENV` | no | `staging` on EC2 |
| `DEBUG` | no | `false` |
| `BOOTSTRAP_ADMIN_*` | no | Ops CLI only; never bake into images |

## Compose / deploy

| Variable | Notes |
|----------|--------|
| `HTTP_PORT` | Host → nginx (default `80`) |
| `IMAGE_TAG` | Git SHA; **only** key rewritten by `deploy-on-ec2.sh` |
| `GHCR_OWNER` | GitHub owner for `ghcr.io/...` |

## Operator checklist (EC2 `.env`)

1. Copy `.env.example` → `/opt/cognitif-connexion/app/.env` once.
2. Fill Neon V1 + Neon V2 URLs (separate).
3. Set `BETTER_AUTH_URL` to the real public HTTP URL.
4. Generate distinct `BETTER_AUTH_SECRET` and `JWT_SECRET`.
5. Keep `AI_ANALYSIS_ENABLED=false` unless OpenAI is intentionally enabled.
6. Do not commit or paste real values into docs/PRs.
