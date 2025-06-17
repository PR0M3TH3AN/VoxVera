#!/bin/bash

set -e

CONFIG="config.json"

# Ensure dependencies
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }
command -v qrencode >/dev/null 2>&1 || { echo "qrencode is required" >&2; exit 1; }
command -v convert >/dev/null 2>&1 || { echo "ImageMagick convert is required" >&2; exit 1; }

url=$(jq -r '.url' "$CONFIG")
tear=$(jq -r '.tear_off_link' "$CONFIG")

[ -n "$url" ] || { echo "URL missing in $CONFIG" >&2; exit 1; }
[ -n "$tear" ] || { echo "tear_off_link missing in $CONFIG" >&2; exit 1; }

tmp_content=$(mktemp)
tmp_tear=$(mktemp)

qrencode -o "$tmp_content" -s 10 -m 0 "$url"
qrencode -o "$tmp_tear" -s 10 -m 0 "$tear"

convert "$tmp_content" -resize 128x128 "qrcode-content.png"
convert "$tmp_tear" -resize 128x128 "qrcode-tear-offs.png"

rm -f "$tmp_content" "$tmp_tear"

echo "QR codes generated"
