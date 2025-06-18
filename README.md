# VoxVera Flyers

VoxVera provides scripts and templates for producing printable flyers with QR codes. These flyers link to content hosted through Tor and can also include a Nostr page. The project automates building the HTML, generating the QR codes, and copying all assets into a directory under `host/` so they can be served statically.

## Prerequisites
- **Node.js** and **npm**
- **jq**
- **qrencode**
- **ImageMagick** (`convert`)
- **javascript-obfuscator** and **html-minifier-terser** (installed via npm)
- **pdftotext** (optional, used when extracting fields from a PDF form)

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
Run the helper script from the repository root:

```bash
# interactive prompts
./src/create_flyer.sh

# use an alternate config file
./src/create_flyer.sh -c path/to/custom.json

# use answers from an existing PDF form
./src/create_flyer.sh --from-pdf path/to/form.pdf
```

When run interactively you'll be prompted for details such as the flyer title
and headline. The script now also asks for a **URL** and a **Tear-off link**.
These values are written into the configuration file (`src/config.json` by
default) and determine the QR code targets.

The script updates the chosen config file, regenerates QR codes, obfuscates `index-master.html` and `nostr-master.html`, and copies the resulting files plus PDFs and QR images into `host/<subdomain>`. The resulting `src/index.html` and `src/nostr.html` files are generated automatically and excluded from version control via `.gitignore`. The contents in that directory can then be hosted.

Additional documentation is available in the `src/` directory; see [src/README.md](src/README.md) for more details on the obfuscation scripts and additional usage notes.

## Step-by-Step
1. Edit `src/index-master.html` or `src/nostr-master.html` if you need custom content.
2. Run `./src/create_flyer.sh` and follow the prompts, or use `./src/create_flyer.sh --from-pdf path/to/form.pdf`.
3. Host the generated `host/<subdomain>` directory.

## Batch Import
Place configuration files in an `imports/` directory at the project root. Run

```bash
./src/import_from_json.sh
```

Each JSON file is copied to `src/config.json` and processed with
`create_flyer.sh --no-interaction`. Existing folders under `host/` with the
same subdomain are removed before new files are written.

## Hosting Options
The folder under `host/<subdomain>` contains all of the files needed to serve
the flyer as a static website. A few easy ways to make it publicly accessible
include:

- **GitHub Pages** – Create a new repository or use GitHub Pages from this one
  and push the contents of `host/<subdomain>` to a branch called `gh-pages`.
- **Netlify** – Drag and drop the folder onto Netlify or connect it to a Git
  repository. Netlify will automatically deploy the static files and provide a
  public URL.
- **OnionShare** – For a privacy‑focused option, you can host the folder from
  an old laptop running [OnionShare](https://onionshare.org). OnionShare shares
  the files over Tor, allowing others to access them using the provided onion
  address.

This project is licensed under the [MIT License](./LICENSE).
