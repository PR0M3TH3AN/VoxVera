#!/bin/bash
set -e

check_cmd() {
  command -v "$1" >/dev/null 2>&1
}

apt_packages=()

if ! check_cmd jq; then
  apt_packages+=(jq)
fi

if ! check_cmd qrencode; then
  apt_packages+=(qrencode)
fi

if ! check_cmd convert; then
  apt_packages+=(imagemagick)
fi

if ! check_cmd pdftotext; then
  apt_packages+=(poppler-utils)
fi

if ! check_cmd node || ! check_cmd npm; then
  apt_packages+=(nodejs npm)
fi

if [ ${#apt_packages[@]} -gt 0 ]; then
  echo "Installing system packages: ${apt_packages[*]}"
  sudo apt-get update
  sudo apt-get install -y "${apt_packages[@]}"
fi

for pkg in javascript-obfuscator html-minifier-terser; do
  if ! check_cmd "$pkg"; then
    npm install -g "$pkg"
  fi
done

# ensure Python packages used by the CLI are available
for py in InquirerPy rich; do
  python3 - <<EOF >/dev/null 2>&1
import importlib.util, sys
sys.exit(0 if importlib.util.find_spec('$py') else 1)
EOF
  if [ $? -ne 0 ]; then
    pip install --user "$py"
  fi
done

echo "All dependencies are installed."
