
import os
import sys
import shutil
import json
import datetime
from pathlib import Path
import zipfile
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from voxvera import cli


def _setup_tmp(monkeypatch, tmp_path):
    repo_root = Path(__file__).resolve().parent.parent
    shutil.copytree(repo_root / "voxvera" / "src", tmp_path / "src")
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    monkeypatch.setattr(cli, "_src_res", lambda *p: tmp_path / "src" / Path(*p))
    monkeypatch.setattr(cli, "run", lambda *a, **k: None)
    return repo_root


def test_help(capsys):
    with pytest.raises(SystemExit):
        cli.main(["-h"])
    captured = capsys.readouterr()
    assert "usage:" in captured.out


def test_init_template(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["init", "--template", "voxvera"])
    date = datetime.date.today().strftime("%Y%m%d")
    dest = tmp_path / "dist" / f"voxvera-{date}"
    assert dest.is_dir()
    assert (dest / "config.json").exists()
    assert (dest / "index.html").exists()
    # new download directory should be copied as well
    assert (dest / "download").is_dir()


def test_build(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    dest = tmp_path / "host" / "voxvera"
    assert dest.is_dir()
    assert (dest / "config.json").exists()
    assert (dest / "index.html").exists()


def test_build_with_download(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    download_file = tmp_path / "sample.zip"
    download_file.write_text("dummy")
    cli.main(["build", "--download", str(download_file)])
    dest = tmp_path / "host" / "voxvera" / "download" / "download.zip"
    assert dest.is_file()


def test_import(tmp_path, monkeypatch):
    repo = _setup_tmp(monkeypatch, tmp_path)
    imports_dir = tmp_path / "imports"
    imports_dir.mkdir()
    base_data = json.load(open(repo / "imports" / "example.json"))
    for sub in ["foo", "bar"]:
        data = dict(base_data)
        data["subdomain"] = sub
        with open(imports_dir / f"{sub}.json", "w") as fh:
            json.dump(data, fh)
    cli.main(["import"])
    for sub in ["foo", "bar"]:
        dest = tmp_path / "host" / sub
        assert dest.is_dir()
        assert (dest / "index.html").exists()


def test_check_all_present(capsys, monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda cmd: "/usr/bin/" + cmd)
    cli.main(["check"])
    captured = capsys.readouterr()
    assert "All required tools are installed." in captured.out


def test_check_missing(capsys, monkeypatch):
    def fake_which(cmd):
        return None if cmd == "node" else "/usr/bin/" + cmd

    monkeypatch.setattr(shutil, "which", fake_which)
    cli.main(["check"])
    captured = capsys.readouterr()
    assert "node: missing" in captured.out


def test_build_download_zip(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    config = json.load(open(tmp_path / "src" / "config.json"))
    subdomain = config["subdomain"]
    zip_path = tmp_path / "file.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("dummy.txt", "data")
    cli.main(["build", "--download", str(zip_path)])
    dest = tmp_path / "host" / subdomain / "download" / "download.zip"
    assert dest.is_file()


def test_serve_updates_url(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    config = json.load(open(tmp_path / "src" / "config.json"))
    subdomain = config["subdomain"]
    dir_path = tmp_path / "host" / subdomain

    monkeypatch.setenv("TOR_SOCKS_PORT", "9050")
    monkeypatch.setenv("TOR_CONTROL_PORT", "9051")
    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    orig_build = cli.build_assets
    def safe_build_assets(cfg, pdf_path=None, download_path=None):
        dest = cli.ROOT / 'host' / json.load(open(cfg))["subdomain"] / 'config.json'
        if Path(cfg) == dest:
            return
        return orig_build(cfg, pdf_path=pdf_path, download_path=download_path)
    monkeypatch.setattr(cli, "build_assets", safe_build_assets)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    onion_url = "http://test123.onion"

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None):
            self.cmd = cmd
            self.stdout = stdout
            self.stderr = stderr
            self.pid = 42
            if stdout is not None:
                stdout.write(f"Started at {onion_url}\n")
                stdout.flush()

        def poll(self):
            return None

    monkeypatch.setattr(cli.subprocess, "Popen", FakePopen)

    cli.main(["serve"])

    log_file = dir_path / "onionshare.log"
    assert onion_url in log_file.read_text()
    updated = json.load(open(dir_path / "config.json"))
    assert updated["url"] == onion_url
    assert updated["tear_off_link"] == onion_url


def test_quickstart_noninteractive(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    config = json.load(open(tmp_path / "src" / "config.json"))
    subdomain = config["subdomain"]

    monkeypatch.setenv("TOR_SOCKS_PORT", "9050")
    monkeypatch.setenv("TOR_CONTROL_PORT", "9051")
    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    orig_build = cli.build_assets
    def safe_build_assets(cfg, pdf_path=None, download_path=None):
        dest = cli.ROOT / 'host' / json.load(open(cfg))["subdomain"] / 'config.json'
        if Path(cfg) == dest:
            return
        return orig_build(cfg, pdf_path=pdf_path, download_path=download_path)
    monkeypatch.setattr(cli, "build_assets", safe_build_assets)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    onion_url = "http://quick.onion"

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None):
            self.cmd = cmd
            self.stdout = stdout
            self.stderr = stderr
            self.pid = 99
            if stdout is not None:
                stdout.write(f"URL: {onion_url}\n")
                stdout.flush()

        def poll(self):
            return None

    monkeypatch.setattr(cli.subprocess, "Popen", FakePopen)

    cli.main(["quickstart", "--non-interactive"])

    dir_path = tmp_path / "host" / subdomain
    assert (dir_path / "index.html").exists()
    log_file = dir_path / "onionshare.log"
    assert onion_url in log_file.read_text()
    updated = json.load(open(dir_path / "config.json"))
    assert updated["url"] == onion_url
    assert updated["tear_off_link"] == onion_url

