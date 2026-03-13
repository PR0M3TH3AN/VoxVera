# Detailed Usage

This guide covers common CLI workflows. See `docs/docker.md` for Docker instructions and `docs/templates.md` for available flyer templates.

## Prerequisites

VoxVera is designed to be highly portable and requires minimal system dependencies.

### 1. Standalone Binaries (Recommended)
You can download standalone, zero-dependency binaries for your operating system:
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

These binaries include everything needed to run VoxVera (except `onionshare-cli`).

### 2. One-Line Installer
Alternatively, install via our automated script:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Manual Python Install
If you prefer to run from source:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Step-by-Step

1. **Initialize:** Run `voxvera init` and follow the prompts. You will be asked to select your language first.
2. **Build:** Generate the flyer assets. Every build automatically creates a `voxvera-portable.zip` in the flyer's folder, allowing others to download the full tool directly from your flyer.
   ```bash
   voxvera build
   ```
3. **Serve:** Publish the flyer over Tor:
   ```bash
   voxvera serve
   ```
   This automatically detects your Tor instance, starts OnionShare, and writes the generated .onion address into the flyer's tear-off links.

## Language Support

VoxVera is fully localized. You can change your language preference permanently using either the interactive selector or a direct shortcut:

- **Interactive Selector:** `voxvera lang`
- **Direct Shortcut:** `voxvera --lang de` (sets preference to German)

### Supported Languages:
- **English:** `en`
- **Spanish:** `es` (alias: `--idioma`)
- **German:** `de` (alias: `--sprache`)

You can also force a specific language for a single command without changing your permanent preference:
- **English:** `voxvera --lang en check`
- **German:** `voxvera --sprache de check`
- **Spanish:** `voxvera --idioma es check`

The generated flyers automatically detect the visitor's browser language and switch the UI text accordingly.

## Server Management

Manage multiple flyers and their Tor identities from a single interactive menu:

```bash
voxvera manage
```

Features:
- **--- नई साइट/फ्लायर बनाएँ ---**: Start the full setup sequence.
- **--- सभी साइटें शुरू करें ---**: Launch or shut down every flyer in your fleet at once.
- **Real-time Status**: View active `.onion` URLs and Tor bootstrapping progress indicators.
- **Individual Control**: ज़िप में निर्यात करें specific sites to ZIP or delete them.

## Universal Mirroring (Viral Distribution)

To ensure VoxVera remains accessible even if central repositories are censored, every flyer acts as a mirror for the tool.

When you host a flyer, the **"टूल और कोड डाउनलोड करें"** button on the landing page provides a `voxvera-portable.zip` containing:
- The full source code and all supported languages.
- All Python dependencies (pre-vendored).
- Cross-platform Tor binaries.

This allows anyone who scans your flyer to become a new distributor of the VoxVera tool.

## Export & Backup

Back up your unique Tor identities (so your `.onion` URL never changes) or move your flyers to another machine.

- **Export a single site**: `voxvera export <folder_name>`
- **Export all sites**: `voxvera export-all`

**Storage location:** All exports are saved to `~/voxvera-exports/` on all platforms.

## Import & Recovery

Restore your entire setup on a new machine by moving your ZIP files to `~/voxvera-exports/` and running:

```bash
voxvera import-multiple
```

## Portability & Offline Use

If you need to run VoxVera on a machine without internet access, you can "vendorize" the dependencies first:

```bash
voxvera vendorize
```

This downloads all required Python libraries into `voxvera/vendor/`. The tool will then prioritize these local files, allowing it to run without `pip install`.

## Batch Import (JSON)

To bulk-generate flyers from multiple JSON configuration files, place them in the `imports/` directory and run:

```bash
voxvera batch-import
```

## How URLs Work

Each flyer has two separate URLs:
- **Tear-off link** (auto-generated): The .onion address where the flyer is hosted.
- **Content link** (user-configured): An external URL pointing to a website, video, or download.

You do not need to manually enter the .onion address; VoxVera handles this automatically during the `serve` phase.
