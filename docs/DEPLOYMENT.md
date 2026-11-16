# Deployment — staging (EC2)

Branch: **`master`** only. Do not auto-deploy `main`. No production workflow yet.

## Pipeline

```
push master
  → test frontend + backend
  → build Docker images
  → push ghcr.io/<owner>/reflexion-foot-{frontend,backend}:<sha>
  → (if AWS vars set) SSM RunCommand on EC2
  → docker compose pull && up -d
  → healthcheck /health
  → rollback to previous IMAGE_TAG on failure
```

## Server layout

```
/opt/cognitif-connexion/
  docker-compose.prod.yml
  deploy/nginx/nginx.conf
  deploy/scripts/deploy-on-ec2.sh
  .env                 # secrets — never in git
```

Copy compose + nginx + scripts from the repo once (or sync via CI artifact). Keep `.env` only on the host / Parameter Store.

## Manual first deploy

```bash
cd /opt/cognitif-connexion
# login to GHCR once
echo "$GHCR_TOKEN" | docker login ghcr.io -u USER --password-stdin

export IMAGE_TAG=<commit-sha>
export GHCR_OWNER=imrane-ait-dahmade
bash deploy/scripts/deploy-on-ec2.sh
```

## Logs

```bash
docker compose -f docker-compose.prod.yml logs -f --tail=200
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1/health
```

## Rollback

`deploy-on-ec2.sh` stores the previous `IMAGE_TAG` and reverts if `/health` fails.

Manual:

```bash
export IMAGE_TAG=<previous-sha>
bash deploy/scripts/deploy-on-ec2.sh
```

## Backups

```bash
export FRONTEND_DATABASE_URL=...
export BACKEND_DATABASE_URL=...
bash deploy/scripts/backup-db.sh
```

Restore only into the matching logical DB (`restore-db.sh`). Never restore V2 into V1.

## GitHub variables (staging)

Set repository/environment variables (not secrets for ARNs if preferred as vars):

| Name | Purpose |
|------|---------|
| `AWS_ROLE_ARN` | IAM role for OIDC deploy |
| `EC2_INSTANCE_ID` | Target instance |
| `AWS_REGION` | default `eu-west-3` |
| `COMPOSE_DIR` | default `/opt/cognitif-connexion` |

If `AWS_ROLE_ARN` or `EC2_INSTANCE_ID` is empty, the workflow **builds and pushes images** but **skips** SSM deploy.
