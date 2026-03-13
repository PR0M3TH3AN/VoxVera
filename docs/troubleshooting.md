# Troubleshooting

This page collects common issues encountered when hosting or accessing flyers.

## Tor connectivity
- Ensure Tor is allowed through your firewall. On systems using `ufw` you may need to run `sudo ufw allow tor`.
- Some networks block Tor entirely. If you cannot reach onion services, try connecting over a different network or use a Tor bridge.

### Placeholder binaries

The files in `voxvera/resources/tor/*` are not real executables. Install `tor`
and `obfs4proxy` yourself (e.g. `apt install tor obfs4proxy`) then set
`TOR_SOCKS_PORT` and `TOR_CONTROL_PORT` before running `voxvera serve` or the
Electron GUI. OnionShare uses these values with its `--use-running-tor`
argument. Running `scripts/download_tor.sh` can also populate the missing files
automatically.

## Firewall rules
- If `voxvera serve` fails to start OnionShare, verify that outbound connections on ports 9001 and 80 are permitted.
- Corporate or university firewalls can block the hidden service ports required by Tor.

## SELinux
- On SELinux-enabled distributions you may see `permission denied` errors when OnionShare writes to the `host` directory.
- Run `sudo chcon -Rt svirt_sandbox_file_t host` or disable SELinux enforcement for the folder.

## OnionShare crashes
If the GUI shows "OnionShare exited unexpectedly" check the log file
`host/<subdomain>/onionshare.log` for details. This usually points to
network connectivity problems or a missing dependency. Running
`voxvera serve` from the command line can provide additional error
output.

If problems persist, consult the OnionShare and Tor documentation for more advanced configuration tips.

## Onion URL changed unexpectedly
The onion URL is tied to the Ed25519 keypair stored in
`host/<subdomain>/.onionshare-session`. If this file is deleted, a new
keypair (and URL) will be generated on the next `voxvera serve`. The
`voxvera import` command preserves this file automatically, but manual
deletion of the `host/` directory will destroy it.

## Electron GUI
If `npm start` fails with `spawn voxvera ENOENT`, the `voxvera` command is not in your `PATH`. Install it with `pipx install git+https://github.com/PR0M3TH3AN/VoxVera.git` or run `./install.sh` from the repository.

## Missing dependencies
Run `voxvera check` to verify your setup. The command checks for required
Python packages (`qrcode`, `Pillow`, `jsmin`, `htmlmin`, `pypdf`) and
external tools (`onionshare-cli`), then prints a summary of anything
missing. To install all Python dependencies:

```bash
pip install 'voxvera[all]'
# or reinstall from source
pipx install --force 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
```
