# Deployment — staging (EC2)

Branch: **`master`** only. Do not auto-deploy `main`. No production workflow yet.  
Full checklist: [`AWS_STAGING_READINESS.md`](AWS_STAGING_READINESS.md).

## Pipeline

```
push master
  → test frontend + backend
  → build Docker images
  → push ghcr.io/<owner>/reflexion-foot-{frontend,backend}:<sha>
  → (if AWS vars set) SSM RunCommand on EC2
  → deploy-on-ec2.sh (pull/up + /health)
  → rollback previous IMAGE_TAG on failure
```

## Server layout

```
/opt/cognitif-connexion/app/          # COMPOSE_DIR (default)
  docker-compose.prod.yml
  deploy/nginx/nginx.conf
  deploy/scripts/deploy-on-ec2.sh
  .env                                # secrets — never in git
```

## Manual first deploy

```bash
cd /opt/cognitif-connexion/app
# ensure .env exists (from .env.example) — do not overwrite secrets blindly
echo "$GHCR_TOKEN" | docker login ghcr.io -u USER --password-stdin

export COMPOSE_DIR=/opt/cognitif-connexion/app
export IMAGE_TAG=<commit-sha>
export GHCR_OWNER=imrane-ait-dahmade
bash deploy/scripts/deploy-on-ec2.sh
```

## Logs

```bash
cd /opt/cognitif-connexion/app
docker compose -f docker-compose.prod.yml logs -f --tail=200
docker compose -f docker-compose.prod.yml ps
curl -fsS http://127.0.0.1/health
```

## Rollback

Automatic in `deploy-on-ec2.sh` when a previous `IMAGE_TAG` is stored in `.env`.

Manual:

```bash
export COMPOSE_DIR=/opt/cognitif-connexion/app
export IMAGE_TAG=<previous-sha>
bash deploy/scripts/deploy-on-ec2.sh
```

## GitHub variables

| Name | Purpose | Default |
|------|---------|---------|
| `AWS_ROLE_ARN` | IAM role for OIDC deploy | _(required to deploy)_ |
| `EC2_INSTANCE_ID` | Target instance | _(required to deploy)_ |
| `AWS_REGION` | Region | `eu-west-3` |
| `COMPOSE_DIR` | App dir on EC2 | `/opt/cognitif-connexion/app` |

If `AWS_ROLE_ARN` or `EC2_INSTANCE_ID` is empty, CI **builds/pushes** but **skips** SSM.
