# Detailed Usage

This guide covers common CLI workflows. See `docs/docker.md` for Docker instructions and `docs/templates.md` for available flyer templates.

## Prerequisites

VoxVera is designed to be highly portable. You can run it directly from the source code on any platform with Python installed.

Linux with `systemd --user` is the supported persistent-host environment. Windows, macOS, Docker, Flatpak, AppImage, Homebrew, and Chocolatey are currently experimental and should not yet be treated as equally reliable hidden-service deployment targets.

### 1. Automated Install (Recommended)
The easiest way to install VoxVera is using the Linux-first installer script:

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```
On Linux, this also installs the recurring recovery timer used to retry hidden-service startup after boot and after missed/offline periods.

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.ps1 | iex
```
The Windows installer is experimental and does not yet guarantee production-ready background hosting behavior.

### 2. Manual Source Install
If you have downloaded the source code ZIP:

1. **Extract** the ZIP file.
2. **Open a terminal** in the extracted folder.
3. **Run the setup script**:
   - **Linux/macOS:** `./setup.sh`
   - **Windows:** `.\voxvera-install.sh` (or run `python -m pip install .`)

## Uninstallation

If you wish to remove VoxVera from your system, you can use the provided uninstall scripts from the source directory. This will safely remove the CLI tool and any downloaded dependencies.

- **Linux / macOS:** Run `./uninstall.sh`
- **Windows (PowerShell):** Run `.\uninstall.ps1`

*Note: Uninstallation will not delete your generated flyers or your `.onion` keys stored in the `~/voxvera-exports` or local `host/` folders.*

## Step-by-Step

1. **Initialize:** Run `voxvera init` and follow the prompts. You will be asked to select your language first.
2. **Build:** Generate the flyer assets. Every build automatically creates a `voxvera-portable.zip` in the flyer's folder, allowing others to download the full tool directly from your flyer.
   ```bash
   voxvera build
   ```
3. **Serve:** Publish the flyer over Tor:
   ```bash
   voxvera serve
   ```
   This automatically detects your Tor instance, starts OnionShare, and writes the generated .onion address into the flyer's tear-off links.

### Persistent Hosting On Linux

For a machine that should resume hosting automatically after boot or after being offline, install the autostart recovery timer:

```bash
voxvera autostart
```

This installs a `systemd --user` timer that reruns `voxvera start-all` every few minutes. The retry loop is the supported way to recover hidden-service hosting after suspend, reboot, or temporary network loss.

## Language Support

VoxVera is fully localized. You can change your language preference permanently using either the interactive selector or a direct shortcut:

- **Interactive Selector:** `voxvera lang`
- **Direct Shortcut:** `voxvera --lang de` (sets preference to German)

### Supported Languages:
- **English:** `en`
- **Spanish:** `es` (alias: `--idioma`)
- **German:** `de` (alias: `--sprache`)

You can also force a specific language for a single command without changing your permanent preference:
- **English:** `voxvera --lang en check`
- **German:** `voxvera --sprache de check`
- **Spanish:** `voxvera --idioma es check`

The generated flyers automatically detect the visitor's browser language and switch the UI text accordingly.

## Server Management

Manage multiple flyers and their Tor identities from a single interactive menu:

```bash
voxvera manage
```

Features:
- **{{t('cli.manage_create_new')}}**: Start the full setup sequence.
- **{{t('cli.manage_start_all')}}**: Launch or shut down every flyer in your fleet at once.
- **Real-time Status**: View active `.onion` URLs and Tor bootstrapping progress indicators.
- **Individual Control**: {{t('cli.manage_action_export')}} specific sites to ZIP or delete them.

## Universal Mirroring (Viral Distribution)

To ensure VoxVera remains accessible even if central repositories are censored, every flyer acts as a mirror for the tool.

When you host a flyer, the **"{{t('web.download_button')}}"** button on the landing page provides a `voxvera-source.zip` containing:
- The full source code and all supported languages.
- Installation and setup scripts for all platforms.
- Complete documentation and templates.

To keep the mirrored download practical for low-bandwidth redistribution, the
source archive does not ship pre-downloaded Tor binaries. Normal installer and
release builds still fetch or bundle those artifacts separately.

This allows anyone who scans your flyer to become a new distributor of the VoxVera tool.

## Export & Backup

Back up your unique Tor identities (so your `.onion` URL never changes) or move your flyers to another machine.

- **Export a single site**: `voxvera export <folder_name>`
- **Export all sites**: `voxvera export-all`

**Storage location:** All exports are saved to `~/voxvera-exports/` on all platforms.

## Import & Recovery

Restore your entire setup on a new machine by moving your ZIP files to `~/voxvera-exports/` and running:

```bash
voxvera import-multiple
```

## Portability & Offline Use

If you need to run VoxVera on a machine without internet access, you can "vendorize" the dependencies first:

```bash
voxvera vendorize
```

This downloads all required Python libraries into `voxvera/vendor/`. The tool will then prioritize these local files, allowing it to run without `pip install`.

## Batch Import (JSON)

To bulk-generate flyers from multiple JSON configuration files, place them in the `imports/` directory and run:

```bash
voxvera batch-import
```

## How URLs Work

Each flyer has two separate URLs:
- **Tear-off link** (auto-generated): The .onion address where the flyer is hosted.
- **Content link** (user-configured): An external URL pointing to a website, video, or download.

You do not need to manually enter the .onion address; VoxVera handles this automatically during the `serve` phase.
