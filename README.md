# VoxVera Flyers

VoxVera provides scripts and templates for producing printable flyers with QR codes. These flyers link to content hosted through Tor and can also include a Nostr page. The project automates building the HTML, generating the QR codes, and copying all assets into a directory under `host/` so they can be served statically.

## Prerequisites
- **Node.js** and **npm**
- **jq**
- **qrencode**
- **ImageMagick** (`convert`)
- **javascript-obfuscator** and **html-minifier-terser** (installed via npm)
- **pdftotext** (optional, used when extracting fields from a PDF form)

## Generating a Flyer
Run the helper script from the repository root:

```bash
# interactive prompts
./src/create_flyer.sh

# use answers from an existing PDF form
./src/create_flyer.sh --from-pdf path/to/form.pdf
```

The script updates `src/config.json`, regenerates QR codes, obfuscates `index-master.html` and `nostr-master.html`, and copies the resulting files plus PDFs and QR images into `host/<subdomain>`. The contents in that directory can then be hosted.

See [src/README.md](src/README.md) for more details on the obfuscation scripts and additional usage notes.
