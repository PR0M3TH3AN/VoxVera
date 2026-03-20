#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

TARGET="${1:-linux-cli}"
TMP_DIR="${VOXVERA_SMOKE_TMPDIR:-$(mktemp -d /tmp/voxvera-platform-smoke-XXXXXX)}"
mkdir -p "$TMP_DIR"

cleanup() {
  if [[ -z "${VOXVERA_SMOKE_TMPDIR:-}" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

command -v voxvera >/dev/null 2>&1 || {
  echo "voxvera is not on PATH" >&2
  exit 1
}

case "$TARGET" in
  linux-cli)
    EXPECTED_PLATFORM_ID="linux_cli_systemd"
    EXPECTED_TIER="supported"
    REQUIRE_ONIONSHARE="${VOXVERA_REQUIRE_ONIONSHARE:-1}"
    ;;
  macos-cli)
    EXPECTED_PLATFORM_ID="macos_cli"
    EXPECTED_TIER="experimental"
    REQUIRE_ONIONSHARE="${VOXVERA_REQUIRE_ONIONSHARE:-0}"
    ;;
  windows-cli)
    EXPECTED_PLATFORM_ID="windows_cli"
    EXPECTED_TIER="experimental"
    REQUIRE_ONIONSHARE="${VOXVERA_REQUIRE_ONIONSHARE:-0}"
    ;;
  docker-cli)
    EXPECTED_PLATFORM_ID="docker_cli"
    EXPECTED_TIER="${VOXVERA_EXPECTED_TIER_OVERRIDE:-experimental}"
    REQUIRE_ONIONSHARE="${VOXVERA_REQUIRE_ONIONSHARE:-0}"
    ;;
  list)
    printf '%s\n' linux-cli macos-cli windows-cli docker-cli
    exit 0
    ;;
  *)
    echo "Unsupported smoke target: $TARGET" >&2
    exit 1
    ;;
esac

PLATFORM_JSON="$TMP_DIR/platform-status.json"
DOCTOR_JSON="$TMP_DIR/doctor.json"
AUTOSTART_JSON="$TMP_DIR/autostart-status.json"

voxvera platform-status --json >"$PLATFORM_JSON"
voxvera doctor --json >"$DOCTOR_JSON"
voxvera autostart status --json >"$AUTOSTART_JSON"

PLATFORM_JSON="$PLATFORM_JSON" \
DOCTOR_JSON="$DOCTOR_JSON" \
AUTOSTART_JSON="$AUTOSTART_JSON" \
EXPECTED_PLATFORM_ID="$EXPECTED_PLATFORM_ID" \
EXPECTED_TIER="$EXPECTED_TIER" \
VOXVERA_REQUIRE_TOR="${VOXVERA_REQUIRE_TOR:-0}" \
VOXVERA_REQUIRE_AUTOSTART_ARTIFACTS="${VOXVERA_REQUIRE_AUTOSTART_ARTIFACTS:-0}" \
VOXVERA_REQUIRE_ONIONSHARE="$REQUIRE_ONIONSHARE" \
python3 - <<'PY'
import json
import os
import sys
from pathlib import Path

platform_status = json.loads(Path(os.environ["PLATFORM_JSON"]).read_text(encoding="utf-8"))
doctor = json.loads(Path(os.environ["DOCTOR_JSON"]).read_text(encoding="utf-8"))
autostart = json.loads(Path(os.environ["AUTOSTART_JSON"]).read_text(encoding="utf-8"))

expected_platform_id = os.environ["EXPECTED_PLATFORM_ID"]
expected_tier = os.environ["EXPECTED_TIER"]
require_tor = os.environ.get("VOXVERA_REQUIRE_TOR") == "1"
require_autostart_artifacts = os.environ.get("VOXVERA_REQUIRE_AUTOSTART_ARTIFACTS") == "1"
require_onionshare = os.environ.get("VOXVERA_REQUIRE_ONIONSHARE") == "1"

errors = []

if platform_status.get("platform_id") != expected_platform_id:
    errors.append(
        f"platform-status platform_id mismatch: {platform_status.get('platform_id')} != {expected_platform_id}"
    )
if platform_status.get("tier") != expected_tier:
    errors.append(f"platform-status tier mismatch: {platform_status.get('tier')} != {expected_tier}")
if doctor.get("platform_id") != expected_platform_id:
    errors.append(f"doctor platform_id mismatch: {doctor.get('platform_id')} != {expected_platform_id}")
if autostart.get("platform_id") != expected_platform_id:
    errors.append(f"autostart platform_id mismatch: {autostart.get('platform_id')} != {expected_platform_id}")

check_map = {check["name"]: check for check in doctor.get("checks", [])}
for required_check in ("platform", "voxvera_cli"):
    if required_check not in check_map:
        errors.append(f"doctor missing required check: {required_check}")
    elif not check_map[required_check].get("ok"):
        errors.append(f"doctor check failed: {required_check} ({check_map[required_check].get('detail')})")

if require_onionshare:
    required_check = "onionshare_cli"
    if required_check not in check_map:
        errors.append(f"doctor missing required check: {required_check}")
    elif not check_map[required_check].get("ok"):
        errors.append(f"doctor check failed: {required_check} ({check_map[required_check].get('detail')})")

if require_tor:
    for required_check in ("tor_binary", "tor_socks_reachable"):
        if required_check not in check_map:
            errors.append(f"doctor missing Tor check: {required_check}")
        elif not check_map[required_check].get("ok"):
            errors.append(f"doctor Tor check failed: {required_check} ({check_map[required_check].get('detail')})")

if require_autostart_artifacts:
    if not autostart.get("artifacts"):
        errors.append("autostart status returned no artifacts")
    missing_artifacts = [artifact for artifact in autostart.get("artifacts", []) if not Path(artifact).exists()]
    if missing_artifacts:
        errors.append("autostart artifacts missing: " + ", ".join(missing_artifacts))

if errors:
    print("Platform smoke validation failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    sys.exit(1)

print(f"Platform smoke OK: {platform_status['label']} [{platform_status['tier']}]")
print(f"Hosting model: {platform_status.get('hosting_model', '')}")
failing_checks = [check["name"] for check in doctor.get("checks", []) if not check.get("ok")]
if failing_checks:
    print("Doctor warnings: " + ", ".join(failing_checks))
else:
    print("Doctor warnings: none")
print("Autostart message: " + autostart.get("message", ""))
PY

echo "Artifacts written to $TMP_DIR"
