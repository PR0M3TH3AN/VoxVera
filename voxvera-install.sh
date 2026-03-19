#!/usr/bin/env bash
# --------------------------------------------------------------------
# VoxVera all-in-one installer (Linux) – run once as a normal user.
# Installs Tor + OnionShare and VoxVera itself.
# --------------------------------------------------------------------
set -euo pipefail
OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"

## -------- helper functions -----------------------------------------
command_exists() { command -v "$1" &>/dev/null; }

msg()   { printf "\e[32m%s\e[0m\n" "$*"; }
warn()  { printf "\e[33m%s\e[0m\n" "$*" >&2; }
die()   { printf "\e[31mERROR: %s\e[0m\n" "$*" >&2; exit 1; }

report_cli_status() {
  command_exists voxvera || return 0

  local platform_json doctor_json autostart_json
  platform_json="$(voxvera platform-status --json 2>/dev/null || true)"
  doctor_json="$(voxvera doctor --json 2>/dev/null || true)"
  autostart_json="$(voxvera autostart status --json 2>/dev/null || true)"

  if [ -n "$platform_json" ]; then
    PLATFORM_JSON="$platform_json" python3 - <<'PY'
import json, os
data = json.loads(os.environ["PLATFORM_JSON"])
print(f"Platform tier: {data.get('tier', 'unknown')} ({data.get('label', 'unknown')})")
if data.get("hosting_model"):
    print(f"Hosting model: {data['hosting_model']}")
PY
  fi

  if [ -n "$doctor_json" ]; then
    DOCTOR_JSON="$doctor_json" python3 - <<'PY'
import json, os
data = json.loads(os.environ["DOCTOR_JSON"])
failed = [check["name"] for check in data.get("checks", []) if not check.get("ok")]
if failed:
    print("Doctor checks needing attention: " + ", ".join(failed))
else:
    print("Doctor checks: all passed")
PY
  fi

  if [ -n "$autostart_json" ]; then
    AUTOSTART_JSON="$autostart_json" python3 - <<'PY'
import json, os
data = json.loads(os.environ["AUTOSTART_JSON"])
print("Autostart: " + data.get("message", "unknown"))
PY
  fi
}

# Detect sudo/root
if command_exists sudo; then
  SUDO="sudo"
elif [ "$(id -u)" -eq 0 ]; then
  SUDO=""
else
  die "This script requires root privileges. Please install sudo or run as root."
fi

## -------- determine package manager --------------------------------
if   command_exists apt-get; then PM=apt   ; UPDATE="$SUDO apt-get update"                ; INSTALL="$SUDO apt-get install -y"
elif command_exists dnf;      then PM=dnf   ; UPDATE="$SUDO dnf -y makecache"              ; INSTALL="$SUDO dnf install -y"
elif command_exists yum;      then PM=yum   ; UPDATE="$SUDO yum makecache"                 ; INSTALL="$SUDO yum install -y"
elif command_exists pacman;   then PM=pacman; UPDATE="$SUDO pacman -Sy"                    ; INSTALL="$SUDO pacman -S --noconfirm"
elif command_exists apk;      then PM=apk   ; UPDATE="$SUDO apk update"                    ; INSTALL="$SUDO apk add --no-cache"
else die "Unsupported distro – can't find apt/yum/dnf/pacman/apk."
fi

msg ">> Detected package manager: $PM"
if [[ "$OS_NAME" != linux* ]]; then
  warn "This installer is experimental outside Linux and is not validated for reliable background hidden-service hosting."
fi

## -------- install system packages ----------------------------------
msg ">> Installing system dependencies..."
SYSTEM_PKGS=(tor curl git python3-pip python3-venv)
$UPDATE && $INSTALL "${SYSTEM_PKGS[@]}"

# Onionshare-cli - ensure it's installed and working (always attempt update if using pipx)
msg ">> Ensuring onionshare-cli is installed and up-to-date..."
if command_exists pipx && (pipx list | grep -q onionshare || ! command_exists onionshare-cli); then
  msg "Installing/Updating onionshare-cli via pipx..."
  pipx install --force git+https://github.com/onionshare/onionshare.git#subdirectory=cli || warn "pipx OnionShare install/update failed"
elif ! command_exists onionshare-cli && ! command_exists onionshare; then
  msg "Attempting to install OnionShare..."
  OS_PKG="onionshare-cli"
  [[ ! $PM =~ (apt|dnf|yum) ]] && OS_PKG="onionshare"

  if ! $INSTALL "$OS_PKG"; then
    warn "OnionShare not found in system repositories. Attempting pipx install fallback."
    if ! command_exists pipx; then
      msg "Installing pipx..."
      $INSTALL pipx
      pipx ensurepath --force
      export PATH="$HOME/.local/bin:$PATH"
    fi
    if command_exists pipx; then
      msg "Installing/Updating onionshare-cli via pipx..."
      pipx install --force git+https://github.com/onionshare/onionshare.git#subdirectory=cli || warn "pipx OnionShare install failed"
    else
      warn "pipx not found. Skipping OnionShare installation."
    fi
  fi
fi

## -------- install VoxVera (prefers binary, falls back) -------------
install_voxvera() {
  local install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  local url latest dest="$install_dir/voxvera"

  if command_exists curl; then
    msg "Attempting to download latest VoxVera binary..."
    # Get the latest release tag
    latest=$(curl -fsSLI -o /dev/null -w '%{url_effective}' https://github.com/PR0M3TH3AN/VoxVera/releases/latest | grep -oE '[^/]+$')
    
    OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
    ARCH=$(uname -m)
    case "$OS" in
      linux*)  BINARY="voxvera-linux" ;;
      darwin*) BINARY="voxvera-macos" ;;
      *)       BINARY="voxvera-linux" ;;
    esac
    
    # Try to download architecture-specific binary (e.g. voxvera-linux-x86_64)
    url="https://github.com/PR0M3TH3AN/VoxVera/releases/download/${latest}/${BINARY}-${ARCH}"
    
    msg "Downloading from: $url"
    set +e
    local status
    status=$(curl -w "%{http_code}" -fsSL "$url" -o "$dest")
    local curl_exit=$?
    set -e
    
    if [ $curl_exit -eq 0 ] && [ "$status" = "200" ]; then
      chmod +x "$dest"
      msg "VoxVera binary (${ARCH}) installed to $dest"
      return 0
    else
      warn "Binary download failed (status: $status, exit: $curl_exit). Falling back to source installation."
      [ -f "$dest" ] && rm "$dest"
    fi
  fi

  # Fallback to pipx
  if command_exists pipx; then
    msg "Falling back to pipx installation (this may take a few minutes)..."
    if pipx install --force 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'; then
      pipx ensurepath --force
      return 0
    fi
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
  pip install $PIP_OPTS 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
}

msg ">> Installing VoxVera"
install_voxvera || die "VoxVera installation failed"

## -------- minimal Tor config ( socks 9050 / ctl 9051 ) --------------
TOR_DIR="$HOME/.voxvera"
mkdir -p "$TOR_DIR"
cat > "$TOR_DIR/torrc" <<EOF
SOCKSPort 9050
ControlPort 9051
CookieAuthentication 1
EOF

# enable + start tor via systemctl if available
if command_exists systemctl; then
  $SUDO systemctl enable tor || true
  $SUDO systemctl restart tor || true
fi

if command_exists voxvera && [[ "$OS_NAME" == linux* ]]; then
  msg ">> Installing Linux autostart recovery timer..."
  voxvera autostart 2>/dev/null || warn "Could not install the VoxVera autostart timer automatically. Run 'voxvera autostart' manually."
fi

if command_exists voxvera; then
  msg ">> Inspecting installed runtime posture..."
  report_cli_status
fi

msg "------------------------------------------------------------------"
msg "   VoxVera install finished!"
msg "   Tor rc file : $TOR_DIR/torrc"
msg ""
msg "   IMPORTANT: Please restart your terminal or run 'source ~/.bashrc'"
msg "   (or your shell config) to use 'voxvera'."
msg ""
msg "   Linux is the supported persistent-host target."
msg "   Other package/install paths remain experimental."
msg ""
msg "   Run 'voxvera check' to verify your setup after refreshing."
msg "------------------------------------------------------------------"
