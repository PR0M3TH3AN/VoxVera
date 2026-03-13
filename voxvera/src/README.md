# VoxVera Source Files

This directory contains the source assets used to build flyers:

- `index-master.html` -- Main flyer template (HTML/CSS/JS)
- `nostr-master.html` -- Nostr sharing page template
- `config.json` -- Default configuration values
- `example.pdf` -- Example PDF included with built flyers
- `submission_form.pdf` -- Submission form included with built flyers
- `qrcode-content.png` -- Generated QR code for the content link
- `qrcode-tear-offs.png` -- Generated QR code for the tear-off link

## Build Pipeline

The `voxvera build` command processes these source files:

1. **QR code generation** -- Reads URLs from `config.json` and generates PNG QR codes using the `qrcode` and `Pillow` Python libraries.
2. **HTML minification** -- Minifies embedded JavaScript with `jsmin` and the overall HTML with `htmlmin2`. Produces `index.html` and `nostr.html` from the master templates.
3. **Binary message injection** -- Writes the configured binary message into the built HTML.
4. **Asset packaging** -- Copies all built files into `host/<subdomain>/`.

No external tools (Node.js, ImageMagick, qrencode, etc.) are required. The entire build pipeline uses pure Python packages.

## URL Handling

- The **content link** (`url` in config.json) is set by the user during `voxvera init` and can point to any external resource.
- The **tear-off link** (`tear_off_link` in config.json) is automatically set to the .onion address when `voxvera serve` starts. Tear-off QR codes are regenerated at that point.

## Editing Templates

Edit `index-master.html` or `nostr-master.html` directly if you need to customize the flyer layout. The JavaScript at the bottom of each file populates content from `config.json` at runtime.

## Creating and Hosting a Flyer

```bash
# Configure flyer content and external URL
voxvera init

# Build assets
voxvera build

# Host over Tor (auto-detects ports, generates .onion address)
voxvera serve
```

Or do all three in one step:

```bash
voxvera quickstart
```
