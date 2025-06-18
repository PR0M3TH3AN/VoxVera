#!/bin/bash

set -euo pipefail

IMPORT_DIR="imports"
shopt -s nullglob
files=("$IMPORT_DIR"/*.json)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "No JSON files found in $IMPORT_DIR"
  exit 0
fi

for json in "${files[@]}"; do
  echo "Processing $json"
  cp "$json" src/config.json
  subdomain=$(jq -r '.subdomain' "$json")
  dest="host/$subdomain"
  rm -rf "$dest"
  ./src/create_flyer.sh --no-interaction
done
