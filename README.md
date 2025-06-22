# VoxVera Flyers

Generate printable flyers with QR codes linking to Tor (.onion) or HTTPS sites, plus optional Nostr sharing.

---

## 🚀 Key Features

* **Interactive setup**: `voxvera init` prompts for metadata or extracts from a PDF form. When editing body text, a small Tkinter GUI window opens with existing content pre‑filled, falling back to the user's `$EDITOR` if the GUI isn't available.
* **Template support**: `voxvera init --template <name>` copies built‑in templates (`blank`, `voxvera`).
* **Build assets**: `voxvera build [--pdf <path>] [--download <file.zip>]` generates HTML, obfuscated JS/CSS, QR codes, and bundles PDFs.
* **Batch import**: `voxvera import` processes all JSON configs in `imports/`.
* **Onion hosting**: `voxvera serve` publishes via Tor/OnionShare and updates flyer links.
* **All‑in‑one**: `voxvera quickstart` runs init, build, and serve in sequence.
* **Dependency check**: `voxvera check` verifies presence of required tools.
* **GUI**: Minimal Electron wrapper (`gui/electron`) for non‑CLI users.

---

## 📥 Quick Start (Debian & Ubuntu)

### 1️⃣ Install VoxVera and all dependencies

```bash
# Download the installer
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/voxvera-install.sh -o voxvera-install.sh
chmod +x voxvera-install.sh

# Run the installer (requires sudo for apt packages)
./voxvera-install.sh
```

The script will:

1. Update **apt** and install Tor, OnionShare, ImageMagick, Poppler, Node.js, and other CLI helpers.
2. Fetch the latest VoxVera release and place it in `~/.local/bin` (creating the directory if needed).
3. Create a minimal per‑user `torrc` under `~/.voxvera/` and (re)start the `tor` service.

After the script finishes, open a new terminal or reload your shell to ensure `~/.local/bin` is on your **PATH**.

If you prefer a user-level install, run:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
```

### 2️⃣ Run VoxVera (every session)

```bash
# First‑time only: make the wrapper executable
chmod +x voxvera-run.sh

# Start VoxVera
./voxvera-run.sh
```

`voxvera-run.sh` checks that Tor is healthy, starts it if necessary, and then launches `voxvera quickstart`. Use it every time you work with VoxVera.

---

## 🏗️ Typical Workflow

```bash
# 1. Interactive metadata
voxvera init

# 2. Build flyersoxvera build --pdf form.pdf --download file.zip   # optional flags

# 3. Host via Tor
voxvera serve
```

Or do all three steps in one shot:

```bash
voxvera quickstart
```

Run `voxvera --help` for the full CLI reference.

---

## 🎮 GUI (optional)

If you prefer a point‑and‑click experience:

```bash
cd gui/electron
npm install
npm start
```

The GUI internally calls the same CLI commands, so make sure the installer has run first.

---

## 📄 Documentation

See the `docs/` folder for additional guides:

* `docs/usage.md` — CLI workflows
* `docs/templates.md` — available flyer templates
* `docs/troubleshooting.md` — common fixes

---

## 📜 License

MIT © 2025 thePR0M3TH3AN
