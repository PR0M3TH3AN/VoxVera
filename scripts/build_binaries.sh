#!/bin/bash
# VoxVera Binary Builder
# Uses PyInstaller to create a standalone executable for the current OS.

set -e

# Ensure we are in the project root
cd "$(dirname "$0")/.."

echo "Checking for PyInstaller..."
if ! command -v pyinstaller &> /dev/null; then
    echo "PyInstaller not found. Installing..."
    pip install pyinstaller
fi

# Clean previous builds
rm -rf build/ dist_bin/
mkdir -p voxvera/resources/bin

echo "Building VoxVera binary for $(uname)..."

# Build the binary
# --onefile: Create a single executable
# --add-data: Include non-python resources
# --name: Resulting binary name
# We include locales, src (templates), and the default resources
pyinstaller --onefile \
    --add-data "voxvera/locales:voxvera/locales" \
    --add-data "voxvera/src:voxvera/src" \
    --add-data "voxvera/templates:voxvera/templates" \
    --add-data "voxvera/resources:voxvera/resources" \
    --add-data "requirements.txt:." \
    --name "voxvera-$(uname -s | tr '[:upper:]' '[:lower:]')" \
    --distpath voxvera/resources/bin \
    voxvera/cli.py

echo "Binary build complete. Located in voxvera/resources/bin/"
ls -lh voxvera/resources/bin/
