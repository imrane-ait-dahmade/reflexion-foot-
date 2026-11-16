# Environment variables

Never commit real `.env` files. Use `.env.example` as the template.

## Two databases (required)

| Variable | Consumed by | Purpose |
|----------|-------------|---------|
| `FRONTEND_DATABASE_URL` | frontend container → `DATABASE_URL` | Neon/RDS **V1** (Better Auth + Drizzle) |
| `BACKEND_DATABASE_URL` | backend + migrate → `DATABASE_URL` | Neon/RDS **V2** (SQLAlchemy + Alembic) |

Do **not** point both at the same database. Table names collide (`users`, etc.).

### URL formats

- Frontend / `pg_dump`: `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`
- Backend asyncpg: `postgresql+asyncpg://USER:PASSWORD@HOST/DB?ssl=require`

## Frontend

| Variable | Notes |
|----------|--------|
| `BETTER_AUTH_SECRET` | ≥32 chars random |
| `BETTER_AUTH_URL` | Public origin (`http://localhost` or EC2 URL) |
| `NEXT_PUBLIC_API_URL` | Optional; empty = same-origin via nginx |
| `AI_ANALYSIS_ENABLED` / `OPENAI_*` | V1 AI features |

## Backend

| Variable | Notes |
|----------|--------|
| `JWT_SECRET` | ≥32 chars |
| `JWT_*` / token TTLs | See `backend/.env.example` |
| `BOOTSTRAP_ADMIN_*` | Optional CLI bootstrap only |

## Compose / deploy

| Variable | Notes |
|----------|--------|
| `HTTP_PORT` | Host port mapped to nginx (default 80) |
| `IMAGE_TAG` | Git SHA for GHCR images |
| `GHCR_OWNER` | GitHub org/user for `ghcr.io/...` |

## Future RDS

Keep the same variable names. Swap hosts to the private RDS endpoint. Frontend driver migration (Neon serverless → `pg`) is a separate step before cutover.
