#!/bin/bash
set -euo pipefail

CONFIG="src/config.json"
if [[ $# -gt 0 ]]; then
  CONFIG="$1"
fi

# get subdomain from config
subdomain=$(jq -r '.subdomain' "$CONFIG")
DIR="host/${subdomain}"
if [[ ! -d "$DIR" ]]; then
  echo "Directory $DIR not found" >&2
  exit 1
fi

logfile="$DIR/onionshare.log"

# start OnionShare in background
onionshare-cli --website --public --persistent "$DIR/.onionshare-session" "$DIR" >"$logfile" 2>&1 &
os_pid=$!

# wait for onion address to appear
while ! grep -m1 -Eo 'https?://[a-z0-9]+\.onion' "$logfile" >/dev/null; do
  sleep 1
  if ! kill -0 $os_pid 2>/dev/null; then
    echo "OnionShare exited unexpectedly" >&2
    cat "$logfile" >&2
    exit 1
  fi
done

onion_url=$(grep -m1 -Eo 'https?://[a-z0-9]+\.onion' "$logfile")

# update config with onion url
jq --arg url "$onion_url" '.url=$url | .tear_off_link=$url' "$DIR/config.json" >"$DIR/config.tmp" && mv "$DIR/config.tmp" "$DIR/config.json"

# regenerate assets
(cd src && ./generate_qr.sh "$DIR/config.json")
(cd src && ./obfuscate_index.sh "$DIR/config.json" && ./obfuscate_nostr.sh "$DIR/config.json")
cp src/index.html src/nostr.html src/qrcode-content.png src/qrcode-tear-offs.png "$DIR/"

echo "Onion URL: $onion_url"

echo "OnionShare running (PID $os_pid). See $logfile for details."
