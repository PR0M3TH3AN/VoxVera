#!/bin/bash

set -euo pipefail

CONFIG_PATH="${1:-config.json}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: required command '$1' not found" >&2
    exit 1
  }
}

for cmd in javascript-obfuscator html-minifier-terser node; do
  require_cmd "$cmd"
done

# Input and output file names
input_file="index-master.html"
output_file="index.html"
temp_js_file=$(mktemp --suffix=.js)  # Temporary .js file for extracting JavaScript
temp_js_obfuscated_file=$(mktemp --suffix=.js)  # Temporary file for obfuscated JavaScript
temp_html_file=$(mktemp)  # Temporary file for processing HTML without JS

# Check if the input file exists
if [ ! -f "$input_file" ]; then
    echo "Input file $input_file does not exist."
    exit 1
fi

# Extract embedded JavaScript into a temporary .js file
awk '/<script>/,/<\/script>/' "$input_file" | sed '1d;$d' > "$temp_js_file"

# Obfuscate the extracted JavaScript
javascript-obfuscator "$temp_js_file" --output "$temp_js_obfuscated_file"

# Read the obfuscated JavaScript into a variable
obfuscated_js=$(cat "$temp_js_obfuscated_file")

# Escape slashes in the obfuscated JavaScript
escaped_js=$(echo "$obfuscated_js" | sed 's/[\/&]/\\&/g')

# Replace the original JavaScript in the HTML with the obfuscated version
sed -e "/<script>/,/<\/script>/c\<script>$escaped_js<\/script>" "$input_file" > "$temp_html_file"

# Minify HTML, including the obfuscated embedded JavaScript and CSS
html-minifier-terser \
    --collapse-whitespace \
    --minify-css true \
    --remove-comments \
    --remove-empty-attributes \
    --output "$output_file" \
    "$temp_html_file"

# Clean up temporary files
rm "$temp_js_file" "$temp_js_obfuscated_file" "$temp_html_file"

echo "Obfuscation and minification complete. Output saved as $output_file."
