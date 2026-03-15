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
if command_exists curl; then
  msg "Attempting to download latest VoxVera binary..."
  # Get the latest release tag
  latest=$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/PR0M3TH3AN/VoxVera/releases/latest | grep -oE '[^/]+$')
  
  install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  dest="$install_dir/voxvera"
  OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
  ARCH=$(uname -m)
  
  case "$OS" in
    linux*)  BINARY="voxvera-linux" ;;
    darwin*) BINARY="voxvera-macos" ;;
    *)       BINARY="voxvera-linux" ;;
  esac
  
  # Try to download architecture-specific binary (e.g. voxvera-linux-x86_64)
  url="https://github.com/PR0M3TH3AN/VoxVera/releases/download/${latest}/${BINARY}-${ARCH}"
  # For Windows, PyInstaller might add .exe but here we focus on linux/mac
  
  msg "Downloading from: $url"
  set +e
  status=$(curl -w "%{http_code}" -fsSL "$url" -o "$dest")
  curl_exit=$?
  set -e
  
  if [ $curl_exit -eq 0 ] && [ "$status" = "200" ]; then
    chmod +x "$dest"
    msg "VoxVera binary (${ARCH}) installed to $dest"
    [[ ":$PATH:" != *":$HOME/.local/bin:"* ]] && warn "Add \$HOME/.local/bin to your PATH."
    exit 0
  else
    warn "Binary download failed (status: $status, exit: $curl_exit). Falling back to source installation."
    [ -f "$dest" ] && rm "$dest"
  fi
fi

if command_exists pipx; then
  msg "Falling back to pipx installation (this may take a few minutes)..."
  if pipx install --force 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'; then
    pipx ensurepath --force
    msg "\nVoxVera installed/updated successfully via pipx."
    msg "IMPORTANT: Please restart your terminal or run 'source ~/.bashrc' (or your shell config) to use 'voxvera'."
    exit 0
  fi
  warn "pipx install failed, trying pip fallback..."
fi

# Fallback to pip
msg "Installing/Updating VoxVera via pip..."
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

msg "\nVoxVera installed/updated successfully. Run 'voxvera check' to verify."
