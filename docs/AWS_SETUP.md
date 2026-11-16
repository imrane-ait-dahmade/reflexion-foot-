# AWS setup — Cognitif Connexion Foot staging

Region: **eu-west-3 (Paris)**. Do not share this stack with Mr Arbitre.

This doc is a checklist. It does not create resources by itself.

## 1. EC2 (existing t3.small)

- Ubuntu, Docker Engine + Compose plugin
- SSM Agent installed and online
- Instance profile with `AmazonSSMManagedInstanceCore`
- Security group **SG-EC2**:
  - Inbound: TCP 80 (and 443 later) from your users / ALB
  - **No** SSH `0.0.0.0/0` — use SSM Session Manager
- Outbound: HTTPS to GHCR, Neon (test), and later RDS

## 2. Database strategy

### Test now — Neon

- DB A → `FRONTEND_DATABASE_URL` (V1)
- DB B → `BACKEND_DATABASE_URL` (V2)
- Alembic only against B

### Later — RDS PostgreSQL

- Same VPC as EC2, **PubliclyAccessible = false**
- SG-RDS: inbound `5432` **only** from SG-EC2
- Two databases: `cognitif_v1`, `cognitif_v2`
- Automated backups (e.g. 7 days) + test restore once
- Instance size: `db.t4g.micro` / `db.t3.micro` for staging
- Frontend Neon driver → standard `pg` before cutover to RDS

## 3. GitHub OIDC → AWS

1. Create OIDC provider for `token.actions.githubusercontent.com` (if missing)
2. IAM role trust policy: GitHub repo `imrane-ait-dahmade/reflexion-foot-`, branch `master`, audience `sts.amazonaws.com`
3. Permissions (least privilege):
   - `ssm:SendCommand`, `ssm:GetCommandInvocation` on the Cognitif instance
   - `ssm:ListCommands` as needed
4. Set GitHub Actions variable `AWS_ROLE_ARN` to that role ARN
5. Set `EC2_INSTANCE_ID`, `AWS_REGION=eu-west-3`

No long-lived AWS access keys in GitHub.

## 4. GHCR

- Workflow uses `GITHUB_TOKEN` to push packages
- On EC2: authenticate to `ghcr.io` (PAT with `read:packages`, or instance-linked pull)
- Package names:
  - `ghcr.io/<owner>/reflexion-foot-frontend`
  - `ghcr.io/<owner>/reflexion-foot-backend`

## 5. HTTPS (later)

- Point a **real** DNS name at the instance / EIP
- Issue certificates (e.g. Let’s Encrypt)
- Uncomment HTTPS server in `deploy/nginx/nginx.conf`
- Set `BETTER_AUTH_URL` to `https://...`

## 6. Validation checklist

- [ ] SSM online on EC2
- [ ] Docker compose stack healthy (`/health`)
- [ ] Frontend loads on port 80
- [ ] `/api/v1` reaches FastAPI
- [ ] Alembic applied only on V2 DB
- [ ] Push to `master` builds GHCR images
- [ ] Deploy job runs only when AWS vars are set
- [ ] Rollback script tested with a bad tag
