#!/bin/bash
set -e

# Development setup: install Python dependencies for VoxVera.
# System tools like jq, qrencode, ImageMagick, Node.js, and poppler-utils
# are no longer required — the build pipeline uses pure Python packages.

check_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# Ensure pip is available
if ! check_cmd pip3 && ! check_cmd pip; then
  echo "pip not found. Install Python 3 and pip first."
  exit 1
fi

PIP=$(check_cmd pip3 && echo pip3 || echo pip)

# Install Python packages used by the CLI and build pipeline
$PIP install --user InquirerPy rich qrcode Pillow jsmin htmlmin2 pypdf

echo "All dependencies are installed."
echo "Run 'voxvera check' to verify your setup."
