import os
import sys
import shutil
import json
import zipfile
import time
import socket
from pathlib import Path
import pytest
from voxvera import cli

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def _setup_tmp(monkeypatch, tmp_path):
    repo_root = Path(__file__).resolve().parent.parent
    shutil.copytree(repo_root / "voxvera" / "src", tmp_path / "src")
    shutil.copytree(repo_root / "voxvera" / "locales", tmp_path / "locales")
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    monkeypatch.setattr(cli, "_src_res", lambda *p: tmp_path / "src" / Path(*p))
    monkeypatch.setattr(cli, "_locale_res", lambda *p: tmp_path / "locales" / Path(*p))
    return repo_root


def test_help(capsys):
    with pytest.raises(SystemExit):
        cli.main(["-h"])
    captured = capsys.readouterr()
    assert "usage:" in captured.out


def test_init_template(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    # Mock choose_language to return 'en'
    monkeypatch.setattr(cli, "choose_language", lambda *a: "en")
    cli.main(["init", "--template", "voxvera"])
    dest = tmp_path / "host" / "voxvera"
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
    dest = tmp_path / "host" / "voxvera" / "download" / "extra-content.zip"
    assert dest.is_file()


def test_import(tmp_path, monkeypatch):
    repo = _setup_tmp(monkeypatch, tmp_path)
    imports_dir = tmp_path / "imports"
    imports_dir.mkdir()
    base_data = json.load(open(repo / "imports" / "example.json"))
    for sub in ["foo", "bar"]:
        data = dict(base_data)
        data["folder_name"] = sub
        with open(imports_dir / f"{sub}.json", "w") as fh:
            json.dump(data, fh)
    cli.main(["batch-import"])
    for sub in ["foo", "bar"]:
        dest = tmp_path / "host" / sub
        assert dest.is_dir()
        assert (dest / "index.html").exists()


def test_import_preserves_session(tmp_path, monkeypatch):
    """Re-importing a config must not destroy the OnionShare session key."""
    repo = _setup_tmp(monkeypatch, tmp_path)
    imports_dir = tmp_path / "imports"
    imports_dir.mkdir()
    base_data = json.load(open(repo / "imports" / "example.json"))
    base_data["folder_name"] = "keep"
    with open(imports_dir / "keep.json", "w") as fh:
        json.dump(base_data, fh)

    # first import creates the host dir
    cli.main(["batch-import"])
    host_dir = tmp_path / "host" / "keep"
    assert host_dir.is_dir()

    # simulate OnionShare having written a session key
    session_file = host_dir / ".onionshare-session"
    session_file.write_text("FAKE-KEY-DATA")

    # re-import the same config
    cli.main(["batch-import"])

    # session key must still be present and unchanged
    assert session_file.exists()
    assert session_file.read_text() == "FAKE-KEY-DATA"
    # built assets should still be there too
    assert (host_dir / "index.html").exists()


def test_check_all_present(capsys, monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda cmd: "/usr/bin/" + cmd)
    cli.main(["check"])
    captured = capsys.readouterr()
    assert "All dependencies are installed." in captured.out


def test_check_missing(capsys, monkeypatch):
    import builtins
    original_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "onionshare_cli":
            raise ImportError("Mocked missing")
        return original_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    cli.main(["check"])
    captured = capsys.readouterr()
    assert "onionshare-cli" in captured.out
    assert "missing" in captured.out


def test_build_download_zip(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    config = json.load(open(tmp_path / "src" / "config.json"))
    folder_name = config["folder_name"]
    zip_path = tmp_path / "file.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("dummy.txt", "data")
    cli.main(["build", "--download", str(zip_path)])
    dest = tmp_path / "host" / folder_name / "download" / "extra-content.zip"
    assert dest.is_file()


def test_serve_updates_url(tmp_path, monkeypatch):
    """Test that serve() auto-generates onion URL for tear-off links."""
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    config = json.load(open(tmp_path / "src" / "config.json"))
    folder_name = config["folder_name"]
    dir_path = tmp_path / "host" / folder_name

    # Set a custom URL that should be preserved (content link)
    config["url"] = "https://example.com/external-resource"
    with open(dir_path / "config.json", "w") as f:
        json.dump(config, f)

    # No need for TOR_* env vars anymore - auto-detection should work
    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    orig_build = cli.build_assets

    def safe_build_assets(cfg, download_path=None):
        dest = cli.ROOT / "host" / json.load(open(cfg))["folder_name"] / "config.json"
        if Path(cfg) == dest:
            return
        return orig_build(cfg, download_path=download_path)

    monkeypatch.setattr(cli, "build_assets", safe_build_assets)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    onion_url = "http://test123.onion"

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None, env=None):
            self.cmd = cmd
            self.stdout = stdout
            self.stderr = stderr
            self.env = env
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
    # URL should be preserved (user-configurable content link)
    assert updated["url"] == "https://example.com/external-resource"
    # tear_off_link should be set to the onion address (for tear-off tabs)
    assert updated["tear_off_link"] == onion_url


def test_quickstart_noninteractive(tmp_path, monkeypatch):
    """Test quickstart auto-generates onion URL for tear-off links."""
    _setup_tmp(monkeypatch, tmp_path)
    config = json.load(open(tmp_path / "src" / "config.json"))
    folder_name = config["folder_name"]

    # No need for TOR_* env vars anymore - auto-detection should work
    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    orig_build = cli.build_assets

    def safe_build_assets(cfg, download_path=None):
        dest = cli.ROOT / "host" / json.load(open(cfg))["folder_name"] / "config.json"
        if Path(cfg) == dest:
            return
        return orig_build(cfg, download_path=download_path)

    monkeypatch.setattr(cli, "build_assets", safe_build_assets)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    onion_url = "http://quick.onion"

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None, env=None):
            self.cmd = cmd
            self.stdout = stdout
            self.stderr = stderr
            self.env = env
            self.pid = 99
            if stdout is not None:
                stdout.write(f"URL: {onion_url}\n")
                stdout.flush()

        def poll(self):
            return None

    monkeypatch.setattr(cli.subprocess, "Popen", FakePopen)

    monkeypatch.setattr(cli, "choose_language", lambda *a: "en")
    cli.main(["quickstart", "--non-interactive"])

    dir_path = tmp_path / "host" / folder_name
    assert (dir_path / "index.html").exists()
    log_file = dir_path / "onionshare.log"
    assert onion_url in log_file.read_text()
    updated = json.load(open(dir_path / "config.json"))
    # tear_off_link should be set to onion address (for tear-off tabs)
    assert updated["tear_off_link"] == onion_url
    # url should be preserved (user-configured content link)


def test_get_tor_ports_with_env_vars(monkeypatch):
    """Test that get_tor_ports respects environment variables."""
    monkeypatch.setenv("TOR_SOCKS_PORT", "9999")
    monkeypatch.setenv("TOR_CONTROL_PORT", "8888")
    socks, ctl = cli.get_tor_ports()
    assert socks == "9999"
    assert ctl == "8888"


def test_get_tor_ports_auto_detect_defaults(monkeypatch):
    """Test that get_tor_ports returns defaults when no env vars and no Tor running."""
    monkeypatch.delenv("TOR_SOCKS_PORT", raising=False)
    monkeypatch.delenv("TOR_CONTROL_PORT", raising=False)

    # Mock socket to always fail connection so it falls back to defaults
    class MockSocket:
        def __init__(self, *args, **kwargs):
            pass

        def settimeout(self, *args, **kwargs):
            pass

        def connect_ex(self, *args, **kwargs):
            return 1  # 1 is a failure code

        def close(self):
            pass

    monkeypatch.setattr(socket, "socket", MockSocket)

    # Don't actually start Tor, so detection will fail and fall back to defaults
    socks, ctl = cli.get_tor_ports()
    assert socks == "9050"  # Default SOCKS port
    assert ctl == "9051"  # Default control port


def test_build_without_url_skips_qr(tmp_path, monkeypatch, capsys):
    """Test that build works even without URLs configured initially."""
    _setup_tmp(monkeypatch, tmp_path)

    # Remove URLs from config
    config = json.load(open(tmp_path / "src" / "config.json"))
    config["url"] = ""
    config["tear_off_link"] = ""
    with open(tmp_path / "src" / "config.json", "w") as f:
        json.dump(config, f)

    # Remove any existing QR files from src to test fresh generation
    for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
        qr_path = tmp_path / "src" / qr_file
        if qr_path.exists():
            qr_path.unlink()

    # Build should complete without error, just skip QR generation
    cli.main(["build"])

    dest = tmp_path / "host" / config["folder_name"]
    assert dest.is_dir()
    assert (dest / "config.json").exists()
    assert (dest / "index.html").exists()
    # QR codes should not exist since no URLs were provided
    assert not (dest / "qrcode-content.png").exists()
    assert not (dest / "qrcode-tear-offs.png").exists()


def test_build_with_only_url(tmp_path, monkeypatch):
    """Test that QR codes work when only url (content link) is set."""
    _setup_tmp(monkeypatch, tmp_path)

    # Set only url (content link)
    config = json.load(open(tmp_path / "src" / "config.json"))
    config["url"] = "https://example.com/external-resource"
    config["tear_off_link"] = ""
    with open(tmp_path / "src" / "config.json", "w") as f:
        json.dump(config, f)

    # Remove any existing QR files from src to test fresh generation
    for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
        qr_path = tmp_path / "src" / qr_file
        if qr_path.exists():
            qr_path.unlink()

    cli.main(["build"])

    dest = tmp_path / "host" / config["folder_name"]
    # Only content QR should exist (tear-off will be set by serve)
    assert (dest / "qrcode-content.png").exists()
    assert not (dest / "qrcode-tear-offs.png").exists()


def test_build_with_only_tear_off_link(tmp_path, monkeypatch):
    """Test that QR codes work when only tear_off_link is set (pre-serve)."""
    _setup_tmp(monkeypatch, tmp_path)

    # Set only tear_off_link (before serve sets it to onion)
    config = json.load(open(tmp_path / "src" / "config.json"))
    config["url"] = ""
    config["tear_off_link"] = "http://preconfigured.onion"
    with open(tmp_path / "src" / "config.json", "w") as f:
        json.dump(config, f)

    # Remove any existing QR files from src to test fresh generation
    for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
        qr_path = tmp_path / "src" / qr_file
        if qr_path.exists():
            qr_path.unlink()

    cli.main(["build"])

    dest = tmp_path / "host" / config["folder_name"]
    # Only tear-off QR should exist (will be updated by serve)
    assert not (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()


def test_serve_passes_tor_ports_to_env(monkeypatch, tmp_path):
    """Test that serve() passes detected Tor ports via env to subprocess."""
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])

    captured_env = {}

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None, env=None):
            self.cmd = cmd
            self.stdout = stdout
            self.stderr = stderr
            self.pid = 42
            captured_env.update(env or {})
            if stdout is not None:
                stdout.write("Started at http://test.onion\n")
                stdout.flush()

        def poll(self):
            return None

    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    monkeypatch.setattr(cli.subprocess, "Popen", FakePopen)
    monkeypatch.setattr(cli, "build_assets", lambda *a, **kw: None)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    # Test with custom env vars
    monkeypatch.setenv("TOR_SOCKS_PORT", "1111")
    monkeypatch.setenv("TOR_CONTROL_PORT", "2222")

    cli.main(["serve"])

    assert captured_env.get("TOR_SOCKS_PORT") == "1111"
    assert captured_env.get("TOR_CONTROL_PORT") == "2222"


def test_backward_compatibility_with_https_config(tmp_path, monkeypatch):
    """Test that old configs with https URLs still work for building."""
    _setup_tmp(monkeypatch, tmp_path)

    # Simulate old config with HTTPS URLs
    config = json.load(open(tmp_path / "src" / "config.json"))
    config["url"] = "https://example.com/old-style"
    config["tear_off_link"] = "https://example.com/tear-off"
    with open(tmp_path / "src" / "config.json", "w") as f:
        json.dump(config, f)

    cli.main(["build"])

    dest = tmp_path / "host" / config["folder_name"]
    assert (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()


def test_long_urls_in_qr(tmp_path, monkeypatch):
    """Test that long URLs still generate valid QR codes."""
    _setup_tmp(monkeypatch, tmp_path)

    config = json.load(open(tmp_path / "src" / "config.json"))
    # Very long URL (close to 200 char limit)
    config["url"] = "http://" + "a" * 190 + ".onion"
    config["tear_off_link"] = "https://example.com/" + "path/" * 20
    with open(tmp_path / "src" / "config.json", "w") as f:
        json.dump(config, f)

    cli.main(["build"])

    dest = tmp_path / "host" / config["folder_name"]
    assert (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()
