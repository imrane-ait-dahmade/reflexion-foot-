#!/usr/bin/env bash
# Runs on the EC2 host (invoked via SSM). Pulls GHCR images and recreates stack.
# Required env: IMAGE_TAG, GHCR_OWNER (optional), COMPOSE_DIR (default /opt/cognitif-connexion)
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/cognitif-connexion}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
cd "${COMPOSE_DIR}"

if [[ -z "${IMAGE_TAG:-}" ]]; then
  echo "IMAGE_TAG is required" >&2
  exit 1
fi

PREVIOUS_TAG_FILE=".previous_image_tag"
if [[ -f .env ]] && grep -q '^IMAGE_TAG=' .env; then
  grep '^IMAGE_TAG=' .env | tail -n1 | cut -d= -f2- > "${PREVIOUS_TAG_FILE}" || true
fi

# Persist new tag for compose variable substitution
if [[ -f .env ]]; then
  if grep -q '^IMAGE_TAG=' .env; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env
  else
    echo "IMAGE_TAG=${IMAGE_TAG}" >> .env
  fi
fi

export IMAGE_TAG
export GHCR_OWNER="${GHCR_OWNER:-imrane-ait-dahmade}"

echo "Pulling images for IMAGE_TAG=${IMAGE_TAG}"
docker compose -f "${COMPOSE_FILE}" pull backend frontend

echo "Starting stack"
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

echo "Waiting for health"
for i in $(seq 1 30); do
  if docker compose -f "${COMPOSE_FILE}" ps | grep -q "healthy"; then
    if curl -fsS "http://127.0.0.1/health" >/dev/null 2>&1; then
      echo "Healthcheck OK"
      exit 0
    fi
  fi
  sleep 5
done

echo "Healthcheck failed — attempting rollback" >&2
if [[ -f "${PREVIOUS_TAG_FILE}" ]]; then
  PREV="$(cat "${PREVIOUS_TAG_FILE}")"
  if [[ -n "${PREV}" && "${PREV}" != "${IMAGE_TAG}" ]]; then
    export IMAGE_TAG="${PREV}"
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${IMAGE_TAG}/" .env || true
    docker compose -f "${COMPOSE_FILE}" pull backend frontend
    docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
    echo "Rolled back to IMAGE_TAG=${IMAGE_TAG}" >&2
  fi
fi
docker compose -f "${COMPOSE_FILE}" logs --no-color --tail=200 || true
exit 1
