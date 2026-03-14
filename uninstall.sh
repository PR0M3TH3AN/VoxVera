#!/usr/bin/env bash
set -euo pipefail

echo "Uninstalling VoxVera..."

# 1. Uninstall via pipx if present
if command -v pipx >/dev/null 2>&1; then
  if pipx list | grep -q "package voxvera"; then
    echo "Removing voxvera via pipx..."
    pipx uninstall voxvera
  fi
fi

# 2. Uninstall via pip if present
if command -v pip >/dev/null 2>&1; then
  echo "Attempting to remove voxvera via pip..."
  pip uninstall -y voxvera >/dev/null 2>&1 || true
fi

# 3. Remove manual binary installation
BINARY_PATH="$HOME/.local/bin/voxvera"
if [ -f "$BINARY_PATH" ]; then
  echo "Removing manual binary at $BINARY_PATH..."
  rm "$BINARY_PATH"
fi

# 4. Remove configuration and host data (Optional - ask user)
# We will leave the host data by default to prevent data loss, 
# but we can remove the internal src config.
# ROOT_DIR="$(dirname "$(readlink -f "$0")")" # This might not be reliable if run via curl

echo ""
echo "VoxVera has been uninstalled."
echo "Note: Your generated sites in ~/voxvera-exports or within the source folder were not removed."
