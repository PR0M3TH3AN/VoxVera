# VoxVera GUI

This directory contains a minimal Electron wrapper around the `voxvera` CLI.
It exposes a simple "Quickstart" button so non-technical users can generate
flyers without touching the command line.

## Development

```
cd gui/electron
npm install
npm start
```

The Electron app invokes the `voxvera` binary from your `PATH`.
Make sure it is installed before launching the GUI.

Configuration is stored in your operating system's *user data* directory.
On Linux this defaults to `~/.config/voxvera-gui/config.json`. The first
launch copies a default `config.json` there and subsequent edits via the GUI
update that file.
