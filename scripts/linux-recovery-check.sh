#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "linux-recovery-check.sh is only for Linux hosts." >&2
  exit 1
fi

command -v voxvera >/dev/null 2>&1 || {
  echo "voxvera is not on PATH" >&2
  exit 1
}

TMP_DIR="${VOXVERA_RECOVERY_TMPDIR:-$(mktemp -d /tmp/voxvera-linux-recovery-XXXXXX)}"
cleanup() {
  if [[ -z "${VOXVERA_RECOVERY_TMPDIR:-}" ]]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

PLATFORM_JSON="$TMP_DIR/platform-status.json"
DOCTOR_JSON="$TMP_DIR/doctor.json"
AUTOSTART_JSON="$TMP_DIR/autostart-status.json"

voxvera platform-status --json >"$PLATFORM_JSON"
voxvera doctor --json >"$DOCTOR_JSON"
voxvera autostart status --json >"$AUTOSTART_JSON"

PLATFORM_JSON="$PLATFORM_JSON" \
DOCTOR_JSON="$DOCTOR_JSON" \
AUTOSTART_JSON="$AUTOSTART_JSON" \
python3 - <<'PY'
import json
import os
import sys
from pathlib import Path

platform_status = json.loads(Path(os.environ["PLATFORM_JSON"]).read_text(encoding="utf-8"))
doctor = json.loads(Path(os.environ["DOCTOR_JSON"]).read_text(encoding="utf-8"))
autostart = json.loads(Path(os.environ["AUTOSTART_JSON"]).read_text(encoding="utf-8"))

errors = []
warnings = []

if platform_status.get("platform_id") != "linux_cli_systemd":
    errors.append(f"expected linux_cli_systemd, got {platform_status.get('platform_id')}")
if platform_status.get("tier") != "supported":
    errors.append(f"expected supported tier, got {platform_status.get('tier')}")

checks = {check["name"]: check for check in doctor.get("checks", [])}

required_ok = ["platform", "voxvera_cli", "onionshare_cli", "tor_binary", "host_root"]
for name in required_ok:
    check = checks.get(name)
    if not check:
        errors.append(f"missing doctor check: {name}")
    elif not check.get("ok"):
        errors.append(f"{name} failed: {check.get('detail')}")

tor_check = checks.get("tor_socks_reachable")
if not tor_check:
    errors.append("missing doctor check: tor_socks_reachable")
elif not tor_check.get("ok"):
    warnings.append(f"tor_socks_reachable: {tor_check.get('detail')}")

timer_check = next((check for check in autostart.get("checks", []) if check["name"] == "systemd_timer_enabled"), None)
if not timer_check:
    errors.append("missing autostart check: systemd_timer_enabled")
elif not timer_check.get("ok"):
    warnings.append(f"systemd_timer_enabled: {timer_check.get('detail')}")

artifacts = [Path(path) for path in autostart.get("artifacts", [])]
missing = [str(path) for path in artifacts if not path.exists()]
if missing:
    warnings.append("missing autostart artifacts: " + ", ".join(missing))

host_root = Path.home() / "host"
sites = []
if host_root.exists():
    for site_dir in sorted(path for path in host_root.iterdir() if path.is_dir()):
        config = site_dir / "config.json"
        if not config.exists():
            continue
        session = site_dir / ".onionshare-session"
        log = site_dir / "onionshare.log"
        pid = site_dir / "server.pid"
        sites.append(
            {
                "name": site_dir.name,
                "session": session.exists(),
                "log": log.exists(),
                "pid": pid.exists(),
            }
        )

if errors:
    print("Linux recovery check failed:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    sys.exit(1)

print(f"Platform: {platform_status['label']} [{platform_status['tier']}]")
print(f"Hosting model: {platform_status.get('hosting_model', '')}")
print(f"Autostart: {autostart.get('message', '')}")
if warnings:
    print("Warnings:")
    for warning in warnings:
        print(f"- {warning}")
else:
    print("Warnings: none")

if sites:
    print("Site state:")
    for site in sites:
        print(
            f"- {site['name']}: session={'yes' if site['session'] else 'no'}, "
            f"log={'yes' if site['log'] else 'no'}, pid={'yes' if site['pid'] else 'no'}"
        )
else:
    print("Site state: no configured sites under ~/host")
PY

echo "Detailed JSON artifacts written to $TMP_DIR"
