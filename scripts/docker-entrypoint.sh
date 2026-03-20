#!/usr/bin/env bash
set -euo pipefail

VOXVERA_DIR="${VOXVERA_DIR:-/flyers}"
VOXVERA_CONFIG_PATH="${VOXVERA_CONFIG_PATH:-$VOXVERA_DIR/config.json}"
VOXVERA_START_INTERVAL="${VOXVERA_START_INTERVAL:-300}"
VOXVERA_BOOTSTRAP_DEFAULT_SITE="${VOXVERA_BOOTSTRAP_DEFAULT_SITE:-1}"
TOR_SOCKS_PORT="${TOR_SOCKS_PORT:-9050}"
TOR_CONTROL_PORT="${TOR_CONTROL_PORT:-9051}"
VOXVERA_TOR_DIR="${VOXVERA_TOR_DIR:-/tmp/voxvera-tor}"

TOR_PID=""
SLEEP_PID=""

log() {
  printf '[voxvera-docker] %s\n' "$*"
}

cleanup() {
  if [[ -n "$SLEEP_PID" ]] && kill -0 "$SLEEP_PID" 2>/dev/null; then
    kill "$SLEEP_PID" 2>/dev/null || true
  fi
  voxvera stop-all >/dev/null 2>&1 || true
  if [[ -n "$TOR_PID" ]] && kill -0 "$TOR_PID" 2>/dev/null; then
    kill "$TOR_PID" 2>/dev/null || true
    wait "$TOR_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

wait_for_port() {
  local host="$1"
  local port="$2"
  python3 - "$host" "$port" <<'PY'
import socket
import sys
import time

host = sys.argv[1]
port = int(sys.argv[2])
deadline = time.time() + 60

while time.time() < deadline:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        if sock.connect_ex((host, port)) == 0:
            sys.exit(0)
    time.sleep(1)

sys.exit(1)
PY
}

has_site_configs() {
  find "$VOXVERA_DIR/host" -mindepth 2 -maxdepth 2 -name config.json -print -quit 2>/dev/null | grep -q .
}

seed_default_config() {
  mkdir -p "$VOXVERA_DIR"
  if [[ ! -f "$VOXVERA_CONFIG_PATH" ]]; then
    cp /opt/voxvera/voxvera/src/config.json "$VOXVERA_CONFIG_PATH"
    log "Seeded default config at $VOXVERA_CONFIG_PATH"
  fi
}

bootstrap_default_site_if_needed() {
  if [[ "$VOXVERA_BOOTSTRAP_DEFAULT_SITE" != "1" ]]; then
    return
  fi

  if has_site_configs; then
    return
  fi

  log "No sites found under $VOXVERA_DIR/host; bootstrapping default site"
  voxvera --config "$VOXVERA_CONFIG_PATH" init --non-interactive
}

start_tor() {
  mkdir -p "$VOXVERA_TOR_DIR"
  chmod 700 "$VOXVERA_TOR_DIR"

  cat >"$VOXVERA_TOR_DIR/torrc" <<EOF
DataDirectory $VOXVERA_TOR_DIR/data
SocksPort 127.0.0.1:$TOR_SOCKS_PORT
ControlPort 127.0.0.1:$TOR_CONTROL_PORT
CookieAuthentication 0
AvoidDiskWrites 1
Log notice stdout
EOF

  mkdir -p "$VOXVERA_TOR_DIR/data"
  log "Starting Tor on 127.0.0.1:$TOR_SOCKS_PORT / $TOR_CONTROL_PORT"
  tor -f "$VOXVERA_TOR_DIR/torrc" &
  TOR_PID="$!"

  wait_for_port 127.0.0.1 "$TOR_SOCKS_PORT"
  wait_for_port 127.0.0.1 "$TOR_CONTROL_PORT"
  log "Tor ports are reachable"
}

start_loop() {
  export TOR_SOCKS_PORT TOR_CONTROL_PORT

  while true; do
    if ! kill -0 "$TOR_PID" 2>/dev/null; then
      log "Tor exited unexpectedly"
      wait "$TOR_PID"
      exit 1
    fi

    log "Running voxvera start-all"
    voxvera start-all || true

    sleep "$VOXVERA_START_INTERVAL" &
    SLEEP_PID="$!"
    wait "$SLEEP_PID"
    SLEEP_PID=""
  done
}

seed_default_config
start_tor
bootstrap_default_site_if_needed
start_loop
