#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="$(pwd)/ci-logs"
mkdir -p "$LOG_DIR"
exec > >(tee "$LOG_DIR/run.log") 2>&1

# Install VoxVera
if [ -n "${VOXVERA_BIN:-}" ]; then
  voxvera_cmd="$VOXVERA_BIN"
  echo "Using provided VoxVera binary: $voxvera_cmd" >&2
else
  { time pip install --break-system-packages -e .; } 2>&1
  voxvera_cmd="$(command -v voxvera)"
fi

# Generate demo flyer
"$voxvera_cmd" --lang en init --template voxvera <<EOI
DemoUser
demosite
EOI
"$voxvera_cmd" --lang en build

# Verify build output exists in host/
folder_name=$(python3 -c "import json; print(json.load(open('voxvera/host/voxvera/config.json'))['folder_name'])")
host_dir="voxvera/host/$folder_name"
ls -R "$host_dir" >>"$LOG_DIR/tree.txt"

# Verify essential files
for f in index.html config.json; do
  [ -f "$host_dir/$f" ] || { echo "Missing $f in $host_dir" >&2; exit 1; }
done
echo "Build output verified in $host_dir"

# Run pytest unit tests
python3 -m pytest tests/ -v 2>&1 | tee "$LOG_DIR/pytest.log"

# Optional network tests
if [ "${VOXVERA_E2E_OFFLINE:-}" != "1" ]; then
  # Start Tor
  tor >"$LOG_DIR/tor.log" 2>&1 &
  TOR_PID=$!
  sleep 10

  # Start OnionShare
  onionshare-cli --website --public \
    --persistent "$host_dir/.onionshare-session" \
    -v \
    "$host_dir" >"$LOG_DIR/onionshare.log" 2>&1 &
  OS_PID=$!

  # Wait for URL
  URL=""
  i=0
  while [ $i -lt 90 ]; do
    if grep -Eo 'http[^ ]+\.onion' "$LOG_DIR/onionshare.log" | head -n1 >"$LOG_DIR/url.txt"; then
      URL=$(cat "$LOG_DIR/url.txt")
      [ -n "$URL" ] && break
    fi
    i=$((i + 1))
    sleep 1
  done
  if [ -z "$URL" ]; then
    echo "Onion URL not found" >&2
    kill $OS_PID || true
    kill $TOR_PID || true
    exit 1
  fi

  # Verify URL in config
  grep -q "$URL" "$host_dir/config.json"

  # Fetch page via Tor
  curl --socks5-hostname 127.0.0.1:9050 "$URL" | grep -q '<title>'

  # Clean up
  kill $OS_PID
  kill $TOR_PID
  wait $OS_PID 2>/dev/null || true
  wait $TOR_PID 2>/dev/null || true
else
  echo "Skipping network-dependent tests" >&2
  exit 0
fi

exit 0
