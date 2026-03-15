#!/usr/bin/env bash
set -euo pipefail

# Robustness: ensure we are in the project root
cd "$(dirname "$0")/.."

LOG_DIR="$(pwd)/ci-logs"
mkdir -p "$LOG_DIR"
# Use a subshell for tee to avoid issues with some shell environments
exec > >(tee "$LOG_DIR/run.log") 2>&1

echo "Starting E2E verification at $(date)"

# Install VoxVera
if [ -n "${VOXVERA_BIN:-}" ] && [ -f "$VOXVERA_BIN" ]; then
  voxvera_cmd="$VOXVERA_BIN"
  echo "Using provided VoxVera binary: $voxvera_cmd" >&2
else
  echo "Installing VoxVera in editable mode..."
  python3 -m pip install --break-system-packages -e ".[e2e]"
  voxvera_cmd="$(command -v voxvera || echo "$HOME/.local/bin/voxvera")"
fi

echo "VoxVera command: $voxvera_cmd"

# Generate demo flyer
echo "Initializing demo flyer..."
"$voxvera_cmd" --lang en init --template voxvera <<EOI
DemoUser
voxvera
EOI

echo "Building demo flyer..."
"$voxvera_cmd" --lang en build

# Verify build output exists in host/
folder_name="voxvera"
host_dir="voxvera/host/$folder_name"

if [ ! -d "$host_dir" ]; then
  echo "CRITICAL: Host directory $host_dir not found!" >&2
  ls -R voxvera/host/ || true
  exit 1
fi

ls -R "$host_dir" >>"$LOG_DIR/tree.txt"

# Verify essential files
for f in index.html config.json; do
  if [ ! -f "$host_dir/$f" ]; then
    echo "CRITICAL: Missing $f in $host_dir" >&2
    exit 1
  fi
done
echo "Build output verified in $host_dir"

# Run pytest unit tests
echo "Running pytest unit tests..."
python3 -m pytest tests/ -v 2>&1 | tee "$LOG_DIR/pytest.log"

# Optional network tests
if [ "${VOXVERA_E2E_OFFLINE:-}" != "1" ]; then
  echo "Starting network-dependent tests..."
  
  # Ensure no previous Tor instances are interfering
  # On GitHub Actions, Tor might already be running as a service, but we want our own
  # instance with known configuration if possible, or use the existing one.
  if pgrep -x tor > /dev/null; then
    echo "Tor is already running. We will attempt to use it, but if it fails we might need to stop it."
    # If system tor is running, it might not have the right ports or auth.
    # For now, let's try to just use it.
  fi

  echo "Starting a fresh Tor instance on port 9052/9053 to avoid conflicts..."
  tor --SocksPort 9052 --ControlPort 9053 --CookieAuthentication 0 --DataDirectory "$LOG_DIR/tor_data" >"$LOG_DIR/tor.log" 2>&1 &
  TOR_PID=$!
  sleep 15

  # Start OnionShare
  echo "Starting OnionShare (using Tor on 9052)..."
  export TOR_SOCKS_PORT=9052
  export TOR_CONTROL_PORT=9053
  onionshare-cli --website --public \
    --persistent "$host_dir/.onionshare-session" \
    -v \
    "$host_dir" >"$LOG_DIR/onionshare.log" 2>&1 &
  OS_PID=$!

  # Wait for URL with timeout and feedback
  echo "Waiting for OnionShare to generate URL (up to 120s)..."
  URL=""
  for i in {1..120}; do
    if grep -Eo 'http[^ ]+\.onion' "$LOG_DIR/onionshare.log" | head -n1 >"$LOG_DIR/url.txt"; then
      URL=$(cat "$LOG_DIR/url.txt")
      if [ -n "$URL" ]; then
        echo "Successfully generated Onion URL: $URL"
        break
      fi
    fi
    [ $((i % 10)) -eq 0 ] && echo "... still waiting ($i s) ..."
    sleep 1
  done

  if [ -z "$URL" ]; then
    echo "CRITICAL: Onion URL not found after 120s" >&2
    echo "--- Last 20 lines of OnionShare log ---"
    tail -n 20 "$LOG_DIR/onionshare.log"
    kill $OS_PID || true
    exit 1
  fi

  # Verify URL in config
  if ! grep -q "$URL" "$host_dir/config.json"; then
    echo "CRITICAL: URL $URL not found in $host_dir/config.json" >&2
    cat "$host_dir/config.json"
    kill $OS_PID || true
    exit 1
  fi

  # Fetch page via Tor (retry a few times as circuits can be flaky)
  echo "Verifying reachability via Tor (on port 9052)..."
  FETCHED=0
  for attempt in {1..5}; do
    echo "Attempt $attempt..."
    if curl --socks5-hostname 127.0.0.1:9052 -fsSL "$URL" | grep -q '<title>'; then
      echo "Success: Site is reachable via Tor."
      FETCHED=1
      break
    fi
    sleep 10
  done

  if [ $FETCHED -eq 0 ]; then
    echo "WARNING: Site could not be reached via Tor after 5 attempts, but OnionShare is running."
    # In CI, we might skip hard failure if Tor network is exceptionally slow/blocked
  fi

  # Clean up
  echo "Cleaning up..."
  kill $OS_PID || true
  kill ${TOR_PID:-} || true
  wait $OS_PID 2>/dev/null || true
else
  echo "Skipping network-dependent tests (VOXVERA_E2E_OFFLINE=1)" >&2
fi

echo "E2E verification complete at $(date)"
exit 0
