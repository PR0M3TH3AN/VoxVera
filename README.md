# VoxVera Flyers

Generate printable flyers with QR codes linking to Tor (.onion) hidden services, plus optional Nostr sharing. Flyers are hosted exclusively over Tor for anonymous, censorship-resistant distribution.

---

## Documentation

VoxVera is available in multiple languages. Select your preferred language for the detailed usage guide:

| Language | Documentation |
| :--- | :--- |
| 🇺🇸 **English** | [docs/en/usage.md](docs/en/usage.md) |
| 🇪🇸 **Español** | [docs/es/usage.md](docs/es/usage.md) |
| 🇩🇪 **Deutsch** | [docs/de/usage.md](docs/de/usage.md) |

---

## Key Features

* **Interactive setup**: `voxvera init` prompts for metadata or extracts from a PDF form. When editing body text, a small Tkinter GUI window opens with existing content pre-filled, falling back to the user's `$EDITOR` if the GUI isn't available.
* **Template support**: `voxvera init --template <name>` copies built-in templates (`blank`, `voxvera`).
* **Build assets**: `voxvera build [--download <file.zip>]` generates HTML, minified JS/CSS, QR codes, and optionally bundles a download zip.
* **Batch import**: `voxvera batch-import` processes all JSON configs in `imports/`.
* **Universal Mirroring**: Every flyer acts as a mirror for the tool. The "Download Tool & Source" button on every flyer provides a portable, zero-dependency version of VoxVera, creating a decentralized distribution network.
* **Standalone Binaries**: Pre-built, zero-install executables for Linux, Windows, and macOS.
* **Multi-Language Support**: Fully localized CLI and flyers (English, Spanish, German). Flyers automatically detect visitor language.
* **Integrated Server Manager**: `voxvera manage` provides an interactive UI to handle multiple flyers, monitor bootstrapping, and manage .onion URLs.
* **Tor-First Anonymity**: Automatic Tor hosting via OnionShare with persistent .onion addresses.
* **Flyer Migration**: Bulk export and import of flyers and Tor keys via a centralized `~/voxvera-exports/` folder.
* **All-in-one**: `voxvera quickstart` runs init, build, and serve in sequence.
* **Dependency check**: `voxvera check` verifies presence of required tools and Python packages.
* **GUI**: Minimal Electron wrapper (`gui/electron`) for non-CLI users.

---

## Quick Start

### One-line installer (Linux/macOS) -- recommended

Installs VoxVera, Tor, and OnionShare in one step:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### Install with pip/pipx (Linux, macOS, Windows)

VoxVera is a pure Python package. All build dependencies (QR codes, HTML minification, PDF parsing) are handled by Python libraries -- no Node.js, ImageMagick, or other system tools needed.

```bash
# Recommended (isolated environment)
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'

# Or with pip
pip install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
```

Tor and OnionShare are also required for hosting. The install scripts handle this automatically, but if you installed via pip/pipx you'll need them separately:

| Platform | Command |
|---|---|
| Debian/Ubuntu | `sudo apt install tor onionshare-cli` |
| Fedora | `sudo dnf install tor onionshare-cli` |
| macOS | `brew install tor onionshare` |
| Windows | [onionshare.org](https://onionshare.org/) |

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
# 1. Configure flyer text, external URL, and other metadata
voxvera init

# 2. Build flyer assets (HTML, QR codes, PDFs)
voxvera build --download file.zip   # optional flags

# 3. Host via Tor (auto-detects ports, generates .onion address)
voxvera serve
```

Or do all three steps in one shot:

```bash
voxvera quickstart
```

### Flyer Configuration Reference

`voxvera init` prompts you to fill in the following fields. Each one maps to a specific part of the printed flyer.

#### Metadata

| Field | Max | Where it appears |
|---|---|---|
| **name** | 60 chars | Browser tab title. Not printed on the flyer itself. |
| **folder_name** | 63 chars | Used internally as the folder name under `host/`. Lowercase letters, numbers, and hyphens only. |
| **title** | 60 chars | Large heading at the top-right of the flyer (e.g. "TOP SECRET"). |
| **subtitle** | 80 chars | Smaller text directly below the title (e.g. "DO NOT DISTRIBUTE"). Supports basic HTML like `<span class="redacted">`. |
| **headline** | 80 chars | Second heading below the subtitle (e.g. "OPERATION VOX VERA"). |

#### Body

| Field | Max | Where it appears |
|---|---|---|
| **content** | 1000 chars | The main body text in the right-hand column. Opens in a text editor during `voxvera init`. Newlines are preserved. |

#### Links

| Field | Max | Set by | Where it appears |
|---|---|---|---|
| **url** | 200 chars | You, during `voxvera init` | The content link shown at the bottom of the right-hand column with a QR code. Points to any external resource (website, download, video, etc.). |
| **tear_off_link** | -- | Automatically by `voxvera serve` | The .onion address printed on every tear-off tab (left side) with a QR code. People tear off a tab to revisit and reprint the flyer. |
| **url_message** | 120 chars | You, during `voxvera init` | Short message displayed above the content link (e.g. "Follow this link to learn more. Use Tor Browser."). |
| **binary_message** | 120 chars | You, during `voxvera init` | Decorative binary string shown at the very bottom of the flyer footer. |

#### Flyer Layout

```
+---------------------+-------------------------+
|                     |  [title]                |
|  TEAR-OFF TABS      |  [subtitle]             |
|  (10 tabs, each     |  [headline]             |
|   with tear_off_    |  ---------------------- |
|   link + QR code)   |  [content]              |
|                     |                         |
|                     |  [url_message]          |
|                     |  [url] + QR code        |
|                     |  ---------------------- |
|                     |  [footer + binary_msg]  |
+---------------------+-------------------------+
```

You never need to manually configure Tor ports or the .onion address. `voxvera serve` auto-detects a running Tor instance (defaulting to SOCKS port 9050 / control port 9051) and derives the onion address from persistent keys.

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

### External tools (installed by install scripts)

| Tool | Required for |
|---|---|
| `onionshare-cli` | `voxvera serve` (Tor hosting) |
| `tor` | OnionShare runtime |

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

* `docs/usage.md` -- CLI workflows
* `docs/templates.md` -- available flyer templates
* `docs/troubleshooting.md` -- common fixes
* `docs/docker.md` -- Docker usage

---

## License

MIT (c) 2025 thePR0M3TH3AN
