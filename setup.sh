#!/bin/bash
set -e

# Development setup: install Python dependencies for VoxVera.
# System tools like jq, qrencode, ImageMagick, Node.js, and poppler-utils
# are no longer required — the build pipeline uses pure Python packages.

check_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# Ensure pip is available
if ! check_cmd pip3 && ! check_cmd pip && ! check_cmd pipx; then
  echo "pip or pipx not found. Install Python 3 and pip/pipx first."
  exit 1
fi

if check_cmd pipx; then
  echo "Using pipx/pip for dependency installation..."
  # For development, we might want to install in a local venv instead of pipx
  # but for simple setup, pipx is safest on modern systems.
  # However, setup.sh usually implies installing into the current env for development.
  PIP_OPTS="--user --upgrade"
  if [ -f /etc/debian_version ]; then
     DEB_VER=$(cat /etc/debian_version | cut -d. -f1)
     if [[ "$DEB_VER" =~ ^[0-9]+$ ]] && [ "$DEB_VER" -ge 12 ]; then
       PIP_OPTS="$PIP_OPTS --break-system-packages"
     fi
  fi
  pip3 install $PIP_OPTS InquirerPy rich qrcode Pillow jsmin htmlmin2 pypdf wcwidth || \
  pip install $PIP_OPTS InquirerPy rich qrcode Pillow jsmin htmlmin2 pypdf wcwidth
else
  PIP=$(check_cmd pip3 && echo pip3 || echo pip)
  $PIP install --user --upgrade InquirerPy rich qrcode Pillow jsmin htmlmin2 pypdf wcwidth
fi

echo "All dependencies are installed."
echo "Run 'voxvera check' to verify your setup."
