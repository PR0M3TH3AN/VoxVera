# VoxVera Flyers

VoxVera provides scripts and templates for producing printable flyers with QR codes. These flyers link to content hosted through Tor and can also include a Nostr page. The project automates building the HTML, generating the QR codes, and copying all assets into a directory under `host/` so they can be served statically.

## TL;DR

```bash
git clone https://github.com/PR0M3TH3AN/VoxVera.git
cd VoxVera
./install.sh    # use install.ps1 on Windows
voxvera quickstart
```

See [docs/usage.md](docs/usage.md) for detailed usage instructions.

## Quick Install

Run the installer to set up the core dependencies and install the `voxvera` CLI.
The script installs Tor, OnionShare, `jq`, `qrencode`, and ImageMagick before
fetching the latest release of the CLI. Run `setup.sh` to install additional
dependencies such as Node.js, `javascript-obfuscator`, `html-minifier-terser`,
and the Python packages `InquirerPy` and `rich` if they are not already
available.

If you already have the prerequisites you can install the package directly from
PyPI:

```bash
pipx install voxvera  # recommended
# or
pip install --user voxvera
```

If your system reports an "externally-managed" Python environment and blocks installation, create a virtual environment first:

```bash
python3 -m venv voxvera-venv
source voxvera-venv/bin/activate
pip install voxvera
```

The legacy `src/create_flyer.sh` script remains for backward compatibility. It
simply forwards its arguments to the Python CLI so existing workflows continue
to work.

### GUI
An Electron wrapper is provided under `gui/electron` for users that prefer a graphical interface.
Run it with:

```bash
cd gui/electron
npm install
npm start
```

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

`setup.sh` also installs the required Python packages automatically. If you
prefer to install them manually, run:

```bash
pip install --user InquirerPy rich
```

The script checks for these dependencies and installs anything that is missing.

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
Run the CLI from any directory:

```bash
# interactive prompts
voxvera init

# use an alternate config file
voxvera init --config path/to/custom.json

# use answers from an existing PDF form
voxvera init --from-pdf path/to/form.pdf
```

After updating the configuration run the build step. You can optionally
include a zip file that visitors can download:

```bash
voxvera build --download path/to/file.zip
```

If `--download` is omitted the CLI looks for `src/download/download.zip` and
copies it into the output directory.

When run interactively you'll be prompted for details such as the flyer title
and headline. The script now also asks for a **URL** and a **Tear-off link**.
These values are written into the configuration file (`src/config.json` by
default) and determine the QR code targets.

The script updates the chosen config file, regenerates QR codes, obfuscates `index-master.html` and `nostr-master.html`, and copies the resulting files plus PDFs and QR images into `host/<subdomain>`. The resulting `src/index.html` and `src/nostr.html` files are generated automatically and excluded from version control via `.gitignore`. The contents in that directory can then be hosted.

Additional documentation is available in the `src/` directory; see [src/README.md](src/README.md) for more details on the obfuscation scripts and additional usage notes.

Additional documentation, including step-by-step instructions and hosting guides, lives under the [docs](docs/) directory.

## Packages
Prebuilt binaries are published on the releases page. Linux users can run the
`packaging/build_appimage.sh` script after a PyInstaller build to create a
portable AppImage. Homebrew and Chocolatey formulas are provided under
`packaging/` for easy upgrades on macOS and Windows.

## Running Tests
The test suite relies on the Python packages
[InquirerPy](https://github.com/kazhala/InquirerPy) and
[rich](https://github.com/Textualize/rich). Install them with:

```bash
pip install -r requirements.txt
```

Then execute the tests using `pytest`.


This project is licensed under the [MIT License](./LICENSE).
