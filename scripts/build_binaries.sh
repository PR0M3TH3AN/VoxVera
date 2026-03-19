#!/bin/bash
# VoxVera Binary Builder
# Uses PyInstaller to create a standalone executable for the current OS.

set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "Checking for PyInstaller..."
if ! command -v pyinstaller &> /dev/null; then
    echo "PyInstaller not found. Installing..."
    pip install pyinstaller --break-system-packages
fi

ARTIFACT_DIR="voxvera/resources/bin"
BUILD_BINARY_NAME="voxvera-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m)"

# Clean previous builds
python3 - <<'PY'
import shutil
from pathlib import Path

for path in (Path("build"), Path("dist_bin")):
    if path.exists():
        shutil.rmtree(path, ignore_errors=True)
PY
mkdir -p "$ARTIFACT_DIR"

echo "Building VoxVera binary for $(uname)..."

echo "Ensuring Tor binaries are downloaded..."
bash scripts/download_tor.sh

# Use python module to call pyinstaller
PY_CMD="python3 -m PyInstaller"

# Build the binary
ARCH=$(uname -m)
OS_NAME=$(uname -s | tr '[:upper:]' '[:lower:]')
BINARY_NAME="voxvera-$OS_NAME-$ARCH"

$PY_CMD --onefile \
    --add-data "voxvera/locales:voxvera/locales" \
    --add-data "voxvera/src:voxvera/src" \
    --add-data "voxvera/templates:voxvera/templates" \
    --add-data "voxvera/resources/tor:voxvera/resources/tor" \
    --add-data "support-matrix.json:." \
    --add-data "requirements.txt:." \
    --name "$BINARY_NAME" \
    --distpath "$ARTIFACT_DIR" \
    voxvera/cli.py

echo "Binary build complete. Located in $ARTIFACT_DIR/"
ls -lh "$ARTIFACT_DIR"/
