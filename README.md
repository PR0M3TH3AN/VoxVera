# VoxVera Flyers

VoxVera provides scripts and templates for producing printable flyers with QR codes. These flyers link to content hosted through Tor and can also include a Nostr page. The project automates building the HTML, generating the QR codes, and copying all assets into a directory under `host/` so they can be served statically.

## Quick Install

Run the installer to set up all dependencies and the `voxvera` CLI in one step.

### Linux/macOS

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.ps1 | iex
```

## Prerequisites
- **Node.js** and **npm**
- **jq**
- **qrencode**
- **ImageMagick** (`convert`)
- **javascript-obfuscator** and **html-minifier-terser** (installed via npm)
- **pdftotext** (optional, used when extracting fields from a PDF form)
- **Python packages** [`InquirerPy`](https://github.com/kazhala/InquirerPy) and [`rich`](https://github.com/Textualize/rich)

## Installing Dependencies

On Debian or Ubuntu systems you can install the required packages with:

```bash
sudo apt update
sudo apt install -y jq qrencode imagemagick poppler-utils nodejs npm
```

### macOS

With [Homebrew](https://brew.sh) you can install the same dependencies:

```bash
brew install jq qrencode imagemagick poppler node coreutils
```

The obfuscation scripts attempt to use `mktemp --suffix` when creating
temporary files. If that option is unavailable – for example on macOS without
GNU `coreutils` – the scripts automatically fall back to a portable `mktemp`
command that yields the same result.

The obfuscation scripts also rely on a pair of Node modules. Install them
globally:

```bash
npm install -g javascript-obfuscator html-minifier-terser
```

Install the Python dependencies:

```bash
pip install --user InquirerPy rich
```

A helper script `setup.sh` is provided to check for these dependencies and
install anything that is missing.

### Windows

These scripts rely on a Unix-like environment. The recommended approach on
Windows is to use **WSL2** with a Debian distribution. Install WSL and Debian
with:

```powershell
wsl --install
```

Launch the Debian terminal and run `setup.sh` from this repository or the
`apt` commands shown above to install all prerequisites. Alternative
environments such as **MSYS2** or **Git Bash** can also be used, but they must
provide the same command-line utilities.

## Generating a Flyer
Run the CLI from the repository root:

```bash
# interactive prompts
voxvera init

# use an alternate config file
voxvera init --config path/to/custom.json

# use answers from an existing PDF form
voxvera init --from-pdf path/to/form.pdf
```

When run interactively you'll be prompted for details such as the flyer title
and headline. The script now also asks for a **URL** and a **Tear-off link**.
These values are written into the configuration file (`src/config.json` by
default) and determine the QR code targets.

The script updates the chosen config file, regenerates QR codes, obfuscates `index-master.html` and `nostr-master.html`, and copies the resulting files plus PDFs and QR images into `host/<subdomain>`. The resulting `src/index.html` and `src/nostr.html` files are generated automatically and excluded from version control via `.gitignore`. The contents in that directory can then be hosted.

Additional documentation is available in the `src/` directory; see [src/README.md](src/README.md) for more details on the obfuscation scripts and additional usage notes.

## Step-by-Step
1. Edit `src/index-master.html` or `src/nostr-master.html` if you need custom content.
2. Run `voxvera init` and follow the prompts, or use `voxvera init --from-pdf path/to/form.pdf`.
3. Host the generated `host/<subdomain>` directory.
   The `index.html` file fetches `config.json`, so the flyer must be served via a
   local or remote web server rather than opened directly from disk. For a quick
   test you can run `python3 -m http.server` inside the folder and then visit the
   provided address.

## Batch Import
Place configuration files in an `imports/` directory at the project root. Run

```bash
voxvera import
```

Each JSON file is copied to `src/config.json` and processed with
`voxvera build`. Existing folders under `host/` with the
same subdomain are removed before new files are written.

## Hosting with OnionShare
The folder under `host/<subdomain>` contains everything needed to serve the
flyer. Use the CLI to publish it over Tor:
The script now resolves the configuration and host paths internally, so it can
be invoked from any directory:

```bash
voxvera serve
```

The script launches `onionshare-cli` in persistent website mode, waits for the
generated onion URL, patches `config.json`, regenerates the QR codes and
obfuscated HTML, and then copies the updated files back into the `host`
directory. The onion address is printed when ready. Keep OnionShare running to
continue hosting.

`index.html` fetches `config.json` dynamically, so the flyer should be viewed
through a local or remote web server. For quick testing, run
`python3 -m http.server` in the folder and open the provided address instead of
loading the file directly.

This project is licensed under the [MIT License](./LICENSE).
