# AWS staging readiness — Cognitif Connexion Foot V2

Status: **ready for operator configuration** (no deploy executed from this document).  
Branch: **`master`** only. Do not touch `main`.

## Architecture (staging)

```
Internet
   │  :80 (HTTPS later)
   ▼
EC2 t3.small  /opt/cognitif-connexion/app
   nginx (published) ──► frontend:3000 (internal)
                      └► backend:8000  (internal) ──► Neon V2
   frontend ──► Neon V1 (Better Auth / Drizzle)
```

- Images: `ghcr.io/<owner>/reflexion-foot-{frontend,backend}:<sha>`
- Compose: `docker-compose.prod.yml`
- Migrate job: `alembic upgrade head` against **BACKEND_DATABASE_URL only**
- No Postgres container; no public FastAPI/Postgres ports

## A. EC2 layout

```
/opt/cognitif-connexion/app/
  docker-compose.prod.yml
  deploy/nginx/nginx.conf
  deploy/scripts/deploy-on-ec2.sh
  .env                    # secrets — never in git; deploy updates IMAGE_TAG only
```

Default `COMPOSE_DIR=/opt/cognitif-connexion/app`.

## B. AWS prerequisites (manual)

| Item | Requirement |
|------|-------------|
| Region | `eu-west-3` |
| EC2 | Cognitif-only t3.small; Docker + Compose; SSM Agent online |
| Instance profile | `AmazonSSMManagedInstanceCore` (+ outbound HTTPS) |
| SG-EC2 | Inbound `80` (and `443` later); **no** SSH `0.0.0.0/0` |
| GHCR on host | `docker login ghcr.io` with `read:packages` once |
| `.env` | Present before first deploy |
| Neon | V1 URL for frontend, **separate** V2 URL for backend |

Do not share SG/VPC rules with Mr Arbitre.

### GitHub OIDC IAM (do not auto-create)

1. OIDC provider: `token.actions.githubusercontent.com`
2. Trust policy (example shape — adjust account/repo):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:imrane-ait-dahmade/reflexion-foot-:ref:refs/heads/master"
        }
      }
    }
  ]
}
```

3. Permissions (least privilege): `ssm:SendCommand`, `ssm:GetCommandInvocation` (and related describe) on the Cognitif instance / document `AWS-RunShellScript`.
4. **No** long-lived AWS access keys in GitHub.

## C. GitHub configuration

Repository or Environment **`staging`** variables:

| Variable | Example / default |
|----------|-------------------|
| `AWS_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/<deploy-role>` |
| `EC2_INSTANCE_ID` | `i-…` |
| `AWS_REGION` | `eu-west-3` |
| `COMPOSE_DIR` | `/opt/cognitif-connexion/app` |

If `AWS_ROLE_ARN` or `EC2_INSTANCE_ID` is empty, the workflow still **tests + builds + pushes GHCR** but **skips** SSM deploy.

Workflow: `.github/workflows/deploy-staging.yml`  
Trigger: push / `workflow_dispatch` on **`master`**.

## D. Environment variables

See [`ENVIRONMENT.md`](ENVIRONMENT.md) and root `.env.example`.

Critical:

- `FRONTEND_DATABASE_URL` = Neon **V1**
- `BACKEND_DATABASE_URL` = Neon **V2**
- `BETTER_AUTH_URL` = real public staging URL
- `BETTER_AUTH_SECRET` / `JWT_SECRET` = independent random secrets
- `AI_ANALYSIS_ENABLED=false` by default; `OPENAI_API_KEY` optional

Deploy script **never** overwrites secrets other than `IMAGE_TAG`.

## E. Deployment procedure

### First-time host prep

1. Sync repo files into `/opt/cognitif-connexion/app` (compose, `deploy/`).
2. Create `.env` from `.env.example` with real values.
3. `docker login ghcr.io`.
4. Optional smoke: `IMAGE_TAG=<sha> bash deploy/scripts/deploy-on-ec2.sh`

### Automated

1. Merge/push to `master`.
2. CI: frontend tests → backend tests → build/push images.
3. SSM runs `deploy-on-ec2.sh` with `COMPOSE_DIR` exported.
4. Health: `http://127.0.0.1/health` (and public `:80/health`).
5. On failure: script restores previous `IMAGE_TAG` and re-pulls/up; job fails.

### Rollback

Automatic via script when a previous `IMAGE_TAG` exists.  
Manual:

```bash
cd /opt/cognitif-connexion/app
export IMAGE_TAG=<previous-sha>
export COMPOSE_DIR=/opt/cognitif-connexion/app
bash deploy/scripts/deploy-on-ec2.sh
```

## F. Post-deploy checks

- [ ] `docker compose -f docker-compose.prod.yml ps` — healthy
- [ ] `curl -fsS http://127.0.0.1/health`
- [ ] Frontend HTML on `:80`
- [ ] `/api/v1/...` via nginx (not `:8000` publicly)
- [ ] No host publish of `5432` / `8000` / `3000`
- [ ] Alembic version on V2 only (`alembic_version` = `20261115_0006` after migrate)
- [ ] V1 Neon untouched by migrate

## G. Docker audit summary

| Check | Result |
|-------|--------|
| Multi-stage / non-root images | Yes |
| Nginx only public port | Yes (`80→8080`) |
| Backend/frontend internal | Yes (`expose` only) |
| Mem limits (t3.small) | backend 256m, frontend 512m, nginx 64m |
| Healthchecks | backend `/health`, frontend `/`, nginx `/health` |
| Postgres in compose | **No** |
| HTTPS | Prepared (commented); HTTP for now |

## H. Risks / unresolved

1. **GitHub vars / OIDC role** not created by this repo — operator must set them.
2. **EC2 `.env` and GHCR login** are manual one-time steps.
3. **First compose up runs Alembic** against Neon V2 — ensure V2 URL is correct before enabling deploy vars.
4. Frontend still uses **Neon serverless driver** — OK for Neon staging; RDS cutover needs a later driver change.
5. `npm ci` may need lockfile sync (`npm ci \|\| npm install` in CI).
6. t3.small RAM is tight; watch OOM under build-less pull-only deploys.
7. No domain/HTTPS yet — set `BETTER_AUTH_URL` to the real public HTTP origin in use.
8. This readiness pass **did not** deploy and **did not** migrate Neon.
