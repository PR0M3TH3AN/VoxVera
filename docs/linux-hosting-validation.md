# Linux Hosting Validation

This runbook defines the operational validation standard for VoxVera's only supported hosting target:

- Linux CLI with `systemd --user`

Everything else remains below that bar until equivalent evidence exists.

## Prerequisites

- `voxvera` installed and on `PATH`
- `tor` installed
- `onionshare-cli` available
- a user account that can run `systemctl --user`

## Quick Verification

Use the helper script first:

```bash
bash scripts/linux-recovery-check.sh
```

This checks:

- `platform-status --json`
- `doctor --json`
- `autostart status --json`
- expected Linux support tier and platform id
- presence of `~/host`
- Tor and OnionShare discovery
- autostart artifacts and timer state
- per-site state for `.onionshare-session`, `onionshare.log`, and `server.pid`

## Core Commands

Install autostart:

```bash
voxvera autostart
```

Inspect autostart:

```bash
voxvera autostart status
systemctl --user status voxvera-start.timer
systemctl --user status voxvera-start.service
```

Remove autostart:

```bash
voxvera autostart uninstall
```

Inspect runtime diagnostics:

```bash
voxvera doctor
voxvera doctor --json
```

## Validation Checklist

### 1. Fresh install

Run the Linux installer or install through the supported CLI path, then confirm:

```bash
voxvera platform-status --json
voxvera doctor --json
voxvera autostart status --json
```

Expected:

- `platform_id` is `linux_cli_systemd`
- support tier is `supported`
- `voxvera_cli`, `onionshare_cli`, and `tor_binary` pass

### 2. Build and serve

Create or edit a site, then build and serve it:

```bash
voxvera build
voxvera serve
```

Expected:

- site output appears under `~/host/<folder_name>/`
- `index.html` and QR code images exist
- `onionshare.log` is written
- `.onionshare-session` appears after the hidden service is started

### 3. Identity persistence

Confirm the site keeps its identity across rebuilds:

```bash
ls -la ~/host/<folder_name>/
voxvera build --config ~/host/<folder_name>/config.json
```

Expected:

- `.onionshare-session` still exists after rebuild

### 4. Autostart persistence

Confirm the recovery timer exists and is enabled:

```bash
voxvera autostart status
systemctl --user is-enabled voxvera-start.timer
systemctl --user is-active voxvera-start.timer
```

Expected:

- timer artifacts exist under `~/.config/systemd/user/`
- timer is enabled

### 5. Reboot recovery

After a reboot, verify:

```bash
bash scripts/linux-recovery-check.sh
systemctl --user status voxvera-start.timer
journalctl --user -u voxvera-start.service --no-pager -n 50
```

Expected:

- timer remains enabled
- service has retried `start-all`
- configured sites are restorable without manual reconfiguration

### 6. Offline/reconnect recovery

Temporarily disconnect the host from the network, reconnect, then wait through at least one timer interval.

Verify:

```bash
systemctl --user status voxvera-start.timer
journalctl --user -u voxvera-start.service --no-pager -n 50
bash scripts/linux-recovery-check.sh
```

Expected:

- timer is still active
- `start-all` retries appear in the service logs
- Tor becomes reachable again

## Paths That Matter

- `~/.config/systemd/user/voxvera-start.service`
- `~/.config/systemd/user/voxvera-start.timer`
- `~/host/<folder_name>/config.json`
- `~/host/<folder_name>/.onionshare-session`
- `~/host/<folder_name>/onionshare.log`
- `~/host/<folder_name>/server.pid`

## Failure Interpretation

If `bash scripts/linux-recovery-check.sh` fails:

- missing `onionshare_cli` or `tor_binary` means the runtime is incomplete
- missing `host_root` means no sites are built yet
- missing autostart artifacts means recovery was never installed or was removed
- `tor_socks_reachable` warning means Tor is not currently reachable even if it is installed

Linux should remain the only supported target until this runbook is repeatable on real hosts without caveats.
