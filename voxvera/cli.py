import argparse
import json
import os
import re
import shutil
import subprocess
import sys
tmpimport = None


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


def interactive_update(config_path: str):
    data = load_config(config_path)
    def prompt(field, default=None):
        val = input(f"{field}{' ['+default+']' if default else ''}: ")
        return val or default or ''

    data['name'] = prompt('Name')
    data['subdomain'] = prompt('Subdomain')
    data['title'] = prompt('Title')
    data['subtitle'] = prompt('Subtitle')
    data['headline'] = prompt('Headline')
    print('Enter content (end with EOF on its own line):')
    content_lines = []
    while True:
        line = input()
        if line == 'EOF':
            break
        content_lines.append(line)
    data['content'] = '\n'.join(content_lines)
    data['url_message'] = prompt('URL message')
    data['binary_message'] = prompt('Binary message')
    onion_base = '6dshf2gnj7yzxlfcaczlyi57up4mvbtd5orinuj5bjsfycnhz2w456yd.onion'
    constructed = f"http://{data['subdomain']}.{onion_base}"
    data['url'] = prompt('URL', constructed)
    data['tear_off_link'] = prompt('Tear-off link', constructed)
    save_config(data, config_path)


def update_from_pdf(config_path: str, pdf_path: str):
    import tempfile
    tmpdir = tempfile.mkdtemp()
    os.makedirs(os.path.join(tmpdir, 'from_client'), exist_ok=True)
    shutil.copy(pdf_path, os.path.join(tmpdir, 'from_client', 'submission_form.pdf'))
    shutil.copy('host/blank/extract_form_fields.sh', tmpdir)
    shutil.copy(config_path, os.path.join(tmpdir, 'config.json'))
    run(['bash', 'extract_form_fields.sh'], cwd=tmpdir)
    shutil.copy(os.path.join(tmpdir, 'config.json'), config_path)
    shutil.rmtree(tmpdir)


def build_assets(config_path: str, pdf_path: str | None = None):
    # generate QR codes
    run(['bash', 'generate_qr.sh', config_path], cwd='src')
    # obfuscate html
    run(['bash', 'obfuscate_index.sh', config_path], cwd='src')
    run(['bash', 'obfuscate_nostr.sh', config_path], cwd='src')
    data = load_config(config_path)
    with open('src/index.html', 'r') as fh:
        html = fh.read()
    pattern = r'<p class="binary" id="binary-message">.*?</p>'
    repl = f'<p class="binary" id="binary-message">{data.get("binary_message", "")}</p>'
    html = re.sub(pattern, repl, html, flags=re.S)
    with open('src/index.html', 'w') as fh:
        fh.write(html)
    subdomain = data['subdomain']
    dest = os.path.join('host', subdomain)
    os.makedirs(os.path.join(dest, 'from_client'), exist_ok=True)
    shutil.copy(config_path, os.path.join(dest, 'config.json'))
    for fname in ['index.html', 'nostr.html', 'qrcode-content.png', 'qrcode-tear-offs.png', 'example.pdf', 'submission_form.pdf']:
        shutil.copy(os.path.join('src', fname), dest)
    if pdf_path:
        shutil.copy(pdf_path, os.path.join(dest, 'from_client', 'submission_form.pdf'))
    print(f"Flyer files created under {dest}")


def serve(config_path: str):
    if not require_cmd('onionshare-cli'):
        sys.exit(1)
    subdomain = load_config(config_path)['subdomain']
    dir_path = os.path.abspath(os.path.join('host', subdomain))
    if not os.path.isdir(dir_path):
        print(f"Directory {dir_path} not found", file=sys.stderr)
        sys.exit(1)
    logfile = os.path.join(dir_path, 'onionshare.log')
    proc = subprocess.Popen(['onionshare-cli', '--website', '--public', '--persistent', f'{dir_path}/.onionshare-session', dir_path], stdout=open(logfile, 'w'), stderr=subprocess.STDOUT)
    try:
        import time, re as _re
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
        data = load_config(os.path.join(dir_path, 'config.json'))
        data['url'] = onion_url
        data['tear_off_link'] = onion_url
        save_config(data, os.path.join(dir_path, 'config.json'))
        # regenerate assets
        build_assets(os.path.join(dir_path, 'config.json'))
        print(f"OnionShare running (PID {proc.pid}). See {logfile} for details.")
    except KeyboardInterrupt:
        pass


def import_configs():
    import glob
    files = sorted(glob.glob('imports/*.json'))
    if not files:
        print('No JSON files found in imports')
        return
    for json_file in files:
        print(f'Processing {json_file}')
        dest_config = 'src/config.json'
        shutil.copy(json_file, dest_config)
        subdomain = load_config(json_file)['subdomain']
        shutil.rmtree(os.path.join('host', subdomain), ignore_errors=True)
        build_assets(dest_config)


def main(argv=None):
    parser = argparse.ArgumentParser(prog='voxvera')
    parser.add_argument('--config', default='src/config.json', help='Path to config.json')
    sub = parser.add_subparsers(dest='command')

    p_init = sub.add_parser('init', help='Update configuration interactively or from PDF')
    p_init.add_argument('--from-pdf')
    p_init.add_argument('--non-interactive', action='store_true')

    p_build = sub.add_parser('build', help='Build flyer assets from config')
    p_build.add_argument('--pdf')

    sub.add_parser('import', help='Batch import JSON files from imports/')
    sub.add_parser('serve', help='Serve flyer over OnionShare using config')
    sub.add_parser('quickstart', help='Init, build and serve in sequence')

    args = parser.parse_args(argv)
    config_path = os.path.abspath(args.config)

    if args.command == 'init':
        if args.from_pdf:
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
