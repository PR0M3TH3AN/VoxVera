#!/bin/bash

set -e

CONFIG_PATH="src/config.json"
FROM_PDF=""

usage() {
  echo "Usage: $0 [-c config_path] [--from-pdf PDF]"
  echo "Create and deploy a flyer based on config.json."
  exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -c|--config)
      CONFIG_PATH="$2"
      shift 2
      ;;
    --from-pdf)
      FROM_PDF="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

# Ensure jq is installed
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

# Helper function to update config
update_config_interactive() {
  read -rp "Name: " name
  read -rp "Subdomain: " subdomain
  read -rp "Title: " title
  read -rp "Subtitle: " subtitle
  read -rp "Headline: " headline
  echo "Enter content (end with EOF on its own line):"
  content=""
  while IFS= read -r line; do
    [[ "$line" == "EOF" ]] && break
    content+="$line\n"
  done
  read -rp "URL message: " url_message

  onion_base="6dshf2gnj7yzxlfcaczlyi57up4mvbtd5orinuj5bjsfycnhz2w456yd.onion"
  constructed_url="http://${subdomain}.${onion_base}"
  tear_off_link="$constructed_url"

  jq --arg name "$name" \
     --arg subdomain "$subdomain" \
     --arg title "$title" \
     --arg subtitle "$subtitle" \
     --arg headline "$headline" \
     --arg content "$content" \
     --arg url_message "$url_message" \
     --arg url "$constructed_url" \
     --arg tear_off_link "$tear_off_link" \
     '.name=$name | .subdomain=$subdomain | .title=$title | .subtitle=$subtitle | .headline=$headline | .content=$content | .url_message=$url_message | .url=$url | .tear_off_link=$tear_off_link' "$CONFIG_PATH" > "$CONFIG_PATH.tmp"
  mv "$CONFIG_PATH.tmp" "$CONFIG_PATH"
}

update_config_from_pdf() {
  tmpdir=$(mktemp -d)
  mkdir -p "$tmpdir/from_client"
  cp "$FROM_PDF" "$tmpdir/from_client/submission_form.pdf"
  cp host/blank/extract_form_fields.sh "$tmpdir/"
  cp "$CONFIG_PATH" "$tmpdir/config.json"
  (cd "$tmpdir" && bash extract_form_fields.sh >/dev/null)
  cp "$tmpdir/config.json" "$CONFIG_PATH"
  rm -rf "$tmpdir"
}

if [[ -n "$FROM_PDF" ]]; then
  update_config_from_pdf
else
  update_config_interactive
fi

# Run obfuscation scripts
( cd src && ./obfuscate_index.sh && ./obfuscate_nostr.sh )

subdomain=$(jq -r '.subdomain' "$CONFIG_PATH")
DEST="host/${subdomain}"
mkdir -p "$DEST/from_client"

cp "$CONFIG_PATH" "$DEST/config.json"
cp src/index.html src/nostr.html src/qrcode-content.png src/qrcode-tear-offs.png src/example.pdf src/submission_form.pdf "$DEST/"

if [[ -n "$FROM_PDF" ]]; then
  cp "$FROM_PDF" "$DEST/from_client/submission_form.pdf"
fi

echo "Flyer files created under $DEST"
