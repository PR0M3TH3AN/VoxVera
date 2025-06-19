#!/usr/bin/env bash
set -euo pipefail

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Detect package manager
if command_exists apt-get; then
  PM="apt"
elif command_exists dnf; then
  PM="dnf"
elif command_exists yum; then
  PM="yum"
elif command_exists pacman; then
  PM="pacman"
elif command_exists brew; then
  PM="brew"
elif command_exists apk; then
  PM="apk"
else
  echo "Unsupported system: could not detect package manager" >&2
  exit 1
fi

install_pkg() {
  case "$PM" in
    apt)
      sudo apt-get update
      sudo apt-get install -y "$@"
      ;;
    dnf)
      sudo dnf install -y "$@"
      ;;
    yum)
      sudo yum install -y "$@"
      ;;
    pacman)
      sudo pacman -Sy --noconfirm "$@"
      ;;
    brew)
      brew install "$@"
      ;;
    apk)
      sudo apk add --no-cache "$@"
      ;;
  esac
}

require_pkg() {
  local cmd=$1
  local pkg=$2
  if ! command_exists "$cmd"; then
    install_pkg "$pkg"
  fi
}

require_pkg tor tor
require_pkg onionshare-cli onionshare-cli
require_pkg jq jq
require_pkg qrencode qrencode
require_pkg convert imagemagick

download_binary() {
  local url=$1
  local dest=$2
  if command_exists curl; then
    local status
    status=$(curl -w "%{http_code}" -fsSL "$url" -o "$dest" || true)
    if [ "$status" = "404" ]; then
      return 2
    elif [ "$status" != "200" ]; then
      return 1
    fi
  elif command_exists wget; then
    local out
    out=$(wget --server-response -q "$url" -O "$dest" 2>&1 || true)
    if echo "$out" | grep -q "404 Not Found"; then
      return 2
    elif ! echo "$out" | grep -q "200 OK"; then
      return 1
    fi
  else
    echo "Install curl or wget to download voxvera" >&2
    return 1
  fi
  chmod +x "$dest"
}

check_local_bin() {
  if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo "Add \$HOME/.local/bin to your PATH to run VoxVera."
  fi
}

pip_fallback() {
  if command_exists pip; then
    echo "Attempting pip install as fallback..."
    if pip install --user voxvera; then
      echo "VoxVera installed successfully via pip."
      exit 0
    fi
    echo "pip installation failed." >&2
  else
    echo "pip not found for fallback installation" >&2
  fi
  exit 1
}

pip_repo_fallback() {
  if command_exists pip; then
    echo "Attempting pip install from repository as fallback..."
    if pip install --user git+https://github.com/PR0M3TH3AN/VoxVera; then
      echo "VoxVera installed successfully from repository."
      exit 0
    fi
    echo "pip installation from repository failed." >&2
  else
    echo "pip not found for fallback installation" >&2
  fi
  exit 1
}

if command_exists pipx; then
  if ! pipx install --force voxvera; then
    echo "pipx install failed, downloading binary"
    install_dir="$HOME/.local/bin"
    mkdir -p "$install_dir"
    url="https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera"
    dest="$install_dir/voxvera"
    if download_binary "$url" "$dest"; then
      check_local_bin
    else
      rc=$?
      echo "Binary download failed." >&2
      if [ $rc -eq 2 ]; then
        echo "Release asset not found, installing from repository." >&2
        pip_repo_fallback
      else
        pip_fallback
      fi
    fi
  fi
else
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  url="https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera"
  dest="$install_dir/voxvera"
  if download_binary "$url" "$dest"; then
    check_local_bin
  else
    rc=$?
    echo "Binary download failed." >&2
    if [ $rc -eq 2 ]; then
      echo "Release asset not found, installing from repository." >&2
      pip_repo_fallback
    else
      pip_fallback
    fi
  fi
fi

echo "VoxVera installed successfully."
