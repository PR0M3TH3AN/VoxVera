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

if command_exists pipx; then
  pipx install --force voxvera
else
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  url="https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera"
  dest="$install_dir/voxvera"
  if command_exists curl; then
    curl -fsSL "$url" -o "$dest"
  elif command_exists wget; then
    wget -q "$url" -O "$dest"
  else
    echo "Install curl or wget to download voxvera" >&2
    exit 1
  fi
  chmod +x "$dest"
fi

echo "VoxVera installed successfully."
