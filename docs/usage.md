# Detailed Usage

This guide covers common CLI workflows. See `docs/docker.md` for Docker instructions and `docs/templates.md` for available flyer templates.

## Prerequisites

Install VoxVera with pip or pipx:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
```

All build dependencies (QR generation, HTML minification, PDF parsing) are Python packages installed automatically. The only external tool needed is `onionshare-cli` for Tor hosting.

## Step-by-Step

1. Edit `src/index-master.html` or `src/nostr-master.html` if you need custom content.
2. Run `voxvera init` and follow the prompts, or use `voxvera init --from-pdf path/to/form.pdf` to extract fields from a filled PDF form.
3. Build the flyer assets. Add an optional zip file with `--download`:
   ```bash
   voxvera build --download path/to/file.zip
   ```
4. Host the generated `host/<subdomain>` directory. The `index.html` file fetches `config.json`, so the flyer must be served via a local or remote web server rather than opened directly from disk. For a quick test you can run `python3 -m http.server` inside the folder and then visit the provided address. Visitors can use the **Download** button to retrieve the file.

## Batch Import

Place configuration files in an `imports/` directory at the project root and run:

```bash
voxvera import
```

Each JSON file is copied to `src/config.json` and processed with `voxvera build`. Existing folders under `host/` with the same subdomain are cleaned before new files are written. OnionShare session keys (`.onionshare-session`) are preserved so the onion URL stays the same across re-imports.

## Hosting with OnionShare

Use the CLI to publish the flyer over Tor:

```bash
export TOR_SOCKS_PORT=9050
export TOR_CONTROL_PORT=9051
voxvera serve
```

The command launches `onionshare-cli` in persistent website mode, waits for the generated onion URL, patches `config.json`, regenerates the QR codes and minified HTML, and copies the updated files back into the `host` directory.

The onion URL is derived from an Ed25519 keypair stored in `host/<subdomain>/.onionshare-session`. As long as this file exists, the URL stays the same even if you rebuild with new content. Keep OnionShare running to continue hosting.

## All-in-One

```bash
voxvera quickstart                # interactive
voxvera quickstart --non-interactive  # use existing config.json
```

Or use the helper script which ensures Tor is running first:

```bash
./voxvera-run.sh
```

## Checking Dependencies

```bash
voxvera check
```

This verifies that required Python packages and external tools (`onionshare-cli`) are available and prints a summary.
