#!/usr/bin/env bash
set -euo pipefail

REPO="PR0M3TH3AN/VoxVera"
REPO_URL="https://github.com/${REPO}"
BRANCH="main"

# --- Network resilience settings ---
# Kill git operations that stall below 1 KB/s for 30 seconds
export GIT_HTTP_LOW_SPEED_LIMIT=1000
export GIT_HTTP_LOW_SPEED_TIME=30
# Force TLS 1.2 to avoid GnuTLS negotiation bugs on older distros
export GIT_SSL_VERSION=tlsv1.2
# Timeout for curl operations (seconds)
CURL_TIMEOUT=120
CURL_RETRY=3
CURL_RETRY_DELAY=5

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

# Resilient curl wrapper with retries and timeout
safe_curl() {
  curl --max-time "$CURL_TIMEOUT" \
       --retry "$CURL_RETRY" \
       --retry-delay "$CURL_RETRY_DELAY" \
       --retry-connrefused \
       --tlsv1.2 \
       "$@"
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

# Clean up stale user-local packages from prior pip --user installs of voxvera.
# These shadow system packages (e.g. Werkzeug) and break onionshare-cli.
msg "Cleaning up stale user-local packages that may conflict with system onionshare-cli..."
for pydir in "$HOME"/.local/lib/python3.*/site-packages; do
  [ -d "$pydir" ] || continue
  for pkg in werkzeug flask flask_socketio onionshare_cli voxvera; do
    if [ -d "$pydir/$pkg" ]; then
      warn "Removing stale $pkg from $pydir"
      rm -rf "$pydir/$pkg" "$pydir/${pkg}-"*.dist-info 2>/dev/null || true
    fi
  done
done

# --- Helper: build pip flags for this distro ---
pip_flags() {
  local flags="--user --upgrade"
  if [ -f /etc/debian_version ]; then
    local deb_ver
    deb_ver=$(cut -d. -f1 < /etc/debian_version)
    if [[ "$deb_ver" =~ ^[0-9]+$ ]] && [ "$deb_ver" -ge 12 ]; then
      flags="$flags --break-system-packages"
    fi
  fi
  echo "$flags"
}

# --- Helper: install from a local source directory ---
install_from_local() {
  local src_dir="$1"
  msg "Installing VoxVera from local source ($src_dir)..."
  local flags
  flags=$(pip_flags)
  if pip install $flags "$src_dir"; then
    msg "VoxVera installed from local source."
    return 0
  fi
  return 1
}

# --- Helper: download and install from GitHub tarball (no git needed) ---
install_from_tarball() {
  msg "Downloading VoxVera source tarball..."
  local tmp_tar tmp_dir
  tmp_tar=$(mktemp /tmp/voxvera-XXXXXX.tar.gz)
  tmp_dir=$(mktemp -d /tmp/voxvera-src-XXXXXX)

  if safe_curl -fsSL "${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz" -o "$tmp_tar"; then
    tar -xzf "$tmp_tar" -C "$tmp_dir" --strip-components=1
    if install_from_local "$tmp_dir"; then
      rm -rf "$tmp_tar" "$tmp_dir"
      return 0
    fi
  else
    warn "Tarball download failed."
  fi
  rm -rf "$tmp_tar" "$tmp_dir"
  return 1
}

# --- Helper: shallow clone and install ---
install_from_shallow_clone() {
  msg "Attempting shallow git clone (--depth 1)..."
  local tmp_dir
  tmp_dir=$(mktemp -d /tmp/voxvera-clone-XXXXXX)

  if git clone --depth 1 --single-branch --branch "$BRANCH" "${REPO_URL}.git" "$tmp_dir"; then
    if install_from_local "$tmp_dir"; then
      rm -rf "$tmp_dir"
      return 0
    fi
  else
    warn "Shallow clone failed."
  fi
  rm -rf "$tmp_dir"
  return 1
}

# ============================================================
# Strategy 1: Pre-built binary (fastest, no compilation needed)
# ============================================================
install_binary() {
  command_exists curl || return 1
  msg "Attempting to download latest VoxVera binary..."

  local latest
  latest=$(safe_curl -fsSLI -o /dev/null -w '%{url_effective}' "${REPO_URL}/releases/latest" | grep -oE '[^/]+$') || return 1

  local install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  local dest="$install_dir/voxvera"
  local os_name arch binary url
  os_name="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch=$(uname -m)

  case "$os_name" in
    linux*)  binary="voxvera-linux" ;;
    darwin*) binary="voxvera-macos" ;;
    *)       binary="voxvera-linux" ;;
  esac

  url="${REPO_URL}/releases/download/${latest}/${binary}-${arch}"
  msg "Downloading from: $url"

  set +e
  local status
  status=$(safe_curl -w "%{http_code}" -fsSL "$url" -o "$dest")
  local curl_exit=$?
  set -e

  if [ $curl_exit -eq 0 ] && [ "$status" = "200" ]; then
    chmod +x "$dest"
    msg "VoxVera binary (${arch}) installed to $dest"
    [[ ":$PATH:" != *":$HOME/.local/bin:"* ]] && warn "Add \$HOME/.local/bin to your PATH."
    return 0
  fi

  warn "Binary download failed (status: ${status:-?}, exit: $curl_exit). Trying next method..."
  [ -f "$dest" ] && rm -f "$dest"
  return 1
}

# ============================================================
# Strategy 2: pipx from git (isolated venv)
# ============================================================
install_pipx() {
  command_exists pipx || return 1
  msg "Attempting pipx installation..."
  if pipx install --force "voxvera@git+${REPO_URL}.git@${BRANCH}"; then
    pipx inject voxvera setuptools 2>/dev/null || true
    pipx ensurepath --force
    msg "\nVoxVera installed/updated successfully via pipx."
    msg "IMPORTANT: Please restart your terminal or run 'source ~/.bashrc' (or your shell config) to use 'voxvera'."
    return 0
  fi
  warn "pipx install failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 3: pip from git
# ============================================================
install_pip_git() {
  msg "Attempting pip install from git..."
  local flags
  flags=$(pip_flags)
  if pip install $flags "voxvera@git+${REPO_URL}.git@${BRANCH}"; then
    msg "VoxVera installed via pip."
    return 0
  fi
  warn "pip git install failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 4: GitHub tarball (no git clone needed — most resilient)
# ============================================================
install_tarball() {
  install_from_tarball && return 0
  warn "Tarball install failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 5: Shallow clone + local pip install
# ============================================================
install_shallow() {
  install_from_shallow_clone && return 0
  warn "Shallow clone install failed."
  return 1
}

# ============================================================
# Run strategies in order — first success wins
# ============================================================
for strategy in install_binary install_pipx install_pip_git install_tarball install_shallow; do
  if $strategy; then
    msg "\nVoxVera installed/updated successfully. Run 'voxvera check' to verify."
    exit 0
  fi
done

die "All installation methods failed. Check your network connection and try again, or clone manually:\n  git clone --depth 1 ${REPO_URL}.git /tmp/voxvera && pip install --user /tmp/voxvera"
