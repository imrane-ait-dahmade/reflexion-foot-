# AWS setup — Cognitif Connexion Foot staging

Region: **eu-west-3 (Paris)**. Do not share this stack with Mr Arbitre.  
See also [`AWS_STAGING_READINESS.md`](AWS_STAGING_READINESS.md).

This doc is a checklist. It does not create resources by itself.

## 1. EC2 (existing t3.small)

- Ubuntu, Docker Engine + Compose plugin
- SSM Agent installed and online
- Instance profile with `AmazonSSMManagedInstanceCore`
- App files under **`/opt/cognitif-connexion/app`**
- Security group **SG-EC2**:
  - Inbound: TCP 80 (and 443 later)
  - **No** SSH `0.0.0.0/0` — use SSM Session Manager
- Outbound: HTTPS to GHCR, Neon (staging test), later RDS

## 2. Database strategy

### Staging test — Neon

- DB A → `FRONTEND_DATABASE_URL` (V1)
- DB B → `BACKEND_DATABASE_URL` (V2)
- Alembic only against B

### Later — RDS PostgreSQL

- Same VPC as EC2, **PubliclyAccessible = false**
- SG-RDS: inbound `5432` **only** from SG-EC2
- Two databases: `cognitif_v1`, `cognitif_v2`
- Automated backups + tested restore
- Frontend Neon driver → standard `pg` before cutover

## 3. GitHub OIDC → AWS

1. OIDC provider for `token.actions.githubusercontent.com` (if missing)
2. IAM role trust: repo `imrane-ait-dahmade/reflexion-foot-`, ref `refs/heads/master`, aud `sts.amazonaws.com`
3. Permissions: `ssm:SendCommand`, `ssm:GetCommandInvocation` on the Cognitif instance
4. GitHub variables:
   - `AWS_ROLE_ARN`
   - `EC2_INSTANCE_ID`
   - `AWS_REGION=eu-west-3`
   - `COMPOSE_DIR=/opt/cognitif-connexion/app`

No long-lived AWS access keys in GitHub.

## 4. GHCR

- Workflow uses `GITHUB_TOKEN` to push
- On EC2: authenticate to `ghcr.io` (`read:packages`)
- Packages:
  - `ghcr.io/<owner>/reflexion-foot-frontend`
  - `ghcr.io/<owner>/reflexion-foot-backend`

## 5. HTTPS (later)

- Real DNS → EIP/instance
- Certificates + uncomment HTTPS block in `deploy/nginx/nginx.conf`
- Update `BETTER_AUTH_URL` to `https://...`

## 6. Validation checklist

- [ ] SSM online on EC2
- [ ] `/opt/cognitif-connexion/app/.env` present
- [ ] Docker compose stack healthy (`/health`)
- [ ] Frontend on port 80; API via `/api/v1` only
- [ ] Alembic applied only on V2
- [ ] Push to `master` builds GHCR images
- [ ] Deploy runs only when AWS vars are set
- [ ] Rollback tested with a bad tag
