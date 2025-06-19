# Detailed Usage

This guide covers common CLI workflows. See `docs/docker.md` for Docker instructions and `docs/templates.md` for available flyer templates.

## Step-by-Step
1. Edit `src/index-master.html` or `src/nostr-master.html` if you need custom content.
2. Run `voxvera init` and follow the prompts, or use `voxvera init --from-pdf path/to/form.pdf`.
3. Host the generated `host/<subdomain>` directory. The `index.html` file fetches `config.json`, so the flyer must be served via a local or remote web server rather than opened directly from disk. For a quick test you can run `python3 -m http.server` inside the folder and then visit the provided address.

## Batch Import
Place configuration files in an `imports/` directory at the project root and run:
```bash
voxvera import
```
Each JSON file is copied to `src/config.json` and processed with `voxvera build`. Existing folders under `host/` with the same subdomain are removed before new files are written.

## Hosting with OnionShare
Use the CLI to publish the flyer over Tor:
```bash
voxvera serve
```
The script launches `onionshare-cli` in persistent website mode, waits for the generated onion URL, patches `config.json`, regenerates the QR codes and obfuscated HTML, and then copies the updated files back into the `host` directory. Keep OnionShare running to continue hosting.

`index.html` fetches `config.json` dynamically, so the flyer should be viewed through a local or remote web server. For quick testing, run `python3 -m http.server` in the folder and open the provided address instead of loading the file directly.
