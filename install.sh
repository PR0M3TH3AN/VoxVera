#!/usr/bin/env bash
set -euo pipefail

REPO="PR0M3TH3AN/VoxVera"
REPO_URL="https://github.com/${REPO}"
BRANCH="main"

# --- Network resilience settings ---
# Kill git operations that stall below 1 KB/s for 30 seconds
export GIT_HTTP_LOW_SPEED_LIMIT=1000
export GIT_HTTP_LOW_SPEED_TIME=30
# Disable partial clones — they are fragile on flaky connections
export GIT_CLONE_PROTECTION_ACTIVE=false
# Hard timeout (seconds) for any single network operation
NET_TIMEOUT=90

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
    apt)    $SUDO apt-get install -y "$@" ;;
    dnf)    $SUDO dnf install -y "$@" ;;
    yum)    $SUDO yum install -y "$@" ;;
    pacman) $SUDO pacman -S --noconfirm "$@" ;;
    brew)   brew install "$@" ;;
    apk)    $SUDO apk add --no-cache "$@" ;;
  esac
}

# --- Resilient download: tries curl then wget, with retries and timeout ---
download() {
  local url="$1" dest="$2"
  # Try curl first
  if command_exists curl; then
    local attempt
    for attempt in 1 2 3; do
      if timeout "$NET_TIMEOUT" curl -fsSL \
           --retry 2 --retry-delay 3 --retry-connrefused \
           --max-time "$NET_TIMEOUT" \
           "$url" -o "$dest" 2>/dev/null; then
        return 0
      fi
      warn "curl attempt $attempt failed for $(basename "$url")"
      sleep 2
    done
  fi
  # Try wget as fallback (different TLS stack — often works when curl doesn't)
  if command_exists wget; then
    local attempt
    for attempt in 1 2 3; do
      if timeout "$NET_TIMEOUT" wget -q --timeout=60 --tries=1 \
           "$url" -O "$dest" 2>/dev/null; then
        return 0
      fi
      warn "wget attempt $attempt failed for $(basename "$url")"
      sleep 2
    done
  fi
  return 1
}

# --- Resilient HTTP status check (for release tag redirect) ---
get_latest_tag() {
  local tag=""
  if command_exists curl; then
    tag=$(timeout 30 curl -fsSLI -o /dev/null -w '%{url_effective}' \
          "${REPO_URL}/releases/latest" 2>/dev/null | grep -oE '[^/]+$') || true
  fi
  if [ -z "$tag" ] && command_exists wget; then
    tag=$(timeout 30 wget --max-redirect=5 -q -S --spider \
          "${REPO_URL}/releases/latest" 2>&1 | grep -i 'Location:' | tail -1 | grep -oE '[^/]+$') || true
  fi
  echo "$tag"
}

# Ensure core dependencies are present
msg "Checking and updating system dependencies..."
if [ "$PM" = "apt" ]; then
  $SUDO apt-get update
  SYSTEM_PKGS=(tor curl wget git python3-pip python3-venv)
  [ -n "$(command -v pipx)" ] || SYSTEM_PKGS+=(pipx)
  install_pkg "${SYSTEM_PKGS[@]}"
elif [ "$PM" = "brew" ]; then
  brew install tor onionshare curl wget git
else
  install_pkg tor curl git
  # Best-effort install wget if not present
  install_pkg wget 2>/dev/null || true
fi

# Onionshare-cli
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

# --- Clean up stale state from previous installs (preserves ~/host tor sites) ---
msg "Cleaning up stale state from previous installs..."

# Stale user-local packages that may conflict with system onionshare-cli
for pydir in "$HOME"/.local/lib/python3.*/site-packages; do
  [ -d "$pydir" ] || continue
  for pkg in werkzeug flask flask_socketio onionshare_cli voxvera; do
    if [ -d "$pydir/$pkg" ]; then
      warn "Removing stale $pkg from $pydir"
      rm -rf "$pydir/$pkg" "$pydir/${pkg}-"*.dist-info 2>/dev/null || true
    fi
  done
done

# Stale pip wheel cache for voxvera (forces clean rebuild)
for cache_dir in "$HOME"/.cache/pip/wheels; do
  [ -d "$cache_dir" ] || continue
  find "$cache_dir" -name 'voxvera-*.whl' -delete 2>/dev/null || true
done

# Leftover temp files from previous failed install attempts
rm -rf /tmp/voxvera-* 2>/dev/null || true

# Stale top-level config.json from older VoxVera versions (not inside ~/host)
[ -f "$HOME/config.json" ] && grep -q '"folder_name"' "$HOME/config.json" 2>/dev/null && {
  warn "Removing stale ~/config.json (leftover from older VoxVera version)"
  rm -f "$HOME/config.json"
}

# Stale top-level imports/ directory (older versions put it in ~/)
if [ -d "$HOME/imports" ] && ls "$HOME/imports"/*.json &>/dev/null; then
  if head -1 "$HOME/imports"/*.json 2>/dev/null | grep -q '"folder_name"\|"headline"'; then
    warn "Removing stale ~/imports/ (leftover from older VoxVera version)"
    rm -rf "$HOME/imports"
  fi
fi

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

# --- Helper: remove stale standalone binary so it doesn't shadow pipx/pip entrypoints ---
cleanup_stale_binary() {
  local bin="$HOME/.local/bin/voxvera"
  [ -f "$bin" ] || return 0
  # Only remove actual compiled binaries (PyInstaller/native), not pip/pipx Python scripts
  if file "$bin" 2>/dev/null | grep -qiE 'ELF|Mach-O'; then
    warn "Removing stale standalone binary at $bin (would shadow pipx/pip entrypoint)"
    rm -f "$bin"
  fi
}

# ============================================================
# Strategy 1: Pre-built binary (fastest)
# ============================================================
install_binary() {
  msg "Strategy 1/5: Attempting to download pre-built binary..."

  local latest
  latest=$(get_latest_tag)
  [ -n "$latest" ] || { warn "Could not determine latest release tag."; return 1; }

  local install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  local dest="$install_dir/voxvera"
  local os_name arch binary
  os_name="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch=$(uname -m)

  case "$os_name" in
    linux*)  binary="voxvera-linux" ;;
    darwin*) binary="voxvera-macos" ;;
    *)       binary="voxvera-linux" ;;
  esac

  local url="${REPO_URL}/releases/download/${latest}/${binary}-${arch}"
  msg "Downloading: $url"

  if download "$url" "$dest"; then
    chmod +x "$dest"
    # Verify it's actually an executable, not an HTML error page
    if file "$dest" | grep -qiE 'ELF|executable|Mach-O'; then
      msg "VoxVera binary (${arch}) installed to $dest"
      [[ ":$PATH:" != *":$HOME/.local/bin:"* ]] && warn "Add \$HOME/.local/bin to your PATH."
      return 0
    fi
    warn "Downloaded file is not a valid binary."
  fi

  [ -f "$dest" ] && rm -f "$dest"
  warn "Binary download failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 2: GitHub tarball — no git needed, most network-resilient
# ============================================================
install_tarball() {
  msg "Strategy 2/5: Downloading source tarball (no git required)..."
  local tmp_tar tmp_dir
  tmp_tar=$(mktemp /tmp/voxvera-XXXXXX.tar.gz)
  tmp_dir=$(mktemp -d /tmp/voxvera-src-XXXXXX)

  if download "${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz" "$tmp_tar"; then
    if tar -xzf "$tmp_tar" -C "$tmp_dir" --strip-components=1 2>/dev/null; then
      if install_from_local "$tmp_dir"; then
        cleanup_stale_binary
        rm -rf "$tmp_tar" "$tmp_dir"
        return 0
      fi
    else
      warn "Tarball extraction failed."
    fi
  else
    warn "Tarball download failed."
  fi

  rm -rf "$tmp_tar" "$tmp_dir"
  warn "Tarball install failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 3: Shallow git clone + local pip install
# ============================================================
install_shallow() {
  msg "Strategy 3/5: Attempting shallow git clone (--depth 1)..."
  local tmp_dir
  tmp_dir=$(mktemp -d /tmp/voxvera-clone-XXXXXX)

  if timeout "$NET_TIMEOUT" git clone --depth 1 --single-branch --branch "$BRANCH" \
       "${REPO_URL}.git" "$tmp_dir" 2>&1; then
    if install_from_local "$tmp_dir"; then
      cleanup_stale_binary
      rm -rf "$tmp_dir"
      return 0
    fi
  else
    warn "Shallow clone failed or timed out after ${NET_TIMEOUT}s."
  fi

  rm -rf "$tmp_dir"
  warn "Shallow clone install failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 4: pipx from git (isolated venv)
# ============================================================
install_pipx() {
  command_exists pipx || return 1
  msg "Strategy 4/5: Attempting pipx installation..."
  if timeout 180 pipx install --force "voxvera@git+${REPO_URL}.git@${BRANCH}"; then
    pipx inject voxvera setuptools 2>/dev/null || true
    pipx ensurepath --force
    cleanup_stale_binary
    msg "\nVoxVera installed/updated successfully via pipx."
    msg "IMPORTANT: Please restart your terminal or run 'source ~/.bashrc' to use 'voxvera'."
    return 0
  fi
  warn "pipx install failed. Trying next method..."
  return 1
}

# ============================================================
# Strategy 5: pip from git (last resort)
# ============================================================
install_pip_git() {
  msg "Strategy 5/5: Attempting pip install from git..."
  local flags
  flags=$(pip_flags)
  if timeout 180 pip install $flags "voxvera@git+${REPO_URL}.git@${BRANCH}"; then
    cleanup_stale_binary
    msg "VoxVera installed via pip."
    return 0
  fi
  warn "pip git install failed."
  return 1
}

# ============================================================
# Run strategies in order — first success wins
# ============================================================
# Order rationale:
#   1. Binary — fastest, single download
#   2. Tarball — no git needed, single download, most resilient on flaky TLS
#   3. Shallow clone — small git transfer
#   4. pipx — git clone internally, but isolated venv
#   5. pip git — git clone internally, last resort
for strategy in install_binary install_tarball install_shallow install_pipx install_pip_git; do
  if $strategy; then
    # Ensure ~/.local/bin is on PATH
    if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
      export PATH="$HOME/.local/bin:$PATH"
    fi
    # Clear bash's cached command path so the new binary is found immediately
    hash -r 2>/dev/null || true
    msg "\nVoxVera installed/updated successfully. Run 'voxvera check' to verify."
    # Detect if the parent shell will still have a stale hash
    msg "If 'voxvera' is not found, run:  hash -r  (or open a new terminal)"
    exit 0
  fi
done

die "All installation methods failed. Your network may be blocking or corrupting HTTPS traffic to GitHub.\nTry downloading manually from a working machine:\n  ${REPO_URL}/archive/refs/heads/${BRANCH}.tar.gz\nThen copy to this machine and run:\n  tar xzf VoxVera-main.tar.gz && pip install --user ./VoxVera-main"
