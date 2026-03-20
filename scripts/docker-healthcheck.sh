#!/usr/bin/env bash
set -euo pipefail

VOXVERA_DIR="${VOXVERA_DIR:-/flyers}"
TMP_JSON="$(mktemp)"

voxvera doctor --json >"$TMP_JSON"

python3 - "$TMP_JSON" "$VOXVERA_DIR" <<'PY'
import json
import sys
from pathlib import Path

doctor = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
voxvera_dir = Path(sys.argv[2])
checks = {check["name"]: check for check in doctor.get("checks", [])}

required = ("voxvera_cli", "onionshare_cli", "tor_socks_reachable", "host_root")
missing = []
failing = []

for name in required:
    check = checks.get(name)
    if not check:
        missing.append(name)
        continue
    if not check.get("ok"):
        failing.append(f"{name}: {check.get('detail', '')}")

site_configs = list((voxvera_dir / "host").glob("*/config.json"))
running_sites = [cfg.parent for cfg in site_configs if (cfg.parent / "server.pid").exists()]

if missing or failing or not site_configs or not running_sites:
    if missing:
        print("Missing checks: " + ", ".join(missing), file=sys.stderr)
    if failing:
        print("Failing checks: " + "; ".join(failing), file=sys.stderr)
    if not site_configs:
        print("No configured sites found under host/", file=sys.stderr)
    if site_configs and not running_sites:
        print("Configured sites exist but no server.pid files are present", file=sys.stderr)
    sys.exit(1)

print("healthy")
PY
