
import os
import sys
import shutil
import json
import datetime
from pathlib import Path
import zipfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from voxvera import cli


def _setup_tmp(monkeypatch, tmp_path):
    repo_root = Path(__file__).resolve().parent.parent
    shutil.copytree(repo_root / "src", tmp_path / "src")
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
