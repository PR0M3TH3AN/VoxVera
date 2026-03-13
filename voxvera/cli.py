import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import datetime
from pathlib import Path
from importlib import resources
from importlib.resources.abc import Traversable
from InquirerPy import prompt, inquirer
from rich.console import Console

# package root (contains bundled templates and src/)
ROOT = Path(__file__).resolve().parent


def _template_res(*parts) -> Traversable:
    """Return a Traversable for files under the packaged ``templates`` folder."""
    return resources.files(__package__).joinpath("templates", *parts)


def _src_res(*parts) -> Traversable:
    """Return a Traversable for files under the packaged ``src`` folder."""
    return resources.files(__package__).joinpath("src", *parts)


def require_cmd(cmd: str):
    if shutil.which(cmd) is None:
        print(
            f"Required command '{cmd}' not found. Please install it.", file=sys.stderr
        )
        return False
    return True


def check_deps():
    console = Console()

    # External CLI tools still required at runtime
    cli_tools = ["onionshare-cli"]
    # Python packages used by the build pipeline
    py_packages = {
        "qrcode": "qrcode",
        "PIL (Pillow)": "PIL",
        "jsmin": "jsmin",
        "htmlmin": "htmlmin",
    }

    console.rule("Dependency Check")

    for t in cli_tools:
        if shutil.which(t):
            console.print(f"{t}: [green]found[/green]")
        else:
            console.print(f"{t}: [red]missing[/red]")

    for label, module in py_packages.items():
        try:
            __import__(module)
            console.print(f"{label}: [green]found[/green]")
        except ImportError:
            console.print(f"{label}: [red]missing[/red]")

    all_cli = all(shutil.which(t) for t in cli_tools)
    all_py = True
    for module in py_packages.values():
        try:
            __import__(module)
        except ImportError:
            all_py = False
            break

    if all_cli and all_py:
        console.print("[green]All dependencies are installed.[/green]")
    else:
        console.print(
            "[red]Some dependencies are missing. Run: pip install 'voxvera[all]'[/red]"
        )


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
    fd, path = tempfile.mkstemp(suffix=".txt")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(initial or "")
        subprocess.call([editor, path])
        with open(path, "r", encoding="utf-8") as fh:
            return fh.read()
    finally:
        os.unlink(path)


# 🔧 merged conflicting changes from codex/populate-gui-text-fields-for-editing vs main
def open_editor(initial: str) -> str:
    """Open a simple GUI text editor with pre-populated content if possible.

    Existing text is pre-filled in the editor. If tkinter or a display
    server is unavailable, falls back to the user's $EDITOR in the terminal.
    """
    try:
        import tkinter as tk
        from tkinter import scrolledtext

        root = tk.Tk()
        root.title("Edit text")
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

    save_btn = tk.Button(root, text="Save", command=save_and_close)
    save_btn.pack()
    root.protocol("WM_DELETE_WINDOW", save_and_close)
    root.mainloop()
    return result["text"]


def _len_transform(limit: int):
    def _t(val: str) -> str:
        length = len(val)
        if length > limit:
            return f"[red]{val} ({length}/{limit})[/red]"
        return f"{val} ({length}/{limit})"

    return _t


def _len_validator(limit: int):
    def _v(val: str):
        length = len(val)
        if length > limit:
            return f"❌ Input too long: {length}/{limit} characters. Please shorten it."
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

    console.rule("Metadata")
    meta_qs = [
        {
            "type": "input",
            "message": "Name",
            "name": "name",
            "default": data.get("name", ""),
            "transformer": _len_transform(60),
            "validate": _len_validator(60),
        },
        {
            "type": "input",
            "message": "Folder Name",
            "name": "folder_name",
            "default": data.get("folder_name", ""),
            "transformer": _len_transform(63),
            "validate": _folder_name_validator,
        },
        {
            "type": "input",
            "message": "Title",
            "name": "title",
            "default": data.get("title", ""),
            "transformer": _len_transform(60),
            "validate": _len_validator(60),
        },
        {
            "type": "input",
            "message": "Subtitle",
            "name": "subtitle",
            "default": data.get("subtitle", ""),
            "transformer": _len_transform(80),
            "validate": _len_validator(80),
        },
        {
            "type": "input",
            "message": "Headline",
            "name": "headline",
            "default": data.get("headline", ""),
            "transformer": _len_transform(80),
            "validate": _len_validator(80),
        },
    ]
    data.update(prompt(meta_qs))

    console.rule("Body text")
    while True:
        body = open_editor(data.get("content", ""))
        length = len(body)
        if length > 1000:
            console.print(f"Body length: {length}/1000 exceeds limit", style="red")
            if not inquirer.confirm(message="Edit again?", default=True).execute():
                break
        else:
            console.print(f"Body length: {length}/1000", style="green")
            break
    data["content"] = body

    console.rule("Links")
    # URL is the main content link (user-configurable, e.g., external resource)
    # Tear-off link will be auto-generated from Tor keys when serving
    link_qs = [
        {
            "type": "input",
            "message": "URL (content link - external resource)",
            "name": "url",
            "default": data.get("url", ""),
            "transformer": _len_transform(200),
            "validate": _len_validator(200),
        },
        {
            "type": "input",
            "message": "URL message",
            "name": "url_message",
            "default": data.get("url_message", ""),
            "transformer": _len_transform(120),
            "validate": _len_validator(120),
        },
        {
            "type": "input",
            "message": "Binary message",
            "name": "binary_message",
            "default": data.get("binary_message", ""),
            "transformer": _len_transform(120),
            "validate": _len_validator(120),
        },
    ]
    data.update(prompt(link_qs))

    save_config(data, config_path)


def copy_template(name: str) -> str:
    """Copy a template directory into dist/ with a datestamped folder."""
    date = datetime.date.today().strftime("%Y%m%d")
    with resources.as_file(_template_res(name)) as src:
        if not src.is_dir():
            print(f"Template {name} not found", file=sys.stderr)
            sys.exit(1)
        dest = ROOT / "dist" / f"{name}-{date}"
        os.makedirs(ROOT / "dist", exist_ok=True)
        shutil.copytree(src, dest, dirs_exist_ok=True)
    print(f"Template copied to {dest}")
    return str(dest)


def build_assets(
    config_path: str, download_path: str | None = None
):
    from voxvera.build import generate_qr

    with resources.as_file(_src_res()) as src_dir:
        config_path = Path(config_path)
        # generate QR codes (pure Python)
        generate_qr(config_path, src_dir)
        
        data = load_config(config_path)
        with open(src_dir / "index-master.html", "r") as fh:
            html = fh.read()
        
        # Statically replace {{placeholders}} with config values for Tor JS-disabled compatibility
        for key, value in data.items():
            html = html.replace(f"{{{{{key}}}}}", str(value))

        folder_name = data["folder_name"]
        dest = ROOT / "host" / folder_name
        os.makedirs(dest, exist_ok=True)
        
        with open(dest / "index.html", "w") as fh:
            fh.write(html)
        if download_path:
            os.makedirs(dest / "download", exist_ok=True)
            shutil.copy(download_path, dest / "download" / "download.zip")
        # Only copy config if it's not already in the destination
        if Path(config_path) != dest / "config.json":
            shutil.copy(config_path, dest / "config.json")
        # Copy QR codes only if they exist (may not be generated if URLs not set)
        for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
            qr_src = Path(src_dir) / qr_file
            if qr_src.exists():
                shutil.copy(qr_src, dest / qr_file)
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


def serve(config_path: str):
    if not require_cmd("onionshare-cli"):
        sys.exit(1)

    socks, ctl = get_tor_ports()

    folder_name = load_config(config_path)["folder_name"]
    dir_path = ROOT / "host" / folder_name
    if not dir_path.is_dir():
        print(f"Directory {dir_path} not found", file=sys.stderr)
        sys.exit(1)
    logfile = dir_path / "onionshare.log"

    # Set environment variables for OnionShare to use the detected Tor ports
    env = os.environ.copy()
    env["TOR_SOCKS_PORT"] = socks
    env["TOR_CONTROL_PORT"] = ctl

    cmd = [
        "onionshare-cli",
        "--website",
        "--public",
        "--persistent",
        str(dir_path / ".onionshare-session"),
        "-v",
        str(dir_path),
    ]
    log_fh = open(logfile, "w")
    proc = subprocess.Popen(cmd, stdout=log_fh, stderr=subprocess.STDOUT, env=env)
    
    pid_file = dir_path / "server.pid"
    with open(pid_file, "w") as f:
        f.write(str(proc.pid))

    try:
        import time
        import re as _re

        onion_url = None
        console = Console()
        with console.status("[bold green]Connecting to Tor relays and setting up hidden service...") as status:
            while onion_url is None:
                time.sleep(1)
                if proc.poll() is not None:
                    print("OnionShare exited unexpectedly", file=sys.stderr)
                    with open(logfile) as fh:
                        sys.stderr.write(fh.read())
                    pid_file.unlink(missing_ok=True)
                    sys.exit(1)
                if os.path.exists(logfile):
                    with open(logfile) as fh:
                        content = fh.read()
                    
                    # Look for Tor bootstrap progress in logs to give feedback
                    m_progress = _re.findall(r"Bootstrapped (\d+)%", content)
                    if m_progress:
                        status.update(f"[bold green]Tor Bootstrapping: {m_progress[-1]}% ...")

                    m = _re.search(r"https?://[a-z0-9]+\.onion", content)
                    if m:
                        onion_url = m.group(0)
        
        print(f"Onion URL: {onion_url}")
        # update config with the onion URL
        # tear_off_link is set to the onion address (for tear-off tabs)
        # url remains as user-configured (for main content link)
        config_file = dir_path / "config.json"
        data = load_config(config_file)
        data["tear_off_link"] = onion_url
        save_config(data, config_file)
        # regenerate assets with the new URL (pass config file path, not already in host dir)
        # We need to rebuild from src to regenerate QR codes with the new onion URL
        src_config = ROOT / "src" / "config.json"
        if src_config.exists() and src_config != config_file:
            # Update src config and rebuild
            save_config(data, src_config)
            build_assets(src_config)
        print(f"OnionShare running (PID {proc.pid}). See {logfile} for details.")
    except KeyboardInterrupt:
        pass
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


def import_configs():
    import glob

    files = sorted(glob.glob(str(ROOT / "imports" / "*.json")))
    if not files:
        print("No JSON files found in imports")
        return
    for json_file in files:
        print(f"Processing {json_file}")
        dest_config = ROOT / "src" / "config.json"
        shutil.copy(json_file, dest_config)
        folder_name = load_config(json_file)["folder_name"]
        _clear_host_dir(ROOT / "host" / folder_name)
        build_assets(dest_config)


def get_servers() -> list[str]:
    host_dir = ROOT / "host"
    if not host_dir.exists():
        return []
    servers = []
    for d in host_dir.iterdir():
        if d.is_dir() and (d / "config.json").exists():
            servers.append(d.name)
    return sorted(servers)


def is_server_running(folder_name: str) -> bool:
    pid_file = ROOT / "host" / folder_name / "server.pid"
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
            output = subprocess.check_output(f'tasklist /FI "PID eq {pid}" /NH', shell=True, stderr=subprocess.STDOUT).decode()
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
            return True
        except Exception:
            return True


def stop_server(folder_name: str):
    pid_file = ROOT / "host" / folder_name / "server.pid"
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
    dir_path = ROOT / "host" / folder_name
    if dir_path.exists():
        shutil.rmtree(dir_path, ignore_errors=True)
        print(f"Deleted server {folder_name}")


def manage_servers():
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice
    console = Console()
    
    while True:
        servers = get_servers()
        if not servers:
            console.print("[red]No servers found. Use 'voxvera build' or 'voxvera quickstart' to create one.[/red]")
            return
            
        choices = []
        for s in servers:
            running = is_server_running(s)
            status_text = "[ON] " if running else "[OFF]"
            choices.append(Choice(s, f"{status_text} {s}"))
            
        choices.append(Choice(None, "Exit"))
        
        selected = inquirer.select(
            message="Select a server to manage (or Exit):",
            choices=choices
        ).execute()
        
        if selected is None:
            break
            
        running = is_server_running(selected)
        action_choices = [
            Choice("toggle", "Stop" if running else "Start"),
            Choice("delete", "Delete"),
            Choice(None, "Back")
        ]
        
        action = inquirer.select(
            message=f"Manage {selected}:",
            choices=action_choices
        ).execute()
        
        if action == "toggle":
            if running:
                stop_server(selected)
            else:
                config_path = ROOT / "host" / selected / "config.json"
                try:
                    serve(str(config_path))
                except SystemExit:
                    pass
        elif action == "delete":
            confirm = inquirer.confirm(message=f"Are you sure you want to delete {selected}?").execute()
            if confirm:
                delete_server(selected)


def main(argv=None):
    parser = argparse.ArgumentParser(prog="voxvera")
    parser.add_argument(
        "--config",
        default=str(ROOT / "src" / "config.json"),
        help="Path to config.json",
    )
    sub = parser.add_subparsers(dest="command")

    p_init = sub.add_parser(
        "init", help="Update configuration interactively"
    )
    p_init.add_argument("--template", help="Copy a template into dist/")
    p_init.add_argument("--non-interactive", action="store_true")

    p_build = sub.add_parser("build", help="Build flyer assets from config")
    p_build.add_argument("--download")

    sub.add_parser("import", help="Batch import JSON files from imports/")
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
    sub.add_parser("manage", help="Manage VoxVera servers interactively")

    args = parser.parse_args(argv)
    config_path = Path(args.config).resolve()

    if args.command == "init":
        if args.template:
            copy_template(args.template)
            return
        elif not args.non_interactive:
            interactive_update(config_path)
        build_assets(config_path)
        serve(config_path)
    elif args.command == "build":
        build_assets(config_path, download_path=args.download)
    elif args.command == "serve":
        serve(config_path)
    elif args.command == "import":
        import_configs()
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
        serve(config_path)
    elif args.command == "check":
        check_deps()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
