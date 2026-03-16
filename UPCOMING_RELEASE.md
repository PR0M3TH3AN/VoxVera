# VoxVera v0.2.11

## Changes and Improvements

### Logic and UI Fixes
- **Attachment overriding URL:** Modified the core HTML template and config generation so that a provided file attachment fully replaces the external URL in the main content area and QR codes, eliminating redundancy. The "Download Attachment" button at the bottom was removed, keeping the main interface clean and focusing on the attachment directly via the primary URL slot.
- **Interactive Prompt:** The interactive CLI now treats the URL and attachment path as an "either/or" choice conditionally, improving clarity.

### Stability and Bug Fixes
- **Nano Terminal Crash:** Fixed an issue where the `nano` editor would crash with "Code: 11" when launched from the interactive interface within a PyInstaller binary. The application now properly inherits standard input/output streams for standard terminal editors.
- **ModuleNotFoundError Fix:** Added explicit `pkg_resources` and `setuptools` hidden imports to the PyInstaller build configuration, permanently fixing an error where `onionshare-cli` would fail to initialize in the standalone binary with a `ModuleNotFoundError: No module named 'pkg_resources'`.