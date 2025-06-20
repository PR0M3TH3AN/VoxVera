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
from importlib.abc import Traversable
from InquirerPy import prompt, inquirer
from rich.console import Console

# project root
ROOT = Path(__file__).resolve().parent.parent


def _template_res(*parts) -> Traversable:
    return resources.files(__package__).joinpath('..', 'templates', *parts)


def _src_res(*parts) -> Traversable:
    return resources.files(__package__).joinpath('..', 'src', *parts)


def require_cmd(cmd: str):
    if shutil.which(cmd) is None:
        print(f"Required command '{cmd}' not found. Please install it.", file=sys.stderr)
        return False
    return True


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


def open_editor(initial: str) -> str:
    import tempfile
    editor = os.environ.get('EDITOR', 'nano')
    fd, path = tempfile.mkstemp(suffix='.txt')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            fh.write(initial or '')
        subprocess.call([editor, path])
        with open(path, 'r', encoding='utf-8') as fh:
            return fh.read()
    finally:
        os.unlink(path)


def _len_transform(limit: int):
    def _t(val: str) -> str:
        l = len(val)
        if l > limit:
            return f"[red]{val} ({l}/{limit})[/red]"
        return f"{val} ({l}/{limit})"
    return _t


def interactive_update(config_path: str):
    data = load_config(config_path)
    console = Console()

    console.rule("Metadata")
    meta_qs = [
        {"type": "input", "message": "Name", "name": "name", "default": data.get("name", ""), "transformer": _len_transform(60)},
        {"type": "input", "message": "Subdomain", "name": "subdomain", "default": data.get("subdomain", ""), "transformer": _len_transform(63)},
        {"type": "input", "message": "Title", "name": "title", "default": data.get("title", ""), "transformer": _len_transform(60)},
        {"type": "input", "message": "Subtitle", "name": "subtitle", "default": data.get("subtitle", ""), "transformer": _len_transform(80)},
        {"type": "input", "message": "Headline", "name": "headline", "default": data.get("headline", ""), "transformer": _len_transform(80)},
    ]
    data.update(prompt(meta_qs))

    console.rule("Body text")
    body = open_editor(data.get("content", ""))
    console.print(f"Body length: {len(body)}/1000", style="red" if len(body) > 1000 else "green")
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
        {"type": "input", "message": "URL", "name": "url", "default": data.get("url", constructed), "transformer": _len_transform(200)},
        {"type": "input", "message": "Tear-off link", "name": "tear_off_link", "default": data.get("tear_off_link", constructed), "transformer": _len_transform(200)},
        {"type": "input", "message": "URL message", "name": "url_message", "default": data.get("url_message", ""), "transformer": _len_transform(120)},
        {"type": "input", "message": "Binary message", "name": "binary_message", "default": data.get("binary_message", ""), "transformer": _len_transform(120)},
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


def build_assets(config_path: str, pdf_path: str | None = None):
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
        shutil.copy(config_path, dest / 'config.json')
        for fname in ['index.html', 'nostr.html', 'qrcode-content.png', 'qrcode-tear-offs.png', 'example.pdf', 'submission_form.pdf']:
            shutil.copy(src_dir / fname, dest)
        if pdf_path:
            shutil.copy(pdf_path, dest / 'from_client' / 'submission_form.pdf')
        print(f"Flyer files created under {dest}")


def serve(config_path: str):
    if not require_cmd('onionshare-cli'):
        sys.exit(1)
    subdomain = load_config(config_path)['subdomain']
    dir_path = ROOT / 'host' / subdomain
    if not dir_path.is_dir():
        print(f"Directory {dir_path} not found", file=sys.stderr)
        sys.exit(1)
    logfile = dir_path / 'onionshare.log'
    proc = subprocess.Popen(['onionshare-cli', '--website', '--public', '--persistent', f'{dir_path}/.onionshare-session', str(dir_path)], stdout=open(logfile, 'w'), stderr=subprocess.STDOUT)
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
    parser.add_argument('--config', default=str(ROOT / 'src' / 'config.json'), help='Path to config.json')
    sub = parser.add_subparsers(dest='command')

    p_init = sub.add_parser('init', help='Update configuration interactively or from PDF')
    p_init.add_argument('--template', help='Copy a template into dist/')
    p_init.add_argument('--from-pdf')
    p_init.add_argument('--non-interactive', action='store_true')

    p_build = sub.add_parser('build', help='Build flyer assets from config')
    p_build.add_argument('--pdf')

    sub.add_parser('import', help='Batch import JSON files from imports/')
    sub.add_parser('serve', help='Serve flyer over OnionShare using config')
    sub.add_parser('quickstart', help='Init, build and serve in sequence')

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
        build_assets(config_path, pdf_path=args.pdf)
    elif args.command == 'serve':
        serve(config_path)
    elif args.command == 'import':
        import_configs()
    elif args.command == 'quickstart':
        interactive_update(config_path)
        build_assets(config_path)
        serve(config_path)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
