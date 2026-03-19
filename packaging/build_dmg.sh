#!/usr/bin/env bash
set -e

echo "Warning: DMG packaging is experimental and is not yet validated for reliable background hidden-service hosting."

# Ensure we are in project root
cd "$(dirname "$0")/.."

# This script is intended to be run on macOS
if [ "$(uname)" != "Darwin" ]; then
  echo "Error: .dmg creation requires macOS." >&2
  exit 1
fi

ARCH=$(uname -m)
BINARY=${1:-"voxvera/resources/bin/voxvera-macos-$ARCH"}

if [ ! -f "$BINARY" ]; then
  echo "Binary not found: $BINARY." >&2
  exit 1
fi

VERSION=$(grep "__version__" voxvera/__init__.py | cut -d '"' -f 2)
DMG_NAME="VoxVera_${VERSION}_${ARCH}.dmg"
STAGING_DIR="build/dmg_staging"

echo "Building .dmg package for version $VERSION ($ARCH)..."

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# For a CLI tool, we just put the binary in the DMG.
# In the future, we could create an .app bundle if there's a GUI.
cp "$BINARY" "$STAGING_DIR/voxvera"
chmod +x "$STAGING_DIR/voxvera"

# Create the DMG
mkdir -p voxvera/resources/bin
hdiutil create -volname "VoxVera $VERSION" -srcfolder "$STAGING_DIR" -ov -format UDZO "voxvera/resources/bin/$DMG_NAME"

echo "DMG created at voxvera/resources/bin/$DMG_NAME"
