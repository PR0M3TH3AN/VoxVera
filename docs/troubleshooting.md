# Troubleshooting

This page collects common issues encountered when hosting or accessing flyers.

## Tor connectivity
- Ensure Tor is allowed through your firewall. On systems using `ufw` you may need to run `sudo ufw allow tor`.
- Some networks block Tor entirely. If you cannot reach onion services, try connecting over a different network or use a Tor bridge.

## Firewall rules
- If `voxvera serve` fails to start OnionShare, verify that outbound connections on ports 9001 and 80 are permitted.
- Corporate or university firewalls can block the hidden service ports required by Tor.

## SELinux
- On SELinux-enabled distributions you may see `permission denied` errors when OnionShare writes to the `host` directory.
- Run `sudo chcon -Rt svirt_sandbox_file_t host` or disable SELinux enforcement for the folder.

If problems persist, consult the OnionShare and Tor documentation for more advanced configuration tips.
