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

# Clean previous builds
rm -rf build/ dist_bin/
mkdir -p voxvera/resources/bin

echo "Building VoxVera binary for $(uname)..."

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
    --add-data "voxvera/resources:voxvera/resources" \
    --add-data "requirements.txt:." \
    --name "$BINARY_NAME" \
    --distpath voxvera/resources/bin \
    voxvera/cli.py

echo "Binary build complete. Located in voxvera/resources/bin/"
ls -lh voxvera/resources/bin/
