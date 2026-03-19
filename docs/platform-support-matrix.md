# Platform Support Matrix

This file is the canonical human-readable summary of VoxVera's actual platform support posture.

The machine-readable companion file is [`support-matrix.json`](/home/user/Documents/GitHub/VoxVera/support-matrix.json).

## Support Tiers

- **Supported**: validated for persistent hidden-service hosting with documented recovery behavior.
- **Beta**: feature-complete enough for broader testing, but not yet validated for production-grade recovery claims.
- **Experimental**: may install or run, but is not yet validated for reliable background hidden-service hosting.
- **Unsupported**: not currently a target for reliable hosting.

## Current Matrix

| Platform | Tier | Canonical Runtime Model | Distribution Surfaces | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Linux CLI with `systemd --user` | Supported | System Tor or Tor Browser plus `onionshare-cli`, with recurring `systemd --user` timer recovery | `install.sh`, `voxvera-install.sh`, `pip/pipx`, Linux binary | Current reference implementation |
| Docker CLI | Experimental | Containerized runtime with `VOXVERA_DIR=/flyers` and periodic `start-all` retries | Dockerfile, GHCR image | Needs end-to-end restart validation |
| macOS CLI | Experimental | CLI runtime with `launchd` autostart path and external Tor/OnionShare dependencies | `install.sh`, `pip/pipx`, macOS binary, DMG | No validated recovery claim yet |
| Windows CLI | Experimental | CLI runtime with Task Scheduler path and external Tor/OnionShare dependencies | `install.ps1`, Windows binary, Chocolatey | Binary naming and runtime model need cleanup |
| Electron GUI | Experimental | GUI frontend over the CLI runtime | `gui/electron` | Must converge on shared runtime behavior |
| Flatpak/AppImage/Homebrew/Chocolatey/Deb | Experimental | Distribution-only until runtime parity exists | packaging scripts/manifests | Package availability does not imply hosting parity |

## What "Supported" Means For VoxVera

To move a platform to **Supported**, VoxVera should have evidence for all of the following:

1. Fresh install works on a clean machine.
2. Manual `build` and `serve` work.
3. `.onionshare-session` survives rebuilds and restarts.
4. Hosting returns after reboot or login.
5. Hosting returns after a temporary offline period.
6. Logs and status are inspectable with documented commands.
7. The docs and release artifacts do not overstate capability.

## Promotion Rules

- Do not promote a package surface before the underlying runtime model is validated.
- Do not call a platform "recommended" unless it is also `supported`.
- If a platform lacks validated auto-recovery after reboot or network interruption, it must remain `experimental` or `beta`.

## Current Recommendation

If your goal is reliable Tor hidden-service hosting today, use the Linux CLI path and install the recurring recovery timer with:

```bash
voxvera autostart
```

That is the current reference deployment model the rest of the platform work should converge toward.
