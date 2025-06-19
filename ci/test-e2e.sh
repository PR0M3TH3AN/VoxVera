#!/bin/sh
set -euo pipefail

LOG_DIR="$(pwd)/ci-logs"
mkdir -p "$LOG_DIR"
exec >"$LOG_DIR/run.log" 2>&1

# Run install script and time it
{ time ./install.sh; } 2>&1

# Generate demo flyer
voxvera init --template voxvera <<EOI
DemoUser
demosite
EOI
voxvera build
ls -R dist >>"$LOG_DIR/tree.txt"

# Start Tor
 tor >"$LOG_DIR/tor.log" 2>&1 &
TOR_PID=$!
sleep 10

# Start OnionShare
onionshare-cli --website --public --persistent dist/demosite/.onionshare-session dist/demosite >"$LOG_DIR/onionshare.log" 2>&1 &
OS_PID=$!

# Wait for URL
URL=""
i=0
while [ $i -lt 30 ]; do
    if grep -Eo 'https?://[a-zA-Z0-9]{16,56}\.onion' "$LOG_DIR/onionshare.log" | head -n1 >"$LOG_DIR/url.txt"; then
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
grep -q "$URL" dist/demosite/config.json

# Fetch page via Tor
curl --socks5-hostname 127.0.0.1:9050 "$URL" | grep -q '<title>'

# Clean up
kill $OS_PID
kill $TOR_PID
wait $OS_PID 2>/dev/null || true
wait $TOR_PID 2>/dev/null || true

exit 0
