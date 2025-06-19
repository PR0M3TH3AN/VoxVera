#!/usr/bin/env bash
set -e

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
    curl -fsSL "$url" -o "$dest" || return 1
  elif command_exists wget; then
    wget -q "$url" -O "$dest" || return 1
  else
    echo "Install curl or wget to download voxvera" >&2
    return 2
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

if command_exists pipx; then
  if ! pipx install --force voxvera; then
    echo "pipx install failed, downloading binary"
    install_dir="$HOME/.local/bin"
    mkdir -p "$install_dir"
    url="https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera"
    dest="$install_dir/voxvera"
    if ! download_binary "$url" "$dest"; then
      echo "Binary download failed, falling back to pip." >&2
      pip_fallback
    else
      check_local_bin
    fi
  fi
else
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  url="https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera"
  dest="$install_dir/voxvera"
  if ! download_binary "$url" "$dest"; then
    echo "Binary download failed, falling back to pip." >&2
    pip_fallback
  else
    check_local_bin
  fi
fi

echo "VoxVera installed successfully."
