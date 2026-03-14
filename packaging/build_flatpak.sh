#!/usr/bin/env bash
set -e

# Ensure we are in project root
cd "$(dirname "$0")/.."

ARCH=$(uname -m)
BINARY="voxvera/resources/bin/voxvera-linux-$ARCH"

if [ ! -f "$BINARY" ]; then
  echo "Binary not found: $BINARY. Run scripts/build_binaries.sh first." >&2
  exit 1
fi

if ! command -v flatpak-builder &> /dev/null; then
    echo "flatpak-builder not found. Please install it (e.g., sudo apt install flatpak-builder)" >&2
    exit 1
fi

echo "Building Flatpak package..."

BUILD_DIR=build/flatpak-build
REPO_DIR=build/flatpak-repo
MANIFEST=packaging/flatpak/org.voxvera.VoxVera.yml

# Clean previous
rm -rf "$BUILD_DIR" "$REPO_DIR"

# Build
flatpak-builder --force-clean --repo="$REPO_DIR" "$BUILD_DIR" "$MANIFEST"

# Generate a standalone .flatpak file
flatpak build-bundle "$REPO_DIR" voxvera/resources/bin/VoxVera-x86_64.flatpak org.voxvera.VoxVera

echo "Flatpak bundle created at voxvera/resources/bin/VoxVera-x86_64.flatpak"
