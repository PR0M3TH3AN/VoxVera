#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

ARCH="${ARCH_OVERRIDE:-$(uname -m)}"
if [[ "$ARCH" == "x86_64" ]]; then
  DEB_ARCH="amd64"
else
  DEB_ARCH="$ARCH"
fi

DEB_PATH="${1:-voxvera/resources/bin/voxvera_$(python3 - <<'PY'
from voxvera import __version__
print(__version__)
PY
)_${DEB_ARCH}.deb}"
APPIMAGE_PATH="${2:-voxvera/resources/bin/VoxVera-${ARCH}.AppImage}"

tmpdir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmpdir"
}
trap cleanup EXIT

json_get() {
  local file="$1"
  local key="$2"
  python3 - "$file" "$key" <<'PY'
import json
import sys

path = sys.argv[2].split(".")
data = json.load(open(sys.argv[1], "r", encoding="utf-8"))
for part in path:
    data = data[part]
if isinstance(data, list):
    print("\n".join(str(item) for item in data))
else:
    print(data)
PY
}

require_non_empty_json_field() {
  local file="$1"
  local key="$2"
  local value
  value="$(json_get "$file" "$key")"
  if [[ -z "${value// }" ]]; then
    echo "Expected non-empty JSON field '$key' in $file" >&2
    exit 1
  fi
}

echo "Validating Debian artifact: $DEB_PATH"
if [[ ! -f "$DEB_PATH" ]]; then
  echo "Debian package not found: $DEB_PATH" >&2
  exit 1
fi

mkdir -p "$tmpdir/deb-root" "$tmpdir/deb-data"
dpkg-deb -x "$DEB_PATH" "$tmpdir/deb-root"

if [[ ! -x "$tmpdir/deb-root/usr/bin/voxvera" ]]; then
  echo "Packaged voxvera binary missing from .deb payload" >&2
  exit 1
fi

VOXVERA_DIR="$tmpdir/deb-data" \
  "$tmpdir/deb-root/usr/bin/voxvera" \
  --config "$tmpdir/deb-data/config.json" \
  init --non-interactive

if [[ ! -f "$tmpdir/deb-data/config.json" ]]; then
  echo ".deb validation failed: config.json was not created" >&2
  exit 1
fi

if [[ ! -f "$tmpdir/deb-data/host/voxvera/index.html" ]]; then
  echo ".deb validation failed: built site missing index.html" >&2
  exit 1
fi

echo "Validating AppImage artifact: $APPIMAGE_PATH"
if [[ ! -f "$APPIMAGE_PATH" ]]; then
  echo "AppImage not found: $APPIMAGE_PATH" >&2
  exit 1
fi

chmod +x "$APPIMAGE_PATH"
"$APPIMAGE_PATH" platform-status --json > "$tmpdir/platform-status.json"
require_non_empty_json_field "$tmpdir/platform-status.json" "tier_description"
require_non_empty_json_field "$tmpdir/platform-status.json" "hosting_model"

VOXVERA_DIR="$tmpdir/appimage-data" \
  "$APPIMAGE_PATH" \
  --config "$tmpdir/appimage-data/config.json" \
  init --non-interactive

if [[ ! -f "$tmpdir/appimage-data/config.json" ]]; then
  echo "AppImage validation failed: config.json was not created" >&2
  exit 1
fi

if [[ ! -f "$tmpdir/appimage-data/host/voxvera/index.html" ]]; then
  echo "AppImage validation failed: built site missing index.html" >&2
  exit 1
fi

echo "Release artifact validation passed."
