#!/usr/bin/env bash
# Runs on the EC2 host (invoked via SSM). Pulls GHCR images and recreates stack.
# Required env: IMAGE_TAG
# Optional: GHCR_OWNER, COMPOSE_DIR, COMPOSE_FILE, HTTP_PORT
#
# Default layout on Cognitif staging EC2:
#   /opt/cognitif-connexion/app/{docker-compose.prod.yml,deploy/,.env}
set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/cognitif-connexion/app}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-30}"
HEALTH_SLEEP_S="${HEALTH_SLEEP_S:-5}"

cd "${COMPOSE_DIR}"

if [[ -z "${IMAGE_TAG:-}" ]]; then
  echo "ERROR: IMAGE_TAG is required" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "ERROR: ${COMPOSE_DIR}/${COMPOSE_FILE} not found" >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  echo "ERROR: ${COMPOSE_DIR}/.env is missing. Create it from .env.example with real secrets before deploy." >&2
  exit 1
fi

# Only IMAGE_TAG is updated in .env — never rewrite other secrets.
set_image_tag_in_env() {
  local tag="$1"
  if grep -q '^IMAGE_TAG=' .env; then
    # Portable in-place replace (GNU sed on Ubuntu EC2)
    sed -i "s|^IMAGE_TAG=.*|IMAGE_TAG=${tag}|" .env
  else
    printf '\nIMAGE_TAG=%s\n' "${tag}" >> .env
  fi
}

read_image_tag_from_env() {
  if [[ -f .env ]] && grep -q '^IMAGE_TAG=' .env; then
    grep '^IMAGE_TAG=' .env | tail -n1 | cut -d= -f2-
  fi
}

wait_healthy() {
  local i
  for i in $(seq 1 "${HEALTH_RETRIES}"); do
    if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
      echo "Healthcheck OK (${HEALTH_URL})"
      return 0
    fi
    sleep "${HEALTH_SLEEP_S}"
  done
  return 1
}

compose() {
  docker compose -f "${COMPOSE_FILE}" "$@"
}

PREVIOUS_TAG="$(read_image_tag_from_env || true)"
PREVIOUS_TAG_FILE=".previous_image_tag"
if [[ -n "${PREVIOUS_TAG}" ]]; then
  printf '%s\n' "${PREVIOUS_TAG}" > "${PREVIOUS_TAG_FILE}"
fi

echo "COMPOSE_DIR=${COMPOSE_DIR}"
echo "Deploying IMAGE_TAG=${IMAGE_TAG} (previous=${PREVIOUS_TAG:-none})"

set_image_tag_in_env "${IMAGE_TAG}"
export IMAGE_TAG
export GHCR_OWNER="${GHCR_OWNER:-imrane-ait-dahmade}"

echo "Pulling images"
compose pull backend frontend

echo "Starting stack (migrate → backend → frontend → nginx)"
compose up -d --remove-orphans

echo "Waiting for health"
if wait_healthy; then
  exit 0
fi

echo "Healthcheck failed — attempting rollback" >&2
compose logs --no-color --tail=200 || true

if [[ -n "${PREVIOUS_TAG}" && "${PREVIOUS_TAG}" != "${IMAGE_TAG}" ]]; then
  echo "Rolling back to IMAGE_TAG=${PREVIOUS_TAG}" >&2
  export IMAGE_TAG="${PREVIOUS_TAG}"
  set_image_tag_in_env "${IMAGE_TAG}"
  compose pull backend frontend
  compose up -d --remove-orphans
  if wait_healthy; then
    echo "Rollback succeeded; restored IMAGE_TAG=${IMAGE_TAG}" >&2
    exit 1
  fi
  echo "Rollback healthcheck also failed" >&2
else
  echo "No previous IMAGE_TAG available for rollback" >&2
fi

compose logs --no-color --tail=200 || true
exit 1
