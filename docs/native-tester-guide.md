# Native Tester Guide

Use this guide when asking someone on macOS or Windows to validate VoxVera.

## Scope

VoxVera is not just an installer test. The real question is whether it can function as a reliable Tor hidden-service host on that platform.

That means every tester should be asked to validate:

1. install
2. build
3. serve
4. onion identity persistence
5. login/reboot recovery
6. offline/reconnect recovery
7. logs and diagnostics

## Canonical Checklists

- macOS: `docs/macos-validation-checklist.md`
- Windows: `docs/windows-validation-checklist.md`

## What To Ask Testers To Send Back

- platform and OS version
- install path used
- `voxvera platform-status --json`
- `voxvera doctor --json`
- `voxvera autostart status --json`
- whether `voxvera serve` produced an `.onion` URL
- whether `.onionshare-session` persisted after restart
- whether hosting resumed after reboot/login
- whether hosting resumed after network reconnect
- exact error output for any failure

## What Not To Conclude Prematurely

- successful installation does not prove hosting works
- successful hosting once does not prove recovery works
- binary availability does not prove platform parity

## Current Repo Position

- Linux CLI with `systemd --user`: supported
- Docker CLI: experimental
- macOS CLI: experimental
- Windows CLI: experimental

Do not promote macOS or Windows above `experimental` without native recovery evidence.
