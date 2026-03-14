#!/usr/bin/env bash
# --------------------------------------------------------------------
# VoxVera all-in-one installer (Linux) – run once as a normal user.
# Installs Tor + OnionShare and VoxVera itself.
# Build dependencies (QR, HTML minification, PDF parsing) are Python
# packages installed automatically — no Node.js or ImageMagick needed.
# --------------------------------------------------------------------
set -euo pipefail

## -------- helper functions -----------------------------------------
command_exists() { command -v "$1" &>/dev/null; }

msg()   { printf "\e[32m%s\e[0m\n" "$*"; }
warn()  { printf "\e[33m%s\e[0m\n" "$*" >&2; }
die()   { printf "\e[31mERROR: %s\e[0m\n" "$*" >&2; exit 1; }

## -------- determine package manager --------------------------------
if   command_exists apt-get; then PM=apt   ; UPDATE="sudo apt-get update"                ; INSTALL="sudo apt-get install -y"
elif command_exists dnf;      then PM=dnf   ; UPDATE="sudo dnf -y makecache"              ; INSTALL="sudo dnf install -y"
elif command_exists yum;      then PM=yum   ; UPDATE="sudo yum makecache"                 ; INSTALL="sudo yum install -y"
elif command_exists pacman;   then PM=pacman; UPDATE="sudo pacman -Sy"                    ; INSTALL="sudo pacman -S --noconfirm"
elif command_exists apk;      then PM=apk   ; UPDATE="sudo apk update"                    ; INSTALL="sudo apk add --no-cache"
else die "Unsupported distro – can't find apt/yum/dnf/pacman/apk."
fi

msg ">> Detected package manager: $PM"

## -------- install system packages ----------------------------------
# Only runtime dependencies for Tor hosting are needed as system packages.
# Build tools (QR, minification, PDF parsing) are all Python packages now.
SYSTEM_PKGS=(tor curl)
# OnionShare package name differs per repo:
[[ $PM =~ (apt|dnf|yum) ]] && SYSTEM_PKGS+=(onionshare-cli) || SYSTEM_PKGS+=(onionshare)

$UPDATE && $INSTALL "${SYSTEM_PKGS[@]}"

## -------- install VoxVera (prefers pipx, falls back) ---------------
install_voxvera() {
  if command_exists pipx; then
    pipx install --force 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main' && return 0
  fi
  # fallback: binary
  local install_dir="$HOME/.local/bin"
  mkdir -p "$install_dir"
  local url latest dest="$install_dir/voxvera"
  url=$(curl -fsSLI -o /dev/null -w '%{url_effective}' \
        https://github.com/PR0M3TH3AN/VoxVera/releases/latest)
  latest="${url%/}" ; latest="${latest##*/}"      # vX.Y.Z tag
  url="https://github.com/PR0M3TH3AN/VoxVera/releases/download/${latest/\/}/voxvera-linux"
  if curl -fsSL "$url" -o "$dest"; then
    chmod +x "$dest"
    PATH="$install_dir:$PATH"
    return 0
  fi
  # fallback: pip
  pip install --user 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
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
  sudo systemctl enable tor || true
  sudo systemctl restart tor
fi

msg "------------------------------------------------------------------"
msg "   VoxVera install finished!"
msg "   Tor rc file : $TOR_DIR/torrc"
msg "   Make sure \$HOME/.local/bin is in your PATH."
msg "   Run 'voxvera check' to verify your setup."
msg "------------------------------------------------------------------"
