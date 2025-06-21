# VoxVera Flyers

Generate printable flyers with QR codes that link to Tor (.onion) or HTTPS sites, plus an optional Nostr address.

---

## 🎉 Quick Install (no Git, no pip hassles)

1. **Download the prebuilt Linux binary**  
   ```bash
   mkdir -p ~/.local/bin
   wget -qO ~/.local/bin/voxvera \
     https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera
   chmod +x ~/.local/bin/voxvera
   ```

2. **Ensure `$HOME/.local/bin` is in your `PATH`**
   Add this to your `~/.bashrc` or `~/.zshrc` if needed:

   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```
3. **Run the CLI**

   ```bash
   voxvera quickstart
   ```

---

## 🛠️ From Source (for contributors)

If you want to hack on VoxVera, clone the repo and use a virtual env:

```bash
# 1. Clone the repo
git clone https://github.com/PR0M3TH3AN/VoxVera.git
cd VoxVera

# 2. Create & activate a Python venv
python3 -m venv .venv
source .venv/bin/activate

# 3. Install the package
pip install --upgrade pip
pip install .

# 4. Run
voxvera quickstart
```

---

## 📦 Docker (optional)

VoxVera is also on GitHub Container Registry:

```bash
docker pull ghcr.io/PR0M3TH3AN/voxvera:latest
mkdir flyers
docker run --rm -it -v "$(pwd)/flyers:/flyers" ghcr.io/PR0M3TH3AN/voxvera
```

Generated flyers land in `./flyers`.

---

## 🚀 Usage

```bash
# Initialize a new flyer (interactive prompts)
voxvera init

# Build the HTML, QR codes & static files
voxvera build

# Host via OnionShare on Tor
voxvera serve
```

See `voxvera check` to verify you have `tor`, `onionshare-cli`, `jq`, `qrencode`, `imagemagick`, `node`, `javascript-obfuscator`, and `html-minifier-terser`.

---

## 📄 Docs

Full docs in the `docs/` folder:

* `docs/usage.md` — detailed CLI guide
* `docs/docker.md` — Docker tips
* `docs/troubleshooting.md` — common fixes

---

## 📜 License

MIT © 2025 thePR0M3TH3AN