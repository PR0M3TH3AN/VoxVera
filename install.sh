#!/usr/bin/env bash
set -euo pipefail

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Detect package manager and sudo
if command_exists sudo; then
  SUDO="sudo"
elif [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  echo "This script requires root privileges. Please install sudo or run as root." >&2
  exit 1
fi

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

msg() { echo -e "\e[32m$*\e[0m"; }
warn() { echo -e "\e[33m$*\e[0m" >&2; }
die() { echo -e "\e[31m$*\e[0m" >&2; exit 1; }

install_pkg() {
  case "$PM" in
    apt)
      $SUDO apt-get install -y "$@"
      ;;
    dnf)
      $SUDO dnf install -y "$@"
      ;;
    yum)
      $SUDO yum install -y "$@"
      ;;
    pacman)
      $SUDO pacman -S --noconfirm "$@"
      ;;
    brew)
      brew install "$@"
      ;;
    apk)
      $SUDO apk add --no-cache "$@"
      ;;
  esac
}

# Ensure core dependencies are present (always run to ensure they are up to date)
msg "Checking and updating system dependencies..."
if [ "$PM" = "apt" ]; then
  $SUDO apt-get update
  SYSTEM_PKGS=(tor curl git python3-pip python3-venv)
  [ -n "$(command -v pipx)" ] || SYSTEM_PKGS+=(pipx)
  install_pkg "${SYSTEM_PKGS[@]}"
elif [ "$PM" = "brew" ]; then
  brew install tor onionshare curl git
else
  install_pkg tor curl git
fi

# Onionshare-cli - ensure it's installed and working (always attempt update if using pipx)
msg "Ensuring onionshare-cli is installed and up-to-date..."
if command_exists pipx && (pipx list | grep -q onionshare || ! command_exists onionshare-cli); then
  msg "Installing/Updating onionshare-cli via pipx..."
  pipx install --force git+https://github.com/onionshare/onionshare.git#subdirectory=cli || warn "pipx onionshare-cli install/update failed"
elif ! command_exists onionshare-cli && ! command_exists onionshare; then
  if ! install_pkg onionshare-cli; then
    warn "Onionshare-cli not found in system repositories. Attempting pipx install fallback."
    if ! command_exists pipx; then
      install_pkg pipx
      pipx ensurepath --force
      export PATH="$HOME/.local/bin:$PATH"
    fi
    if command_exists pipx; then
      msg "Installing onionshare-cli via pipx..."
      pipx install --force git+https://github.com/onionshare/onionshare.git#subdirectory=cli || warn "pipx onionshare-cli install failed"
    else
      warn "Could not install pipx. Please install onionshare-cli manually."
    fi
  fi
else
  msg "onionshare-cli found (system package), skipping pipx install. Run 'pipx install --force ...' if you want the latest git version."
fi

download_binary() {
  local url=$1
  local dest=$2
  if command_exists curl; then
    local status
    status=$(curl -w "%{http_code}" -fsSL "$url" -o "$dest" || true)
    if [ "$status" = "404" ]; then return 2; elif [ "$status" != "200" ]; then return 1; fi
  elif command_exists wget; then
    local out
    out=$(wget --server-response -q "$url" -O "$dest" 2>&1 || true)
    if echo "$out" | grep -q "404 Not Found"; then return 2; elif ! echo "$out" | grep -q "200 OK"; then return 1; fi
  else
    warn "Install curl or wget to download voxvera"
    return 1
  fi
  chmod +x "$dest"
}

# Install VoxVera (Always use --force to ensure fresh installation)
if command_exists pipx; then
  msg "Installing/Re-installing VoxVera via pipx..."
  if pipx install --force 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'; then
    msg "VoxVera installed/updated successfully via pipx."
    exit 0
  fi
  warn "pipx install failed, trying binary fallback..."
fi

install_dir="$HOME/.local/bin"
mkdir -p "$install_dir"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS" in
  linux*)  BINARY="voxvera-linux" ;;
  darwin*) BINARY="voxvera-macos" ;;
  *)       BINARY="voxvera-linux" ;;
esac

url="https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/${BINARY}"
dest="$install_dir/voxvera"
msg "Downloading VoxVera binary from $url..."
if download_binary "$url" "$dest"; then
  msg "VoxVera binary downloaded to $dest"
  [[ ":$PATH:" != *":$HOME/.local/bin:"* ]] && warn "Add \$HOME/.local/bin to your PATH."
else
  warn "Binary download failed. Attempting pip install as last resort..."
  # Use --break-system-packages on Debian 12+ if necessary
  PIP_OPTS="--user --upgrade"
  if [ -f /etc/debian_version ]; then
     DEB_VER=$(cat /etc/debian_version | cut -d. -f1)
     if [[ "$DEB_VER" =~ ^[0-9]+$ ]] && [ "$DEB_VER" -ge 12 ]; then
       PIP_OPTS="$PIP_OPTS --break-system-packages"
     fi
  fi
  if pip install $PIP_OPTS 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'; then
    msg "VoxVera installed via pip."
  else
    die "Installation failed."
  fi
fi

msg "\nVoxVera installed/updated successfully. Run 'voxvera check' to verify."
