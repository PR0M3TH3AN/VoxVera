# HTML/CSS/JS Obfuscation Script

This repository contains two Bash scripts that obfuscate and minify the flyer's HTML files. `obfuscate_index.sh` processes `index-master.html` into `index.html`, and `obfuscate_nostr.sh` does the same for `nostr-master.html` to produce `nostr.html`.

## Prerequisites

- **Debian/Ubuntu**: This script is designed to work on Debian-based systems.
- **Node.js**: Terser and html-minifier-terser require Node.js to be installed.
- **qrencode**: Generates the QR codes used in the flyers.

### Install Node.js and npm on Debian

1. **Update your package list:**
   ```bash
   sudo apt update
   ```

2. **Install Node.js and npm:**
   ```bash
   sudo apt install nodejs npm -y
   ```

3. **Verify the installation:**
   ```bash
   node -v
   npm -v
   ```

### Install Additional Packages

The helper scripts rely on a few system utilities:

```bash
sudo apt install -y jq qrencode imagemagick poppler-utils
```

### Install Required Tools

Install the Node-based tools used by the obfuscation scripts:

```bash
npm install -g javascript-obfuscator html-minifier-terser
```

You can also run `../setup.sh` from the repository root to install all
prerequisites automatically.

## Script Usage

### Running the Scripts

1. **Ensure both `obfuscate_index.sh` and `obfuscate_nostr.sh` are available.**
2. **Make the script executable:**
   ```bash
   chmod +x obfuscate_index.sh obfuscate_nostr.sh
   ```
3. **Run the desired script:**
   ```bash
   ./obfuscate_index.sh or ./obfuscate_nostr.sh
   ```

### Script Details

- **Input Files:** `obfuscate_index.sh` expects `index-master.html` and `obfuscate_nostr.sh` uses `nostr-master.html`.
- **Output Files:** `obfuscate_index.sh` writes `index.html` and `obfuscate_nostr.sh` writes `nostr.html`.
- **Error Handling:** Each script verifies that its input file exists before proceeding. Missing files result in an error.
- **Terser and HTML-Minifier-Terser:** The script first uses Terser to obfuscate any embedded JavaScript, then minifies the entire HTML file, including embedded CSS and JavaScript.

### Script Example

```bash
#!/bin/bash

# Input and output file names
input_file="index-master.html"
output_file="index.html"

# Check if the input file exists
if [ ! -f "$input_file" ]; then
    echo "Input file $input_file does not exist."
    exit 1
fi

# Obfuscate embedded JavaScript using terser
terser_output=$(mktemp)
terser --compress --mangle -- "$input_file" > "$terser_output"

# Minify HTML, including the embedded CSS and the obfuscated JavaScript
html-minifier-terser \
    --collapse-whitespace \
    --minify-css true \
    --minify-js true \
    --remove-comments \
    --remove-empty-attributes \
    --output "$output_file" \
    "$terser_output"

# Clean up temporary file
rm "$terser_output"

echo "Obfuscation and minification complete. Output saved as $output_file."
```
A similar script `obfuscate_nostr.sh` follows the same pattern but operates on `nostr-master.html` and outputs `nostr.html`.

## Editing the Script in Visual Studio Code (VSCode)

If you prefer to use Visual Studio Code to edit and run these scripts:

1. **Install VSCode:**
   - Follow the official [Visual Studio Code installation guide](https://code.visualstudio.com/docs/setup/linux) for Debian-based systems.

2. **Open your project in VSCode:**
   ```bash
   code /path/to/your/project
   ```

3. **Edit** `obfuscate_index.sh` or `obfuscate_nostr.sh` in the file explorer.

4. **Run the desired script** within the VSCode terminal:
   - Open the terminal in VSCode: `View > Terminal`.
   - Run the script:
     ```bash
     ./obfuscate_index.sh or ./obfuscate_nostr.sh
     ```
## Creating and Hosting a Flyer

The `create_flyer.sh` script automates filling `config.json`, building the HTML files, and copying everything into a new directory under `host/`.

### Usage

```bash
# interactive mode
./create_flyer.sh

# use an alternate config file
./create_flyer.sh -c path/to/custom.json

# use an existing filled PDF form
./create_flyer.sh --from-pdf path/to/form.pdf
```

By default the script updates `src/config.json`. Use the `-c` option to specify a different file. After answering the prompts (or extracting from the PDF), `index.html` and `nostr.html` are generated and copied along with the QR code images and PDFs. The files end up in `host/<subdomain>` which can be served statically.

QR codes are built automatically during this process. After the configuration is updated, `create_flyer.sh` calls `generate_qr.sh` to read the URLs from `config.json` and produce `qrcode-content.png` and `qrcode-tear-offs.png`.
