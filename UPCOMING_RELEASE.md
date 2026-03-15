# VoxVera v0.2.1

## Changes and Improvements

### Windows Compatibility
- **Fixed Windows Crash:** Resolved an issue where the standalone Windows `.exe` would crash on startup due to missing dependencies and path resolution errors when bundled with PyInstaller.
- **Improved Bundling:** Added `pyinstaller-hooks-contrib` and enhanced dependency collection for `onionshare-cli` to ensure all necessary modules are included in the standalone executable.
- **Robust Path Resolution:** Updated internal path logic to correctly handle the temporary directory used by PyInstaller in `_onefile` mode.
