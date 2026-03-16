import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from importlib import resources
from importlib.resources.abc import Traversable
from InquirerPy import prompt, inquirer
from rich.console import Console
from voxvera import __version__

# package root (contains bundled templates and src/)
if getattr(sys, 'frozen', False):
    ROOT = Path(sys._MEIPASS).joinpath("voxvera")
    # Ensure the bundle root is in sys.path for collected packages
    if sys._MEIPASS not in sys.path:
        sys.path.insert(0, sys._MEIPASS)
else:
    ROOT = Path(__file__).resolve().parent

# Persistent data directory (where host/ and projects live)
DATA_DIR = Path(os.environ.get("VOXVERA_DIR", Path.cwd()))

# Global locale state
CURRENT_LOCALE = {}


def _template_res(*parts) -> Traversable:
    """Return a Traversable for files under the packaged ``templates`` folder."""
    if getattr(sys, 'frozen', False):
        # PyInstaller bundle: use sys._MEIPASS
        return Path(sys._MEIPASS).joinpath("voxvera", "templates", *parts)
    return resources.files(__package__).joinpath("templates", *parts)


def _src_res(*parts) -> Traversable:
    """Return a Traversable for files under the packaged ``src`` folder."""
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS).joinpath("voxvera", "src", *parts)
    return resources.files(__package__).joinpath("src", *parts)


def _locale_res(*parts) -> Traversable:
    """Return a Traversable for files under the packaged ``locales`` folder."""
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS).joinpath("voxvera", "locales", *parts)
    return resources.files(__package__).joinpath("locales", *parts)


def load_locale(lang_code: str = "en"):
    """Load the specified locale JSON file."""
    global CURRENT_LOCALE
    try:
        res = _locale_res(f"{lang_code}.json")
        if getattr(sys, 'frozen', False):
            # When frozen, we already have a Path object
            locale_file = res
            if not locale_file.exists():
                lang_code = "en"
                locale_file = _locale_res("en.json")
            CURRENT_LOCALE = json.loads(locale_file.read_text(encoding="utf-8"))
        else:
            with resources.as_file(res) as locale_file:
                if not locale_file.exists():
                    lang_code = "en"  # Fallback
                    with resources.as_file(_locale_res("en.json")) as fallback_file:
                        CURRENT_LOCALE = json.loads(fallback_file.read_text(encoding="utf-8"))
                else:
                    CURRENT_LOCALE = json.loads(locale_file.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Error loading locale {lang_code}: {e}")
        # Final safety fallback to empty dict to avoid KeyErrors
        CURRENT_LOCALE = {"cli": {}, "web": {}, "meta": {}}


def t(path: str, **kwargs) -> str:
    """Retrieve a localized string by dot-path (e.g., 'cli.welcome')."""
    parts = path.split(".")
    val = CURRENT_LOCALE
    for part in parts:
        val = val.get(part, {})
    if not isinstance(val, str):
        return path  # Return the token path if not found
    return val.format(**kwargs)


def require_cmd(cmd: str):
    if cmd == "onionshare-cli":
        try:
            import onionshare_cli  # noqa: F401
            return True
        except ImportError:
            print("Required tool 'onionshare-cli' not bundled or installed.", file=sys.stderr)
            return False

    if shutil.which(cmd) is None:
        print(
            f"Required command '{cmd}' not found. Please install it.", file=sys.stderr
        )
        return False
    return True


def check_deps():
    console = Console()

    # External CLI tools still required at runtime (none anymore if bundled)
    cli_tools = []
    # Python packages used by the build pipeline
    py_packages = {
        "onionshare-cli": "onionshare_cli",
        "qrcode": "qrcode",
        "PIL (Pillow)": "PIL",
        "jsmin": "jsmin",
        "htmlmin": "htmlmin",
    }

    console.rule(t("cli.dep_check_header"))

    for t_cmd in cli_tools:
        if shutil.which(t_cmd):
            console.print(f"{t_cmd}: [green]{t('cli.dep_found')}[/green]")
        else:
            console.print(f"{t_cmd}: [red]{t('cli.dep_missing')}[/red]")

    for label, module in py_packages.items():
        try:
            __import__(module)
            console.print(f"{label}: [green]{t('cli.dep_found')}[/green]")
        except ImportError:
            console.print(f"{label}: [red]{t('cli.dep_missing')}[/red]")

    all_cli = all(shutil.which(t_cmd) for t_cmd in cli_tools)
    all_py = True
    for module in py_packages.values():
        try:
            __import__(module)
        except ImportError:
            all_py = False
            break

    if all_cli and all_py:
        console.print(f"[green]{t('cli.all_deps_installed')}[/green]")
    else:
        console.print(f"[red]{t('cli.all_deps_installed')}[/red]")


def load_config(path: str) -> dict:
    with open(path, "r") as fh:
        return json.load(fh)


def save_config(data: dict, path: str):
    with open(path, "w") as fh:
        json.dump(data, fh, indent=2)


def _open_editor_terminal(initial: str) -> str:
    """Fallback to opening the user's $EDITOR in the terminal."""
    import tempfile

    editor = os.environ.get("EDITOR", "nano")
    if not shutil.which(editor):
        editor = "nano"
        if not shutil.which("nano"):
            # Extreme fallback
            print("\n--- EDIT CONTENT BELOW (End with Ctrl+D) ---")
            print("(This is a fallback because neither $EDITOR nor nano were found)")
            print("--- Current content ---")
            print(initial or "")
            print("---")
            return sys.stdin.read()

    fd, path = tempfile.mkstemp(suffix=".txt")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(initial or "")
        subprocess.call([editor, path])
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    except Exception as e:
        print(f"Error opening terminal editor: {e}")
        return initial
    finally:
        os.unlink(path)


def open_editor(initial: str) -> str:
    """Open a simple GUI text editor with pre-populated content if possible.

    Existing text is pre-filled in the editor. If tkinter or a display
    server is unavailable, falls back to the user's $EDITOR in the terminal.
    """
    # If no display found (on Linux/Unix), immediately use terminal
    if os.name != "nt" and not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
        return _open_editor_terminal(initial)

    try:
        import tkinter as tk
        from tkinter import scrolledtext

        root = tk.Tk()
        root.title("Edit text")
        # Bring to front
        root.attributes("-topmost", True)
        root.after_idle(root.attributes, "-topmost", False)
    except Exception:
        return _open_editor_terminal(initial)

    result = {"text": initial or ""}
    text = scrolledtext.ScrolledText(root, width=80, height=20)
    text.pack(expand=True, fill="both")
    if initial:
        text.insert("1.0", initial)
    text.focus_set()

    def save_and_close():
        result["text"] = text.get("1.0", "end-1c")
        root.destroy()

    save_btn = tk.Button(root, text="Save (or close window)", command=save_and_close)
    save_btn.pack()
    root.protocol("WM_DELETE_WINDOW", save_and_close)

    try:
        root.mainloop()
    except KeyboardInterrupt:
        # If user hits Ctrl+C in terminal while GUI is open, fallback to terminal editor
        try:
            root.destroy()
        except Exception:
            pass
        print("\nGUI editor interrupted. Falling back to terminal editor...")
        return _open_editor_terminal(initial)

    return result["text"]


def _get_visual_width(text: str) -> int:
    """Calculate the visual width of a string (handling CJK double-width)."""
    try:
        from wcwidth import wcswidth
        width = wcswidth(text)
        return width if width >= 0 else len(text)
    except ImportError:
        return len(text)


def _len_transform(limit: int):
    def _t(val: str) -> str:
        width = _get_visual_width(val)
        if width > limit:
            return f"[red]{val} ({width}/{limit})[/red]"
        return f"{val} ({width}/{limit})"

    return _t


def _len_validator(limit: int):
    def _v(val: str):
        width = _get_visual_width(val)
        if width > limit:
            return f"❌ Input too wide: {width}/{limit} visual units. Please shorten it."
        return True

    return _v


def _folder_name_validator(val: str):
    if len(val) > 63:
        return "Folder name must be at most 63 characters"
    if not re.fullmatch(r"[a-z0-9-]+", val):
        return "Use only lowercase letters, numbers and '-'"
    return True


def interactive_update(config_path: str):
    data = load_config(config_path)
    console = Console()

    # Define the fields and their localized fallback paths
    # We use these if the value in data is missing or matches the hardcoded English default
    localized_defaults = {
        "name": t("landing.name"),
        "title": t("landing.title"),
        "subtitle": t("landing.subtitle"),
        "headline": t("landing.headline"),
        "content": t("landing.content"),
        "url_message": t("landing.url_message"),
    }

    # Hardcoded English defaults from the template for comparison
    english_defaults = {
        "name": "Vox Vera Printable Flyers",
        "title": "TOP SECRET",
        "subtitle": "DO ~~NOT~~ DISTRIBUTE",
        "headline": "OPERATION VOX VERA",
    }

    def get_default(key):
        val = data.get(key, "")
        # If empty OR it matches the hardcoded English default, and we have a localized version
        if (not val or val == english_defaults.get(key)) and localized_defaults.get(key):
            # Only use localized if it is actually different from the path (token not found)
            loc_val = localized_defaults.get(key)
            if loc_val != f"landing.{key}":
                return loc_val
        return val

    console.rule(t("cli.init_name"))
    meta_qs = [
        {
            "type": "input",
            "message": t("cli.init_name"),
            "name": "name",
            "default": get_default("name"),
            "transformer": _len_transform(31),
            "validate": _len_validator(31),
        },
        {
            "type": "input",
            "message": t("cli.init_folder"),
            "name": "folder_name",
            "default": data.get("folder_name", "voxvera"),
            "transformer": _len_transform(63),
            "validate": _folder_name_validator,
        },
        {
            "type": "input",
            "message": t("cli.init_title"),
            "name": "title",
            "default": get_default("title"),
            "transformer": _len_transform(31),
            "validate": _len_validator(31),
        },
        {
            "type": "input",
            "message": t("cli.init_subtitle"),
            "name": "subtitle",
            "default": get_default("subtitle"),
            "transformer": _len_transform(27),
            "validate": _len_validator(27),
        },
        {
            "type": "input",
            "message": t("cli.init_headline"),
            "name": "headline",
            "default": get_default("headline"),
            "transformer": _len_transform(31),
            "validate": _len_validator(31),
        },
    ]
    data.update(prompt(meta_qs))

    console.rule(t("cli.init_body"))
    while True:
        # Use existing content if present, else fallback to localized landing default
        initial_content = get_default("content")

        body = open_editor(initial_content)
        length = len(body)
        if length > 1000:
            console.print(f"{t('cli.body_length')}: {length}/1000 {t('cli.body_limit_exceeded')}", style="red")
            if not inquirer.confirm(message=t("cli.edit_again"), default=True).execute():
                break
        else:
            console.print(f"{t('cli.body_length')}: {length}/1000", style="green")
            break
    data["content"] = body

    console.rule(t("cli.init_links"))
    link_qs = [
        {
            "type": "input",
            "message": t("cli.url_label"),
            "name": "url",
            "default": data.get("url", "https://voxvera.org/"),
            "transformer": _len_transform(200),
            "validate": _len_validator(200),
        },
        {
            "type": "input",
            "message": t("cli.url_message_label"),
            "name": "url_message",
            "default": get_default("url_message"),
            "transformer": _len_transform(120),
            "validate": _len_validator(120),
        },

        {
            "type": "input",
            "message": t("cli.binary_message_label"),
            "name": "binary_message",
            "default": data.get("binary_message", ""),
            "transformer": _len_transform(120),
            "validate": _len_validator(120),
        },
        {
            "type": "input",
            "message": t("cli.attachment_path_label"),
            "name": "attachment_path",
            "default": data.get("attachment_path", ""),
        },
    ]
    data.update(prompt(link_qs))

    save_config(data, config_path)


def copy_template(name: str) -> str:
    """Copy a template directory into host/."""
    with resources.as_file(_template_res(name)) as src:
        if not src.is_dir():
            print(f"Template {name} not found", file=sys.stderr)
            sys.exit(1)
        dest = DATA_DIR / "host" / name
        os.makedirs(DATA_DIR / "host", exist_ok=True)
        shutil.copytree(src, dest, dirs_exist_ok=True)
        # Clear any QR codes that might have been in the template
        # to ensure a clean build slate.
        for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
            (dest / qr_file).unlink(missing_ok=True)
    print(f"Template copied to {dest}")
    return str(dest)


def bundle_source(dest_zip: Path):
    """Bundle the VoxVera source code, dependencies (vendor), and root scripts."""
    with zipfile.ZipFile(dest_zip, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # 1. Include the voxvera/ source directory (excluding host, bin, pycache)
        # We DO include vendor here so the source zip is fully functional offline.
        for root, dirs, files in os.walk(ROOT):
            if "__pycache__" in root or "host" in root or "resources/bin" in root:
                continue
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(ROOT.parent)
                zipf.write(file_path, arcname)

        # 2. Include the run scripts and root files
        root_files = [
            "voxvera-run.sh", "voxvera-install.sh", "README.md",
            "requirements.txt", "setup.sh", "install.sh", "uninstall.sh",
            "install.ps1", "uninstall.ps1", "CONTRIBUTING.md", "LICENSE"
        ]
        for script in root_files:
            script_path = ROOT.parent / script
            if script_path.exists():
                zipf.write(script_path, script)

    print(f"Source bundle created at {dest_zip}")


def bundle_portable(dest_zip: Path):
    """Bundle the entire VoxVera source and dependencies into a ZIP (Viral distribution)."""
    # For now, we prioritize source code as requested by the user.
    # We rename it to voxvera-source.zip for clarity.
    bundle_source(dest_zip)


def build_assets(
    config_path: str, download_path: str | None = None
):
    from voxvera.build import generate_qr

    with resources.as_file(_src_res()) as src_dir:
        config_path = Path(config_path)

        data = load_config(config_path)
        with open(src_dir / "index-master.html", "r") as fh:
            html = fh.read()

        # Bundle locales for the web engine
        all_locales = {}
        locale_files = sorted(glob.glob(str(ROOT / "locales" / "*.json")))
        
        # Load master defaults from src/config.json
        src_config_path = ROOT / "src" / "config.json"
        master_defaults = {}
        if src_config_path.exists():
            with open(src_config_path, "r", encoding="utf-8") as sf:
                master_defaults = json.load(sf)

        for lp in locale_files:
            code = Path(lp).stem
            with open(lp, "r", encoding="utf-8") as lf:
                l_data = json.load(lf)
                all_locales[code] = {
                    "meta": l_data.get("meta", {}),
                    "web": l_data.get("web", {}),
                    "landing": l_data.get("landing", {})
                }

                # Override landing data with user custom config data if it differs from master defaults
                for field in ["title", "subtitle", "headline", "content", "url_message"]:
                    if field in data and data[field]:
                        # Only override if the value is different from the master default
                        if data[field] != master_defaults.get(field):
                            all_locales[code]["landing"][field] = data[field]

        html = html.replace("{{locales}}", json.dumps(all_locales))

        # 1. Statically replace localization tokens {{t_web_...}}
        # This ensures the flyer is translated even with JS disabled.
        lang_data = all_locales.get(data.get("lang", "en"), all_locales.get("en", {}))

        # Web tokens (labels, buttons)
        web_tokens = lang_data.get("web", {})
        for token, translation in web_tokens.items():
            # Support Markdown-style redaction ~~text~~ -> <span class="redacted">text</span>
            translation = re.sub(r"~~(.*?)~~", r'<span class="redacted">\1</span>', str(translation))
            html = html.replace(f"{{{{t_web_{token}}}}}", translation)

        # 2. Statically replace landing tokens with user content OR localized defaults
        # We want the user-provided data from config to take precedence.
        landing_fields = ["title", "subtitle", "headline", "content", "url_message"]
        landing_defaults = lang_data.get("landing", {})

        for field in landing_fields:
            # Use data from config if available, otherwise use localized default
            value = data.get(field, landing_defaults.get(field, ""))
            
            # If the value from config is just the master default,
            # and we are NOT in English, use the localized default instead.
            if data.get("lang", "en") != "en":
                if value == master_defaults.get(field):
                    value = landing_defaults.get(field, value)

            # Support Markdown-style redaction ~~text~~
            val_str = re.sub(r"~~(.*?)~~", r'<span class="redacted">\1</span>', str(value))
            html = html.replace(f"{{{{t_landing_{field}}}}}", val_str)

        # 2. Statically replace config placeholders {{key}}
        for key, value in data.items():
            val_str = str(value)
            # Support Markdown-style redaction ~~text~~ for user fields too
            val_str = re.sub(r"~~(.*?)~~", r'<span class="redacted">\1</span>', val_str)
            html = html.replace(f"{{{{{key}}}}}", val_str)

        # Handle optional file attachment
        attachment_path = data.get("attachment_path")
        attachment_url = ""
        attachment_display = "none"
        if attachment_path and os.path.isfile(attachment_path):
            att_filename = os.path.basename(attachment_path)
            attachment_url = f"download/{att_filename}"
            attachment_display = "inline-block"

        html = html.replace("{{attachment_url}}", attachment_url)
        html = html.replace("{{attachment_display}}", attachment_display)

        folder_name = data["folder_name"]
        dest = DATA_DIR / "host" / folder_name
        os.makedirs(dest, exist_ok=True)

        # 1. Refresh QR codes directly in destination
        # generate_qr only creates them if URLs are present in config
        from voxvera.build import generate_qr
        
        # We generate to a temp dir first to ensure we ONLY get what's in current config
        import tempfile
        with tempfile.TemporaryDirectory() as qr_tmp:
            qr_tmp_path = Path(qr_tmp)
            generate_qr(config_path, qr_tmp_path)
            
            # Clear old QR codes from destination and copy new ones
            for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
                qr_dest = dest / qr_file
                qr_src = qr_tmp_path / qr_file
                if qr_src.exists():
                    shutil.copy(qr_src, qr_dest)
                elif qr_dest.exists():
                    qr_dest.unlink()

        # Update download link to point to our viral source bundle

        html = html.replace("download/download.zip", "download/voxvera-source.zip")

        with open(dest / "index.html", "w") as fh:
            fh.write(html)

        # Create the viral source bundle
        download_dir = dest / "download"
        os.makedirs(download_dir, exist_ok=True)
        bundle_source(download_dir / "voxvera-source.zip")

        if download_path:
            shutil.copy(download_path, download_dir / "extra-content.zip")

        if attachment_path and os.path.isfile(attachment_path):
            shutil.copy(attachment_path, download_dir / os.path.basename(attachment_path))

        # Copy config if it's not already there
        if Path(config_path) != dest / "config.json":
            shutil.copy(config_path, dest / "config.json")

        print(f"Flyer files created under {dest}")


def get_tor_ports():
    """Auto-detect Tor SOCKS and Control ports from common defaults."""
    # Common default ports for Tor
    socks_defaults = ["9050", "9150"]
    ctl_defaults = ["9051", "9151"]

    socks_port = os.getenv("TOR_SOCKS_PORT")
    ctl_port = os.getenv("TOR_CONTROL_PORT")

    # If env vars not set, try to auto-detect from running Tor
    if not socks_port or not ctl_port:
        import socket

        for port in socks_defaults:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.5)
                result = sock.connect_ex(("127.0.0.1", int(port)))
                sock.close()
                if result == 0:
                    socks_port = port
                    break
            except Exception:
                pass

        for port in ctl_defaults:
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.5)
                result = sock.connect_ex(("127.0.0.1", int(port)))
                sock.close()
                if result == 0:
                    ctl_port = port
                    break
            except Exception:
                pass

    # Fall back to defaults if nothing detected
    if not socks_port:
        socks_port = "9050"
    if not ctl_port:
        ctl_port = "9051"

    return socks_port, ctl_port


def _internal_onionshare():
    """Hidden command to run the bundled onionshare-cli."""
    import platform

    # Try to add bundled Tor to PATH so OnionShare can find it
    system = platform.system().lower()
    platform_dir = "win" if "windows" in system else "mac" if "darwin" in system else "linux"

    if getattr(sys, 'frozen', False):
        tor_dir = Path(sys._MEIPASS).joinpath("voxvera", "resources", "tor", platform_dir)
    else:
        tor_dir = ROOT / "resources" / "tor" / platform_dir

    # Check if bundled Tor is a real binary and not a placeholder (size > 100 bytes)
    bundled_tor = tor_dir / ("tor.exe" if "windows" in system else "tor")
    if bundled_tor.exists() and bundled_tor.stat().st_size > 100:
        os.environ["PATH"] = str(tor_dir) + os.pathsep + os.environ.get("PATH", "")
        # Robustness: explicitly tell OnionShare where Tor is
        os.environ["TOR_BINARY"] = str(bundled_tor)

    try:
        from onionshare_cli import main
        # sys.argv is ['voxvera', '_internal_onionshare', '--website', ... ]
        # We need to make it look like ['onionshare-cli', '--website', ... ]
        sys.argv = ["onionshare-cli"] + sys.argv[2:]
        sys.exit(main())
    except ImportError as e:
        import traceback
        traceback.print_exc()
        print(f"Error: onionshare-cli not bundled or installed correctly: {e}", file=sys.stderr)
        print(f"DEBUG: sys.path = {sys.path}", file=sys.stderr)
        sys.exit(1)



def serve(config_path: str) -> str | None:
    socks, ctl = get_tor_ports()

    folder_name = load_config(config_path)["folder_name"]
    dir_path = DATA_DIR / "host" / folder_name
    if not dir_path.is_dir():
        print(f"Directory {dir_path} not found", file=sys.stderr)
        sys.exit(1)
    logfile = dir_path / "onionshare.log"

    # Set environment variables for OnionShare to use the detected Tor ports
    env = os.environ.copy()
    env["TOR_SOCKS_PORT"] = socks
    env["TOR_CONTROL_PORT"] = ctl

    # Run the bundled onionshare-cli via our hidden command
    # sys.argv[0] is the current executable (python script or PyInstaller binary)
    cmd = [
        sys.argv[0],
        "_internal_onionshare",
        "--website",
        "--public",
        "--persistent",
        str(dir_path / ".onionshare-session"),
        "--connect-timeout",
        "300",
        "--disable_csp",
        "-v",
        str(dir_path),
    ]

    # If running via 'python -m voxvera.cli', sys.argv[0] might be the script path,
    # so we should ensure it's executed correctly if not a PyInstaller binary.
    if not getattr(sys, 'frozen', False) and sys.argv[0].endswith('.py'):
        cmd = [sys.executable, sys.argv[0]] + cmd[1:]

    log_fh = open(logfile, "w")
    proc = subprocess.Popen(cmd, stdout=log_fh, stderr=subprocess.STDOUT, env=env)

    pid_file = dir_path / "server.pid"
    with open(pid_file, "w") as f:
        f.write(str(proc.pid))

    try:
        import re as _re

        onion_url = None
        console = Console()
        with console.status(f"[bold green][{folder_name}] Connecting to Tor relays and setting up hidden service...") as status:
            last_progress = None
            while onion_url is None:
                time.sleep(1)
                if proc.poll() is not None:
                    status.stop()
                    console.print(f"[bold red]OnionShare for {folder_name} exited unexpectedly.[/bold red]")
                    console.print("[yellow]Common causes: Network blocked, inaccurate system clock, or OnionShare already running.[/yellow]")
                    console.print(f"[dim]See {logfile} for full logs.[/dim]")
                    with open(logfile) as fh:
                        lines = fh.readlines()
                        # Print the last 20 lines of the log to help debug
                        for line in lines[-20:]:
                            sys.stderr.write(line)
                    pid_file.unlink(missing_ok=True)
                    return None

                if os.path.exists(logfile):
                    with open(logfile) as fh:
                        content = fh.read()

                    # Look for Tor bootstrap progress in logs to give feedback
                    m_progress = _re.findall(r"Bootstrapped (\d+)%", content)
                    if m_progress:
                        current_progress = m_progress[-1]
                        if current_progress != last_progress:
                            status.update(f"[bold green][{folder_name}] Tor Bootstrapping: {current_progress}% ...")
                            last_progress = current_progress

                    m = _re.search(r"https?://[a-z0-9]+\.onion", content)
                    if m:
                        onion_url = m.group(0)

        # update config with the onion URL in the host directory
        config_file = dir_path / "config.json"
        data = load_config(config_file)
        data["tear_off_link"] = onion_url
        save_config(data, config_file)

        # regenerate assets with the new URL using the host-local config
        build_assets(str(config_file))

        print(f"[{folder_name}] Onion URL: {onion_url}")
        print(f"[{folder_name}] OnionShare running (PID {proc.pid}).")
        return onion_url
    except KeyboardInterrupt:
        return None
    finally:
        log_fh.close()


def _clear_host_dir(dir_path: Path):
    """Remove host directory contents but preserve the OnionShare session key."""
    session = dir_path / ".onionshare-session"
    saved = session.read_bytes() if session.exists() else None
    shutil.rmtree(dir_path, ignore_errors=True)
    if saved is not None:
        os.makedirs(dir_path, exist_ok=True)
        session.write_bytes(saved)


import zipfile
import tempfile


def get_export_dir() -> Path:
    """Get the default export directory (~/voxvera-exports)."""
    export_dir = Path.home() / "voxvera-exports"
    os.makedirs(export_dir, exist_ok=True)
    return export_dir


def export_site(folder_name: str, output_path: str = None):
    """Export a site folder and its keys into a zip archive."""
    source_dir = ROOT / "host" / folder_name
    if not source_dir.exists():
        print(f"Error: Site folder '{folder_name}' not found in {ROOT / 'host'}")
        return

    if not output_path:
        export_dir = get_export_dir()
        output_path = export_dir / f"{folder_name}_export.zip"
    else:
        output_path = Path(output_path)

    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(source_dir)
                zipf.write(file_path, arcname)

    print(f"Exported '{folder_name}' to {output_path}")


def export_all_sites():
    """Export all available sites in the host directory."""
    servers = get_servers()
    if not servers:
        print("No sites found to export.")
        return

    export_dir = get_export_dir()
    print(f"Exporting {len(servers)} sites to {export_dir}...")
    for server in servers:
        export_site(server)
    print("Export all complete.")


def import_site(zip_path: str):
    """Import a site folder and its keys from a zip archive."""
    zip_path = Path(zip_path)
    if not zip_path.exists():
        print(f"Error: Zip file '{zip_path}' not found.")
        return

    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            zipf.extractall(tmpdir)

        tmp_path = Path(tmpdir)
        config_file = tmp_path / "config.json"
        if not config_file.exists():
            print("Error: Invalid export file. Missing 'config.json'.")
            return

        data = load_config(config_file)
        folder_name = data.get("folder_name")
        if not folder_name:
            print("Error: Invalid config.json. Missing 'folder_name'.")
            return

        dest_dir = ROOT / "host" / folder_name
        if dest_dir.exists():
            confirm = inquirer.confirm(message=f"Site '{folder_name}' already exists. Overwrite?").execute()
            if not confirm:
                print("Import cancelled.")
                return
            shutil.rmtree(dest_dir)

        shutil.copytree(tmp_path, dest_dir)
        print(f"Successfully imported '{folder_name}' to {dest_dir}")


def import_multiple_sites(source_dir: str = None):
    """Import all zip files from a directory (defaults to ~/voxvera-exports)."""

    if not source_dir:
        source_dir = get_export_dir()
    else:
        source_dir = Path(source_dir)

    if not source_dir.exists():
        print(f"Error: Directory '{source_dir}' not found.")
        return

    zip_files = sorted(glob.glob(str(source_dir / "*.zip")))
    if not zip_files:
        print(f"No zip files found in {source_dir}")
        return

    print(f"Found {len(zip_files)} site(s) to import from {source_dir}...")
    for zip_path in zip_files:
        print(f"\nImporting {Path(zip_path).name}...")
        import_site(zip_path)
    print("\nImport multiple complete.")


def build_docs():
    """Generate localized documentation from templates and locale data."""
    if getattr(sys, 'frozen', False):
        template_dir = Path(sys._MEIPASS).joinpath("docs", "templates")
        doc_root = Path(sys._MEIPASS).joinpath("docs")
    else:
        template_dir = ROOT.parent / "docs" / "templates"
        doc_root = ROOT.parent / "docs"

    if not template_dir.exists():
        print(f"Error: {template_dir} not found.")
        return

    # List all supported languages
    locale_files = sorted(glob.glob(str(ROOT / "locales" / "*.json")))
    langs = [Path(f).stem for f in locale_files]

    for lang in langs:
        print(f"Generating documentation for: {lang}")
        load_locale(lang)
        dest_dir = doc_root / lang
        os.makedirs(dest_dir, exist_ok=True)

        # Process each template
        for t_file in glob.glob(str(template_dir / "*.md")):
            name = Path(t_file).name
            with open(t_file, "r", encoding="utf-8") as f:
                content = f.read()

            # Replace tokens: {{t('path.to.token')}}
            # This regex looks for {{t('...')}} and {{t("...")}}
            import re as _re

            def replace_token(match):
                token_path = match.group(1)
                return t(token_path)

            content = _re.sub(r"\{\{t\(['\"](.+?)['\"]\)\}\}", replace_token, content)

            # Look for localized overrides in voxvera/locales/{lang}/docs/{name}
            override_path = ROOT / "locales" / lang / "docs" / name
            if override_path.exists():
                with open(override_path, "r", encoding="utf-8") as f:
                    content = f.read()
                # Process tokens in the override as well
                content = _re.sub(r"\{\{t\(['\"](.+?)['\"]\)\}\}", replace_token, content)

            with open(dest_dir / name, "w", encoding="utf-8") as f:
                f.write(content)

    print("Documentation build complete.")


def build_site():
    """Refresh the main site/ directory with the latest template, QRs, and portable bundle."""
    # When frozen, site/ source is in sys._MEIPASS, but we might want to output to CWD/site
    if getattr(sys, 'frozen', False):
        src_site = Path(sys._MEIPASS).joinpath("site")
        dest_site = Path.cwd() / "site"
    else:
        src_site = ROOT.parent / "site"
        dest_site = src_site

    if not src_site.exists():
        print(f"Error: {src_site} directory not found.")
        return

    config_path = dest_site / "config.json"
    if not config_path.exists():
        # Fallback to source if dest doesn't have it (e.g. first run)
        config_path = src_site / "config.json"
        if not config_path.exists():
            print(f"Error: {config_path} not found.")
            return

    print(f"Refreshing {dest_site} assets...")

    # 1. Refresh QR codes using site/config.json
    from voxvera.build import generate_qr
    generate_qr(config_path, dest_site)

    # 2. Build the HTML from master template
    data = load_config(config_path)
    res = _src_res("index-master.html")
    if getattr(sys, 'frozen', False):
        template_path = res
        with open(template_path, "r") as fh:
            html = fh.read()
    else:
        with resources.as_file(res) as template_path:
            with open(template_path, "r") as fh:
                html = fh.read()

    # Bundle locales (Include landing tokens for the main site)
    all_locales = {}
    locale_files = sorted(glob.glob(str(ROOT / "locales" / "*.json")))
    
    # Load master defaults from src/config.json
    src_config_path = ROOT / "src" / "config.json"
    master_defaults = {}
    if src_config_path.exists():
        with open(src_config_path, "r", encoding="utf-8") as sf:
            master_defaults = json.load(sf)

    for lp in locale_files:
        code = Path(lp).stem
        with open(lp, "r", encoding="utf-8") as lf:
            l_data = json.load(lf)
            all_locales[code] = {
                "meta": l_data.get("meta", {}),
                "web": l_data.get("web", {}),
                "landing": l_data.get("landing", {})
            }

            # Override landing data with user custom config data if it differs from master defaults
            for field in ["title", "subtitle", "headline", "content", "url_message"]:
                if field in data and data[field]:
                    # Only override if the value is different from the master default
                    if data[field] != master_defaults.get(field):
                        all_locales[code]["landing"][field] = data[field]

    html = html.replace("{{locales}}", json.dumps(all_locales))

    # 1. Statically replace localization tokens (web tokens)
    # Get the language from config if available, else default to en
    current_lang = data.get("lang", "en")
    lang_data = all_locales.get(current_lang, all_locales.get("en", {}))

    web_tokens = lang_data.get("web", {})
    for token, translation in web_tokens.items():
        # Support Markdown-style redaction ~~text~~ -> <span class="redacted">text</span>
        translation = re.sub(r"~~(.*?)~~", r'<span class="redacted">\1</span>', str(translation))
        html = html.replace(f"{{{{t_web_{token}}}}}", translation)

    # 2. Statically replace landing tokens with user content OR localized defaults
    landing_fields = ["title", "subtitle", "headline", "content", "url_message"]
    landing_defaults = lang_data.get("landing", {})

    for field in landing_fields:
        # Use data from config if available, otherwise use localized default
        value = data.get(field, landing_defaults.get(field, ""))
        
        # If the value from config is just the master default,
        # and we are NOT in English, use the localized default instead.
        if current_lang != "en":
            if value == master_defaults.get(field):
                value = landing_defaults.get(field, value)

        # Support Markdown-style redaction ~~text~~
        val_str = re.sub(r"~~(.*?)~~", r'<span class="redacted">\1</span>', str(value))
        html = html.replace(f"{{{{t_landing_{field}}}}}", val_str)

    # 3. Update relative path for download
    html = html.replace("download/download.zip", "download/voxvera-source.zip")

    # 4. Inject site-specific config data (handles any remaining {{key}} placeholders)
    for key, value in data.items():
        html = html.replace(f"{{{{{key}}}}}", str(value))

    os.makedirs(dest_site, exist_ok=True)
    with open(dest_site / "index.html", "w") as fh:
        fh.write(html)

    # 5. Create the download assets in site/download/
    download_dir = dest_site / "download"
    os.makedirs(download_dir, exist_ok=True)

    # Bundle source version
    bundle_source(download_dir / "voxvera-source.zip")

    # Copy standalone binaries if they exist
    bin_dir = ROOT / "resources" / "bin"
    if bin_dir.exists():
        for bin_file in bin_dir.iterdir():
            if bin_file.is_file():
                shutil.copy(bin_file, download_dir / bin_file.name)

    print("site/ directory successfully synchronized.")


def vendorize():
    """Download all dependencies into voxvera/vendor/ for portable use."""
    vendor_dir = ROOT / "vendor"
    req_file = ROOT.parent / "requirements.txt"
    if not req_file.exists():
        print("Error: requirements.txt not found.")
        return

    os.makedirs(vendor_dir, exist_ok=True)
    print(f"Vendorizing dependencies into {vendor_dir}...")

    try:
        subprocess.check_call([
            sys.executable, "-m", "pip", "install",
            "-r", str(req_file),
            "--target", str(vendor_dir),
            "--no-compile"
        ])
        print("Vendorization complete.")
    except subprocess.CalledProcessError as e:
        print(f"Error during vendorization: {e}")


def batch_import_configs():
    files = sorted(glob.glob(str(DATA_DIR / "imports" / "*.json")))
    if not files:
        print("No JSON files found in imports")
        return
    for json_file in files:
        print(f"Processing {json_file}")
        # Use a temp config path in DATA_DIR instead of bundled ROOT
        dest_config = DATA_DIR / "temp_config.json"
        shutil.copy(json_file, dest_config)
        folder_name = load_config(json_file)["folder_name"]
        _clear_host_dir(DATA_DIR / "host" / folder_name)
        build_assets(str(dest_config))
        dest_config.unlink(missing_ok=True)


def get_servers() -> list[str]:
    # Check both bundled ROOT/host and local DATA_DIR/host
    search_paths = []
    if ROOT != DATA_DIR:
        search_paths.append(ROOT / "host")
    search_paths.append(DATA_DIR / "host")
    
    servers = set()
    for host_dir in search_paths:
        if host_dir.exists():
            for d in host_dir.iterdir():
                if d.is_dir() and (d / "config.json").exists():
                    servers.add(d.name)
    return sorted(list(servers))


def is_server_running(folder_name: str) -> bool:
    pid_file = DATA_DIR / "host" / folder_name / "server.pid"
    if not pid_file.exists():
        return False
    try:
        with open(pid_file, "r") as f:
            pid = int(f.read().strip())
    except ValueError:
        pid_file.unlink(missing_ok=True)
        return False

    import platform
    import subprocess
    if platform.system() == "Windows":
        try:
            output = subprocess.check_output(f"tasklist /FI \"PID eq {pid}\" /NH", shell=True, stderr=subprocess.STDOUT).decode()
            if "No tasks are running" in output:
                pid_file.unlink(missing_ok=True)
                return False
            return True
        except subprocess.CalledProcessError:
            pid_file.unlink(missing_ok=True)
            return False
    else:
        try:
            os.kill(pid, 0)
        except OSError:
            pid_file.unlink(missing_ok=True)
            return False

        try:
            output = subprocess.check_output(["ps", "-p", str(pid), "-o", "command="], stderr=subprocess.STDOUT).decode().lower()
            if "onionshare" in output or "python" in output or "tor" in output:
                return True
            return False
        except Exception:
            return False


def stop_server(folder_name: str):
    pid_file = DATA_DIR / "host" / folder_name / "server.pid"
    if not pid_file.exists():
        print(f"Server {folder_name} is not running.")
        return
    try:
        with open(pid_file, "r") as f:
            pid = int(f.read().strip())
        import platform, signal
        if platform.system() == "Windows":
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        else:
            os.kill(pid, signal.SIGTERM)
        print(f"Stopped {folder_name} (PID {pid})")
    except Exception as e:
        print(f"Error stopping {folder_name}: {e}")
    finally:
        pid_file.unlink(missing_ok=True)


def delete_server(folder_name: str):
    if is_server_running(folder_name):
        stop_server(folder_name)
    dir_path = DATA_DIR / "host" / folder_name
    if dir_path.exists():
        shutil.rmtree(dir_path, ignore_errors=True)
        print(f"Deleted server {folder_name}")


def manage_servers():
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice
    console = Console()

    while True:
        servers = get_servers()

        choices = []
        for s in servers:
            running = is_server_running(s)
            status_text = "[ON] " if running else "[OFF]"

            label = f"{status_text} {s}"
            if running:
                try:
                    site_data = load_config(DATA_DIR / "host" / s / "config.json")
                    url = site_data.get("tear_off_link")
                    if url:
                        label += f" ({url})"
                except Exception:
                    pass
            choices.append(Choice(s, label))

        choices.insert(0, Choice("create_new", t("cli.manage_create_new")))
        if servers:
            choices.append(Choice("start_all", t("cli.manage_start_all")))
            choices.append(Choice("stop_all", t("cli.manage_stop_all")))
            choices.append(Choice("export_all", t("cli.manage_export_all")))
        choices.append(Choice("import_multiple", t("cli.manage_import_multiple")))
        choices.append(Choice(None, t("cli.manage_exit")))

        selected = inquirer.select(
            message=t("cli.manage_select_server"),
            choices=choices
        ).execute()

        if selected is None:
            break

        if selected == "create_new":
            config_path = DATA_DIR / "config.json"
            # Reset config from template for a fresh start
            try:
                template_config = _template_res("voxvera", "config.json")
                with resources.as_file(template_config) as tc:
                    shutil.copy(tc, config_path)
            except Exception as e:
                console.print(f"[yellow]Warning: Could not reset config from template: {e}[/yellow]")

            try:
                interactive_update(str(config_path))
                build_assets(str(config_path))
                serve(str(config_path))
            except (KeyboardInterrupt, Exception) as e:
                if not isinstance(e, KeyboardInterrupt):
                    console.print(f"[red]Error creating site: {e}[/red]")
                else:
                    console.print("\n[yellow]Site creation cancelled.[/yellow]")
            continue

        if selected == "start_all":
            results = []
            for s in servers:
                if not is_server_running(s):
                    config_path = DATA_DIR / "host" / s / "config.json"
                    try:
                        url = serve(str(config_path))
                        if url:
                            results.append((s, url))
                    except Exception as e:
                        console.print(f"[red]{t('cli.manage_startup_summary')}: {e}[/red]")

            if results:
                console.rule(t("cli.manage_startup_summary"))
                for s, url in results:
                    console.print(f"[green]✔ {s}: [bold]{url}[/bold][/green]")
                inquirer.confirm(message=t("cli.manage_press_enter"), default=True).execute()
            continue

        if selected == "stop_all":
            for s in servers:
                if is_server_running(s):
                    stop_server(s)
            continue

        if selected == "export_all":
            export_all_sites()
            continue

        if selected == "import_multiple":
            import_multiple_sites()
            continue

        running = is_server_running(selected)
        action_choices = [
            Choice("toggle", t("cli.manage_action_toggle_stop") if running else t("cli.manage_action_toggle_start")),
            Choice("edit", t("cli.manage_action_edit")),
            Choice("export", t("cli.manage_action_export")),
            Choice("delete", t("cli.manage_action_delete")),
            Choice(None, t("cli.manage_action_back"))
        ]

        action = inquirer.select(
            message=t("cli.manage_action_menu", name=selected),
            choices=action_choices
        ).execute()

        if action == "toggle":
            if running:
                stop_server(selected)
            else:
                config_path = DATA_DIR / "host" / selected / "config.json"
                try:
                    serve(str(config_path))
                except SystemExit:
                    pass
        elif action == "edit":
            config_path = DATA_DIR / "host" / selected / "config.json"
            try:
                interactive_update(str(config_path))
                # Re-build assets after update
                build_assets(str(config_path))
                console.print(f"[green]✔ {selected} updated and rebuilt successfully.[/green]")
            except (KeyboardInterrupt, Exception) as e:
                if not isinstance(e, KeyboardInterrupt):
                    console.print(f"[red]Error updating site: {e}[/red]")
                else:
                    console.print("\n[yellow]Update cancelled.[/yellow]")
        elif action == "export":
            export_site(selected)
        elif action == "delete":
            confirm = inquirer.confirm(message=t("cli.manage_delete_confirm", name=selected)).execute()
            if confirm:
                delete_server(selected)


def choose_language(current_lang: str = None) -> str:
    """Prompt the user to select a language."""
    # List available locales
    locale_files = sorted(glob.glob(str(ROOT / "locales" / "*.json")))
    choices = []

    # Use fallback if no locales folder (e.g. first run/dev)
    if not locale_files:
        return "en"

    default_idx = 0
    for i, path in enumerate(locale_files):
        code = Path(path).stem
        try:
            with open(path, "r", encoding="utf-8") as f:
                meta = json.load(f).get("meta", {})
                name = meta.get("language_name", code)
                flag = meta.get("flag", "")
                choices.append({"name": f"{flag} {name} ({code})", "value": code})
                if code == current_lang:
                    default_idx = i
        except Exception:
            choices.append({"name": code, "value": code})

    # If only one choice, don't bother asking
    if len(choices) <= 1:
        return choices[0]["value"] if choices else "en"

    lang = inquirer.select(
        message="Select your language / Seleccione su idioma:",
        choices=choices,
        default=choices[default_idx]["value"] if current_lang else choices[0]["value"]
    ).execute()
    return lang


def main(argv=None):
    parser = argparse.ArgumentParser(prog="voxvera")
    parser.add_argument(
        "--config",
        default=str(DATA_DIR / "config.json"),
        help="Path to config.json",
    )
    parser.add_argument(
        "--lang", "--language", "--sprache", "--idioma",
        help="Force language code (e.g. en, es, de)",
    )
    parser.add_argument(
        "--version", "-V",
        action="version",
        version=f"VoxVera {__version__}",
        help="Show version information and exit",
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("lang", help="Change language preference")

    # ... (parsers as before) ...

    p_init = sub.add_parser(
        "init", help="Update configuration interactively"
    )
    p_init.add_argument("--template", help="Copy a template into dist/")
    p_init.add_argument("--non-interactive", action="store_true")

    p_build = sub.add_parser("build", help="Build flyer assets from config")
    p_build.add_argument("--download")

    p_export = sub.add_parser("export", help="Export a site and its keys into a zip archive")
    p_export.add_argument("folder_name", help="Name of the site folder in host/")
    p_export.add_argument("--output", help="Custom output path for the zip")

    sub.add_parser("export-all", help="Export all sites and their keys to ~/voxvera-exports")

    p_import = sub.add_parser("import", help="Import a site and its keys from a zip archive")
    p_import.add_argument("zip_path", help="Path to the exported zip file")

    p_import_multiple = sub.add_parser("import-multiple", help="Import multiple sites and their keys from a directory")
    p_import_multiple.add_argument("--dir", help="Directory containing export zips (defaults to ~/voxvera-exports)")

    sub.add_parser("batch-import", help="Batch import JSON files from imports/")
    sub.add_parser("serve", help="Serve flyer over OnionShare using config")
    p_quickstart = sub.add_parser(
        "quickstart", help="Init, build and serve in sequence"
    )
    p_quickstart.add_argument(
        "--non-interactive",
        action="store_true",
        help="Skip interactive prompts and use existing config",
    )
    sub.add_parser("check", help="Check for required external dependencies")
    sub.add_parser("vendorize", help="Download all dependencies into voxvera/vendor/ for portability")
    sub.add_parser("build-docs", help="Generate localized documentation from templates")
    sub.add_parser("build-site", help="Refresh the main site/ directory assets and bundle")
    sub.add_parser("manage", help="Manage VoxVera servers interactively")
    sub.add_parser("_internal_onionshare", help=argparse.SUPPRESS)

    args, unknown_args = parser.parse_known_args(argv)

    if args.command == "_internal_onionshare":
        _internal_onionshare()
        return

    config_path = Path(args.config).resolve()

    # Determine language
    current_lang = args.lang
    config_data = {}
    if config_path.exists():
        try:
            config_data = load_config(str(config_path))
            if not current_lang:
                current_lang = config_data.get("lang")
        except Exception:
            pass

    if not current_lang and args.command in ["init", "quickstart", "manage"]:
        current_lang = choose_language()
        # Save choice to config if possible
        if config_path.exists():
            config_data["lang"] = current_lang
            save_config(config_data, str(config_path))

    # Load the locale
    load_locale(current_lang or "en")

    if args.command == "lang":
        new_lang = choose_language(current_lang)
        if config_path.exists():
            config_data["lang"] = new_lang
            save_config(config_data, str(config_path))
        print(f"Language changed to {new_lang}")
        return

    if not args.command:
        if args.lang:
            # If they just ran 'voxvera --lang de', save it and exit
            if config_path.exists():
                config_data["lang"] = args.lang
                save_config(config_data, str(config_path))
            print(f"Language changed to {args.lang}")
            return
        else:
            parser.print_help()
            return

    if args.command == "init":
        if args.template:
            copy_template(args.template)
            return
        elif not args.non_interactive:
            interactive_update(config_path)
        build_assets(config_path)
    elif args.command == "build":
        build_assets(config_path, download_path=args.download)
    elif args.command == "export":
        export_site(args.folder_name, args.output)
    elif args.command == "export-all":
        export_all_sites()
    elif args.command == "import":
        import_site(args.zip_path)
    elif args.command == "import-multiple":
        import_multiple_sites(args.dir)
    elif args.command == "serve":
        serve(config_path)
    elif args.command == "batch-import":
        batch_import_configs()
    elif args.command == "manage":
        manage_servers()
    elif args.command == "quickstart":
        if not args.non_interactive:
            if not sys.stdin.isatty():
                print(
                    "Error: quickstart requires an interactive terminal. "
                    "Use --non-interactive or run 'voxvera init' first.",
                    file=sys.stderr,
                )
                sys.exit(1)
            interactive_update(config_path)
        build_assets(config_path)
    elif args.command == "check":
        check_deps()
    elif args.command == "vendorize":
        vendorize()
    elif args.command == "build-docs":
        build_docs()
    elif args.command == "build-site":
        build_site()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
