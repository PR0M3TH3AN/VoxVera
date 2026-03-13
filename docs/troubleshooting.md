# Troubleshooting

This page collects common issues encountered when hosting or accessing flyers.

## Tor connectivity
- Ensure Tor is allowed through your firewall. On systems using `ufw` you may need to run `sudo ufw allow tor`.
- Some networks block Tor entirely. If you cannot reach onion services, try connecting over a different network or use a Tor bridge.

## Tor port detection

`voxvera serve` auto-detects Tor by probing common ports (9050/9150 for SOCKS, 9051/9151 for control). If detection fails -- for example when Tor runs on non-standard ports -- you can override with environment variables:

```bash
TOR_SOCKS_PORT=19050 TOR_CONTROL_PORT=19051 voxvera serve
```

If no running Tor is found, the defaults (9050/9051) are used and OnionShare will attempt to connect on those ports.

## Firewall rules
- If `voxvera serve` fails to start OnionShare, verify that outbound connections on ports 9001 and 80 are permitted.
- Corporate or university firewalls can block the hidden service ports required by Tor.

## SELinux
- On SELinux-enabled distributions you may see `permission denied` errors when OnionShare writes to the `host` directory.
- Run `sudo chcon -Rt svirt_sandbox_file_t host` or disable SELinux enforcement for the folder.

## OnionShare crashes
If `voxvera serve` prints "OnionShare exited unexpectedly", check the log file
`host/<folder_name>/onionshare.log` for details. Common causes:

- Tor is not running (`sudo systemctl start tor`)
- A port conflict with another service
- Missing `onionshare-cli` (run `voxvera check`)

## Onion URL changed unexpectedly
The onion URL is tied to the Ed25519 keypair stored in
`host/<folder_name>/.onionshare-session`. If this file is deleted, a new
keypair (and URL) will be generated on the next `voxvera serve`. The
`voxvera import` command preserves this file automatically, but manual
deletion of the `host/` directory will destroy it.

## QR codes not generated
If `voxvera build` reports "No URLs configured yet", this is expected before the first `voxvera serve`. QR codes for tear-off links are generated automatically once the .onion address is known. QR codes for the content link are generated if you provided a URL during `voxvera init`.

## Electron GUI
If `npm start` fails with `spawn voxvera ENOENT`, the `voxvera` command is not in your `PATH`. Install it with `pipx install git+https://github.com/PR0M3TH3AN/VoxVera.git` or run `./install.sh` from the repository.

## Missing dependencies
Run `voxvera check` to verify your setup. The command checks for required
Python packages (`qrcode`, `Pillow`, `jsmin`, `htmlmin`, `pypdf`) and
external tools (`onionshare-cli`), then prints a summary of anything
missing. To install everything:

```bash
# Recommended: use the install script (handles Tor + OnionShare too)
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash

# Or reinstall just the Python package
pipx install --force 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
```
