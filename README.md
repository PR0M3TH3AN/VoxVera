# VoxVera Flyers

Generate printable flyers with QR codes linking to Tor (.onion) or HTTPS sites, plus optional Nostr sharing.

---

## Key Features

* **Interactive setup**: `voxvera init` prompts for metadata or extracts from a PDF form. When editing body text, a small Tkinter GUI window opens with existing content pre-filled, falling back to the user's `$EDITOR` if the GUI isn't available.
* **Template support**: `voxvera init --template <name>` copies built-in templates (`blank`, `voxvera`).
* **Build assets**: `voxvera build [--pdf <path>] [--download <file.zip>]` generates HTML, minified JS/CSS, QR codes, and bundles PDFs.
* **Batch import**: `voxvera import` processes all JSON configs in `imports/`.
* **Onion hosting**: `voxvera serve` publishes via Tor/OnionShare and updates flyer links. The onion URL is key-based and persists across content changes.
* **All-in-one**: `voxvera quickstart` runs init, build, and serve in sequence.
* **Dependency check**: `voxvera check` verifies presence of required tools and Python packages.
* **GUI**: Minimal Electron wrapper (`gui/electron`) for non-CLI users.

---

## Quick Start

### Install with pip/pipx (Linux, macOS, Windows)

VoxVera is a pure Python package. All build dependencies (QR codes, HTML minification, PDF parsing) are handled by Python libraries — no Node.js, ImageMagick, or other system tools needed.

```bash
# Recommended (isolated environment)
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'

# Or with pip
pip install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
```

The only external tool required for hosting is **OnionShare** (`onionshare-cli`). Install it separately if you plan to use `voxvera serve`:

| Platform | Install OnionShare |
|---|---|
| Debian/Ubuntu | `sudo apt install onionshare-cli` |
| Fedora | `sudo dnf install onionshare-cli` |
| macOS | `brew install onionshare` |
| Windows | [onionshare.org](https://onionshare.org/) |

### One-line installer (Linux/macOS)

For a batteries-included setup that also installs Tor and OnionShare:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.ps1 | iex
```

### Run VoxVera

```bash
# Interactive: configure, build, and serve in one step
voxvera quickstart

# Or use the helper script (starts Tor if needed, then launches quickstart)
./voxvera-run.sh
```

---

## Typical Workflow

```bash
# 1. Interactive metadata
voxvera init

# 2. Build flyers
voxvera build --pdf form.pdf --download file.zip   # optional flags

# 3. Host via Tor
voxvera serve
```

Or do all three steps in one shot:

```bash
voxvera quickstart
```

Run `voxvera --help` for the full CLI reference.

---

## Dependencies

### Python packages (installed automatically)

| Package | Replaces |
|---|---|
| `qrcode` + `Pillow` | `qrencode` + ImageMagick |
| `jsmin` + `htmlmin2` | `javascript-obfuscator` + `html-minifier-terser` + Node.js |
| `pypdf` | `pdftotext` / `poppler-utils` |
| `InquirerPy` + `rich` | Interactive prompts and console output |

### External tools (only for hosting)

| Tool | Required for |
|---|---|
| `onionshare-cli` | `voxvera serve` (Tor hosting) |
| `tor` | OnionShare runtime (installed by OnionShare or separately) |

Run `voxvera check` to verify your setup.

---

## GUI (optional)

If you prefer a point-and-click experience:

```bash
cd gui/electron
npm install
npm start
```

The GUI internally calls the same CLI commands, so make sure VoxVera is installed first.

---

## Documentation

See the `docs/` folder for additional guides:

* `docs/usage.md` — CLI workflows
* `docs/templates.md` — available flyer templates
* `docs/troubleshooting.md` — common fixes
* `docs/docker.md` — Docker usage

---

## License

MIT © 2025 thePR0M3TH3AN
