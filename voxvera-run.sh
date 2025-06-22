#!/usr/bin/env bash
# --------------------------------------------------------------------
# VoxVera runtime launcher – check Tor, fire up OnionShare + VoxVera
# --------------------------------------------------------------------
set -euo pipefail
TOR_SOCKS_PORT=${TOR_SOCKS_PORT:-9050}
TOR_CONTROL_PORT=${TOR_CONTROL_PORT:-9051}
TORRC="$HOME/.voxvera/torrc"

command_exists() { command -v "$1" &>/dev/null; }
die()            { printf "\e[31m%s\e[0m\n" "$*" >&2; exit 1; }

## -------- ensure tor is running ------------------------------------
tor_ok() {
  # quick check: can we connect to socks port?
  (exec 3<>/dev/tcp/127.0.0.1/$TOR_SOCKS_PORT) 2>/dev/null
}

if ! tor_ok; then
  echo ">> Tor isn’t running – attempting to start it..."
  if command_exists systemctl; then
    sudo systemctl start tor.service || true
    sleep 3
  fi
  if ! tor_ok; then
    # fallback: foreground tor (detached)
    tor -f "$TORRC" --hush &>/dev/null &
    sleep 5
    tor_ok || die "Tor failed to start – check $TORRC"
  fi
fi
echo ">> Tor OK on ports $TOR_SOCKS_PORT / $TOR_CONTROL_PORT"

export TOR_SOCKS_PORT TOR_CONTROL_PORT

## -------- launch VoxVera -------------------------------------------
if ! command_exists voxvera; then
  die "voxvera not in PATH – did you complete the install?"
fi

echo ">> Running VoxVera quickstart (non-interactive)"
voxvera quickstart --non-interactive
