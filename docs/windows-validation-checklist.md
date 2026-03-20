# Windows Validation Checklist

This checklist is for validating the experimental Windows CLI path on a real Windows machine.

Do not promote Windows above `experimental` until this checklist has been completed successfully on at least one native host and the results have been reviewed.

## Goal

Validate whether the current Windows runtime can:

1. install cleanly
2. build and serve a flyer
3. preserve the OnionShare session identity
4. recover after login/reboot/offline periods
5. surface understandable logs and status

## Environment Notes

- This checklist assumes the CLI runtime, not the Electron GUI.
- Prefer a clean Windows machine or VM snapshot.
- Record the exact Windows version and install path used.

## 1. Install Surface

Record which install path was used:

- standalone `.exe`
- PowerShell installer
- Chocolatey

Capture in PowerShell:

```powershell
voxvera --version
voxvera platform-status --json
voxvera doctor --json
voxvera autostart status --json
```

Pass criteria:

- VoxVera launches
- `platform-status` reports `windows_cli`
- `doctor` runs without crashing
- `autostart status` runs without crashing

## 2. Build + Serve

Create a fresh working directory and config:

```powershell
$env:VOXVERA_DIR = "$HOME\\voxvera-test"
New-Item -ItemType Directory -Force $env:VOXVERA_DIR | Out-Null
voxvera init --non-interactive
voxvera build
voxvera serve
```

Capture:

- whether `index.html` is created under `%USERPROFILE%\\voxvera-test\\host\\voxvera\\`
- whether `.onionshare-session` appears
- whether an `.onion` URL is printed
- whether `onionshare.log` is created

Pass criteria:

- build completes
- serve completes
- `.onionshare-session` exists
- `onionshare.log` exists

## 3. Identity Persistence

Stop and restart the site:

```powershell
voxvera stop-all
voxvera start-all
```

Capture:

- whether the same `.onion` URL returns
- whether `.onionshare-session` remains unchanged

Pass criteria:

- the onion identity persists across restart

## 4. Autostart Install

Install the experimental Task Scheduler path:

```powershell
voxvera autostart
voxvera autostart status --json
```

Capture:

- scheduled task name
- any `schtasks` output or errors

Pass criteria:

- scheduled task is created
- `autostart status` reports installed artifacts

## 5. Login / Reboot Recovery

After autostart is installed:

1. reboot the machine or log out and back in
2. wait a few minutes
3. check:

```powershell
voxvera doctor --json
voxvera autostart status --json
voxvera start-all
```

Capture:

- whether hosting resumed automatically
- whether the onion identity persisted
- whether the process had to be restarted manually

## 6. Offline / Reconnect Recovery

While a site is running:

1. disconnect the machine from the network
2. wait at least 2 minutes
3. reconnect
4. wait a few minutes

Capture:

- whether hosting recovered automatically
- whether manual `voxvera start-all` was required
- any errors in `onionshare.log`

## 7. Logs And Status

Capture the practical debugging workflow:

```powershell
voxvera doctor --json
voxvera autostart status --json
Get-ChildItem "$HOME\\voxvera-test\\host\\voxvera" -Force
```

Document:

- where logs live
- what failed if recovery did not work
- any permissions/path issues

## Report Back

A useful tester report should include:

- Windows version
- install path used
- whether build worked
- whether serve worked
- whether the onion identity persisted
- whether login/reboot recovery worked
- whether offline/reconnect recovery worked
- exact command output or error text for failures
