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
    return resources.files(__package__).joinpath('templates', *parts)

def _src_res(*parts) -> Traversable:
    """Return a Traversable for files under the packaged ``src`` folder."""
    return resources.files(__package__).joinpath('src', *parts)


def require_cmd(cmd: str):
    if shutil.which(cmd) is None:
        print(f"Required command '{cmd}' not found. Please install it.", file=sys.stderr)
        return False
    return True


def check_deps():
    console = Console()
    tools = [
        "node",
        "javascript-obfuscator",
        "html-minifier-terser",
        "jq",
        "qrencode",
        "onionshare-cli",
        "convert",
        "pdftotext",
    ]

    found = []
    missing = []
    for t in tools:
        if shutil.which(t):
            found.append(t)
        else:
            missing.append(t)

    console.rule("Dependency Check")
    for t in tools:
        status = "found" if t in found else "missing"
        color = "green" if t in found else "red"
        console.print(f"{t}: [{color}]{status}[/{color}]")

    if missing:
        console.print(f"[red]Missing tools:[/red] {', '.join(missing)}")
    else:
        console.print("[green]All required tools are installed.[/green]")


def run(cmd, **kwargs):
    try:
        subprocess.run(cmd, check=True, **kwargs)
    except FileNotFoundError:
        print(f"Required command '{cmd[0]}' not found. Please install it.", file=sys.stderr)
        sys.exit(1)


def load_config(path: str) -> dict:
    with open(path, 'r') as fh:
        return json.load(fh)


def save_config(data: dict, path: str):
    with open(path, 'w') as fh:
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
            return f"Must be at most {limit} characters ({length})"
        return True
    return _v


def _subdomain_validator(val: str):
    if len(val) > 63:
        return "Subdomain must be at most 63 characters"
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
            "message": "Subdomain",
            "name": "subdomain",
            "default": data.get("subdomain", ""),
            "transformer": _len_transform(63),
            "validate": _subdomain_validator,
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
    protocol = inquirer.select(
        message="Default URL type",
        choices=[("Tor (.onion)", "tor"), ("HTTPS", "https")],
        default="tor",
    ).execute()

    onion_base = "6dshf2gnj7yzxlfcaczlyi57up4mvbtd5orinuj5bjsfycnhz2w456yd.onion"
    if protocol == "tor":
        constructed = f"http://{data['subdomain']}.{onion_base}"
    else:
        constructed = f"https://{data['subdomain']}.example.com"

    link_qs = [
        {
            "type": "input",
            "message": "URL",
            "name": "url",
            "default": data.get("url", constructed),
            "transformer": _len_transform(200),
            "validate": _len_validator(200),
        },
        {
            "type": "input",
            "message": "Tear-off link",
            "name": "tear_off_link",
            "default": data.get("tear_off_link", constructed),
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


def update_from_pdf(config_path: str, pdf_path: str):
    import tempfile
    tmpdir = tempfile.mkdtemp()
    os.makedirs(os.path.join(tmpdir, 'from_client'), exist_ok=True)
    shutil.copy(pdf_path, os.path.join(tmpdir, 'from_client', 'submission_form.pdf'))
    with resources.as_file(_template_res('blank', 'extract_form_fields.sh')) as p:
        shutil.copy(p, tmpdir)
    shutil.copy(config_path, os.path.join(tmpdir, 'config.json'))
    run(['bash', 'extract_form_fields.sh'], cwd=tmpdir)
    shutil.copy(os.path.join(tmpdir, 'config.json'), config_path)
    shutil.rmtree(tmpdir)


def copy_template(name: str) -> str:
    """Copy a template directory into dist/ with a datestamped folder."""
    date = datetime.date.today().strftime('%Y%m%d')
    with resources.as_file(_template_res(name)) as src:
        if not src.is_dir():
            print(f"Template {name} not found", file=sys.stderr)
            sys.exit(1)
        dest = ROOT / 'dist' / f"{name}-{date}"
        os.makedirs(ROOT / 'dist', exist_ok=True)
        shutil.copytree(src, dest, dirs_exist_ok=True)
    print(f"Template copied to {dest}")
    return str(dest)


def build_assets(config_path: str, pdf_path: str | None = None,
                 download_path: str | None = None):
    with resources.as_file(_src_res()) as src_dir:
        # generate QR codes
        run(['bash', 'generate_qr.sh', config_path], cwd=src_dir)
        # obfuscate html
        run(['bash', 'obfuscate_index.sh', config_path], cwd=src_dir)
        run(['bash', 'obfuscate_nostr.sh', config_path], cwd=src_dir)
        data = load_config(config_path)
        with open(src_dir / 'index.html', 'r') as fh:
            html = fh.read()
        pattern = r'<p class="binary" id="binary-message">.*?</p>'
        repl = f'<p class="binary" id="binary-message">{data.get("binary_message", "")}</p>'
        html = re.sub(pattern, repl, html, flags=re.S)
        with open(src_dir / 'index.html', 'w') as fh:
            fh.write(html)
        subdomain = data['subdomain']
        dest = ROOT / 'host' / subdomain
        os.makedirs(dest / 'from_client', exist_ok=True)
        if download_path:
            os.makedirs(dest / 'download', exist_ok=True)
            shutil.copy(download_path, dest / 'download' / 'download.zip')
        shutil.copy(config_path, dest / 'config.json')
        for fname in ['index.html', 'nostr.html', 'qrcode-content.png', 'qrcode-tear-offs.png', 'example.pdf', 'submission_form.pdf']:
            shutil.copy(src_dir / fname, dest)
        if pdf_path:
            shutil.copy(pdf_path, dest / 'from_client' / 'submission_form.pdf')
        print(f"Flyer files created under {dest}")


def serve(config_path: str):
    if not require_cmd('onionshare-cli'):
        sys.exit(1)
    socks = os.getenv("TOR_SOCKS_PORT")
    ctl = os.getenv("TOR_CONTROL_PORT")
    if not socks or not ctl:
        print("TOR_SOCKS_PORT and TOR_CONTROL_PORT must be set", file=sys.stderr)
        sys.exit(1)

    subdomain = load_config(config_path)['subdomain']
    dir_path = ROOT / 'host' / subdomain
    if not dir_path.is_dir():
        print(f"Directory {dir_path} not found", file=sys.stderr)
        sys.exit(1)
    logfile = dir_path / 'onionshare.log'

    cmd = [
        'onionshare-cli', '--website', '--public', '--persistent',
        '--external-tor-socks-port', socks,
        '--external-tor-control-port', ctl,
        str(dir_path)
    ]
    proc = subprocess.Popen(cmd,
                            stdout=open(logfile, 'w'),
                            stderr=subprocess.STDOUT)
    try:
        import time
        import re as _re
        onion_url = None
        while onion_url is None:
            time.sleep(1)
            if proc.poll() is not None:
                print('OnionShare exited unexpectedly', file=sys.stderr)
                with open(logfile) as fh:
                    sys.stderr.write(fh.read())
                sys.exit(1)
            if os.path.exists(logfile):
                with open(logfile) as fh:
                    content = fh.read()
                m = _re.search(r'https?://[a-z0-9]+\.onion', content)
                if m:
                    onion_url = m.group(0)
        print(f"Onion URL: {onion_url}")
        # update config
        data = load_config(dir_path / 'config.json')
        data['url'] = onion_url
        data['tear_off_link'] = onion_url
        save_config(data, dir_path / 'config.json')
        # regenerate assets
        build_assets(dir_path / 'config.json')
        print(f"OnionShare running (PID {proc.pid}). See {logfile} for details.")
    except KeyboardInterrupt:
        pass


def import_configs():
    import glob
    files = sorted(glob.glob(str(ROOT / 'imports' / '*.json')))
    if not files:
        print('No JSON files found in imports')
        return
    for json_file in files:
        print(f'Processing {json_file}')
        dest_config = ROOT / 'src' / 'config.json'
        shutil.copy(json_file, dest_config)
        subdomain = load_config(json_file)['subdomain']
        shutil.rmtree(ROOT / 'host' / subdomain, ignore_errors=True)
        build_assets(dest_config)


def main(argv=None):
    parser = argparse.ArgumentParser(prog='voxvera')
    parser.add_argument('--config', default=str(ROOT / 'src' / 'config.json'),
                        help='Path to config.json')
    sub = parser.add_subparsers(dest='command')

    p_init = sub.add_parser('init', help='Update configuration interactively or from PDF')
    p_init.add_argument('--template', help='Copy a template into dist/')
    p_init.add_argument('--from-pdf')
    p_init.add_argument('--non-interactive', action='store_true')

    p_build = sub.add_parser('build', help='Build flyer assets from config')
    p_build.add_argument('--pdf')
    p_build.add_argument('--download')

    sub.add_parser('import', help='Batch import JSON files from imports/')
    sub.add_parser('serve', help='Serve flyer over OnionShare using config')
    p_quickstart = sub.add_parser('quickstart', help='Init, build and serve in sequence')
    p_quickstart.add_argument('--non-interactive', action='store_true',
                              help='Skip interactive prompts and use existing config')
    sub.add_parser('check', help='Check for required external dependencies')

    args = parser.parse_args(argv)
    config_path = Path(args.config).resolve()

    if args.command == 'init':
        if args.template:
            copy_template(args.template)
            return
        elif args.from_pdf:
            if not require_cmd('pdftotext'):
                sys.exit(1)
            update_from_pdf(config_path, args.from_pdf)
        elif not args.non_interactive:
            interactive_update(config_path)
    elif args.command == 'build':
        build_assets(config_path, pdf_path=args.pdf, download_path=args.download)
    elif args.command == 'serve':
        serve(config_path)
    elif args.command == 'import':
        import_configs()
    elif args.command == 'quickstart':
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
    elif args.command == 'check':
        check_deps()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
