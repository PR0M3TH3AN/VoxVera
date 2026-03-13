# Detailed Usage

This guide covers common CLI workflows. See `docs/docker.md` for Docker instructions and `docs/templates.md` for available flyer templates.

## Prerequisites

Install VoxVera with the one-line installer (recommended):

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

This installs VoxVera, Tor, and OnionShare automatically. If you prefer a manual install:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

All build dependencies (QR generation, HTML minification, PDF parsing) are Python packages installed automatically.

## Step-by-Step

1. Run `voxvera init` and follow the prompts. During init you will configure:
   - Flyer metadata (name, title, subtitle, headline)
   - Body text (opens in a text editor)
   - **Content link** -- an external URL of your choice (website, download, etc.)
   - URL message and binary message
2. Build the flyer assets. Add an optional zip file with `--download`:
   ```bash
   voxvera build --download path/to/file.zip
   ```
3. Serve the flyer over Tor:
   ```bash
   voxvera serve
   ```
   This automatically detects your Tor instance, starts OnionShare, and writes the generated .onion address into the flyer's tear-off links. QR codes are regenerated with the new address.

The generated `host/<folder_name>` directory contains all flyer files. The `index.html` file fetches `config.json` at runtime, so the flyer must be served via a web server (OnionShare handles this). Visitors can use the **Download** button to retrieve any bundled files.

## Server Management

VoxVera includes a built-in interactive manager to handle multiple sites and their Tor identities simultaneously.

```bash
voxvera manage
```

From this menu, you can:
- **Create New Site/Flyer**: Launch the full init, build, and serve sequence.
- **Start/Stop All Sites**: Launch or shut down every flyer in your `host/` directory at once.
- **Individual Management**: Toggle specific sites, export them to ZIP, or delete them.
- **Status Display**: View the active `.onion` URL for every running site directly in the menu.

## Export & Backup

To move your flyers to another machine or back up your unique Tor identities (so your `.onion` URL never changes), use the export tools.

- **Export a single site**:
  ```bash
  voxvera export <folder_name>
  ```
- **Export all sites**:
  ```bash
  voxvera export-all
  ```

**Storage location:** All exports are saved as ZIP files in a folder called `voxvera-exports` in your user's home directory (`~/voxvera-exports/`) on Windows, macOS, and Linux.

## Import & Recovery

You can restore flyers (including their Tor keys) from ZIP archives created by the export command.

- **Import a single site**:
  ```bash
  voxvera import path/to/export.zip
  ```
- **Import multiple sites**:
  ```bash
  voxvera import-multiple
  ```
  This command automatically scans your `~/voxvera-exports/` folder and restores every ZIP file it finds. This is the fastest way to migrate your entire VoxVera setup to a new machine.

## How URLs Work

Each flyer has two separate URLs:

- **Tear-off link** (auto-generated): The .onion address where the flyer is hosted. Written into every tear-off tab with a QR code. People who tear off a tab can visit the site to view/reprint the flyer.
- **Content link** (user-configured): Any external URL you choose during `voxvera init`. Displayed in the main body of the flyer with its own QR code. Can point to a website, video, download, or anything else.

You do not need to manually enter the .onion address -- `voxvera serve` handles this automatically.

## Batch Import (JSON)

If you have multiple configuration JSON files and want to generate flyers for all of them at once, place them in an `imports/` directory at the project root and run:

```bash
voxvera batch-import
```

Each JSON file is processed, and its corresponding site folder is created in `host/`. Existing OnionShare session keys (`.onionshare-session`) are preserved if they already exist for that folder name.

## Hosting with OnionShare

Use the CLI to publish the flyer over Tor:

```bash
voxvera serve
```

Tor ports are auto-detected from your running Tor instance (defaults: SOCKS 9050, control 9051). 

The command launches `onionshare-cli` in persistent website mode, waits for the generated onion URL, writes it into `config.json` as the tear-off link, regenerates QR codes, and copies updated files into the `host` directory.

The onion URL is derived from an Ed25519 keypair stored in `host/<folder_name>/.onionshare-session`. As long as this file exists, the URL stays the same even if you rebuild with new content. Keep OnionShare running to continue hosting.

## All-in-One

```bash
voxvera quickstart                # interactive
voxvera quickstart --non-interactive  # use existing config.json
```

## Checking Dependencies

```bash
voxvera check
```

This verifies that required Python packages and external tools (`onionshare-cli`) are available and prints a summary.
