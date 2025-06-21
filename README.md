# VoxVera Flyers

Generate printable flyers with QR codes linking to Tor (.onion) or HTTPS sites, plus optional Nostr sharing.

---

## 🚀 Key Features

// 🔧 merged conflicting changes from codex/populate-gui-text-fields-for-editing vs main
* **Interactive setup**: `voxvera init` prompts for metadata or extracts from a PDF form. When editing body text, a small Tkinter GUI window opens with existing content pre-filled, falling back to the user's `$EDITOR` if the GUI isn't available.
* **Template support**: `voxvera init --template <name>` copies built-in templates (`blank`, `voxvera`).
* **Build assets**: `voxvera build [--pdf <path>] [--download <file.zip>]` generates HTML, obfuscated JS/CSS, QR codes, and bundles PDFs.
* **Batch import**: `voxvera import` processes all JSON configs in `imports/`.
* **Onion hosting**: `voxvera serve` publishes via Tor/OnionShare and updates flyer links.
* **All-in-one**: `voxvera quickstart` runs init, build, and serve in sequence.
* **Dependency check**: `voxvera check` verifies presence of required tools.
* **GUI**: Minimal Electron wrapper (`gui/electron`) for non-CLI users.

---

## 📥 Fool-Proof Installation

### 1. Prebuilt Binary (Linux)

```bash
# Download and install to $HOME/.local/bin
mkdir -p ~/.local/bin \
  && wget -qO ~/.local/bin/voxvera \
      https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera \
  && chmod +x ~/.local/bin/voxvera

# Ensure ~/.local/bin is in your PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  echo 'Add ~/.local/bin to your PATH and restart your shell.'
fi
````

### 2. Homebrew (macOS)

```bash
brew tap PR0M3TH3AN/voxvera
brew install voxvera
```

### 3. pipx (cross-platform)

```bash
pipx install voxvera
```

### 4. From Source

```bash
# Clone repo
git clone https://github.com/PR0M3TH3AN/VoxVera.git
cd VoxVera

# Create & activate virtualenv
python3 -m venv .venv
source .venv/bin/activate

# Install editable package
pip install --upgrade pip
pip install -e .
```

> After install, verify with `voxvera --help`.

---

## 🛠️ System Dependencies

These tools must be available in your PATH:

```
ton, onionshare-cli, jq, qrencode, convert (ImageMagick), pdftotext,
node, javascript-obfuscator, html-minifier-terser
```

Run `voxvera check` to see missing dependencies.

---

## 🎮 GUI (Electron)

```bash
cd gui/electron
npm install
voxvera check  # verify dependencies before launching
npm start
```

Click **Quickstart** to generate flyers without the terminal. If any tools are
missing or the network fails, see `docs/troubleshooting.md` for fixes.

---

## 🏗️ Basic Usage

```bash
# 1. Interactive setup:
voxvera init

# 2. Build flyers:
voxvera build [--pdf path/to/form.pdf] [--download path/to/file.zip]

# 3. Serve via OnionShare:
voxvera serve
```

Or run all steps:

```bash
voxvera quickstart
```

### Other Commands

* `voxvera init --template <name>` — copy a template into `dist/`.
* `voxvera import` — batch-import JSON configs from `imports/`.
* `voxvera check` — dependency health check.

---

## 🐳 Docker (optional)

```bash
# Pull and run
docker pull ghcr.io/PR0M3TH3AN/voxvera:latest
mkdir flyers
docker run --rm -it -v "$(pwd)/flyers:/flyers" ghcr.io/PR0M3TH3AN/voxvera
```

Flyers appear in `./flyers`.

---

## 📄 Documentation

See the `docs/` folder for detailed guides:

* `docs/usage.md` — CLI workflows
* `docs/docker.md` — Docker tips
* `docs/templates.md` — available flyer templates
* `docs/troubleshooting.md` — common fixes

---

## 📜 License

MIT © 2025 thePR0M3TH3AN
