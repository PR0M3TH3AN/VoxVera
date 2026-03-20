#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed; skipping Docker runtime smoke"
  exit 0
fi

IMAGE_TAG="${VOXVERA_DOCKER_SMOKE_TAG:-voxvera:smoke}"
CONTAINER_NAME="${VOXVERA_DOCKER_SMOKE_CONTAINER:-voxvera-smoke}"
TMP_DIR="${VOXVERA_DOCKER_SMOKE_TMPDIR:-$(mktemp -d /tmp/voxvera-docker-smoke-XXXXXX)}"
FLYERS_DIR="$TMP_DIR/flyers"
mkdir -p "$FLYERS_DIR"

cleanup() {
  docker logs "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  if [[ -z "${VOXVERA_DOCKER_SMOKE_TMPDIR:-}" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

echo "==> building Docker image"
docker build -t "$IMAGE_TAG" .

echo "==> starting Docker container"
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart no \
  -e VOXVERA_START_INTERVAL=15 \
  -v "$FLYERS_DIR:/flyers" \
  "$IMAGE_TAG" >/dev/null

echo "==> waiting for healthy container"
deadline=$((SECONDS + 240))
while true; do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$CONTAINER_NAME")"
  case "$status" in
    healthy)
      break
      ;;
    unhealthy)
      echo "Container became unhealthy" >&2
      docker logs "$CONTAINER_NAME" >&2 || true
      exit 1
      ;;
  esac
  if (( SECONDS >= deadline )); then
    echo "Timed out waiting for healthy Docker container" >&2
    docker logs "$CONTAINER_NAME" >&2 || true
    exit 1
  fi
  sleep 5
done

PLATFORM_JSON="$TMP_DIR/platform-status.json"
DOCTOR_JSON="$TMP_DIR/doctor.json"

docker exec "$CONTAINER_NAME" voxvera platform-status --json >"$PLATFORM_JSON"
docker exec "$CONTAINER_NAME" voxvera doctor --json >"$DOCTOR_JSON"

PLATFORM_JSON="$PLATFORM_JSON" \
DOCTOR_JSON="$DOCTOR_JSON" \
FLYERS_DIR="$FLYERS_DIR" \
python3 - <<'PY'
import json
import os
import sys
from pathlib import Path

platform_status = json.loads(Path(os.environ["PLATFORM_JSON"]).read_text(encoding="utf-8"))
doctor = json.loads(Path(os.environ["DOCTOR_JSON"]).read_text(encoding="utf-8"))
flyers_dir = Path(os.environ["FLYERS_DIR"])

errors = []

if platform_status.get("platform_id") != "docker_cli":
    errors.append(f"platform_id mismatch: {platform_status.get('platform_id')}")
if platform_status.get("tier") != "experimental":
    errors.append(f"tier mismatch: {platform_status.get('tier')}")

checks = {check["name"]: check for check in doctor.get("checks", [])}
for required in ("container_marker", "docker_entrypoint", "docker_healthcheck", "tor_socks_reachable", "host_root"):
    check = checks.get(required)
    if not check:
        errors.append(f"missing doctor check: {required}")
    elif not check.get("ok"):
        errors.append(f"doctor check failed: {required} ({check.get('detail')})")

site_dir = flyers_dir / "host" / "voxvera"
for path in (flyers_dir / "config.json", site_dir / "config.json", site_dir / "index.html", site_dir / ".onionshare-session", site_dir / "server.pid"):
    if not path.exists():
        errors.append(f"missing expected Docker runtime artifact: {path}")

if errors:
    print("Docker runtime smoke failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    sys.exit(1)

print("Docker runtime smoke OK")
print(f"Platform: {platform_status['label']} [{platform_status['tier']}]")
print(f"Hosting model: {platform_status.get('hosting_model', '')}")
PY
