import os
import sys
import shutil
import json
import zipfile
import time
import socket
import platform
from pathlib import Path
import pytest
from voxvera import cli
from voxvera.platforms import get_platform_adapter
from voxvera.platforms import base as platform_base
from voxvera.platforms import linux as platform_linux
from voxvera.platforms import macos as platform_macos
from voxvera.platforms import windows as platform_windows
from voxvera.platforms import docker as platform_docker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def _setup_tmp(monkeypatch, tmp_path):
    repo_root = Path(__file__).resolve().parent.parent
    
    # Use a unique subdirectory for this test run to ensure isolation
    test_data_dir = tmp_path / "data"
    test_data_dir.mkdir(exist_ok=True)
    
    # Internal resources (ROOT)
    res_root = test_data_dir / "voxvera"
    res_root.mkdir()
    shutil.copytree(repo_root / "voxvera" / "src", res_root / "src")
    shutil.copytree(repo_root / "voxvera" / "locales", res_root / "locales")
    shutil.copytree(repo_root / "voxvera" / "templates", res_root / "templates")
    shutil.copy(repo_root / "support-matrix.json", test_data_dir / "support-matrix.json")
    
    monkeypatch.setattr(cli, "ROOT", res_root)
    monkeypatch.setattr(cli, "DATA_DIR", test_data_dir)
    monkeypatch.setattr(cli, "_src_res", lambda *p: res_root / "src" / Path(*p))
    monkeypatch.setattr(cli, "_locale_res", lambda *p: res_root / "locales" / Path(*p))
    monkeypatch.setattr(cli, "_template_res", lambda *p: res_root / "templates" / Path(*p))
    
    # Create a default config.json in DATA_DIR
    shutil.copy(res_root / "src" / "config.json", test_data_dir / "config.json")
    return repo_root


def test_help(capsys):
    with pytest.raises(SystemExit):
        cli.main(["-h"])
    captured = capsys.readouterr()
    assert "usage:" in captured.out


def test_get_platform_adapter_linux(monkeypatch):
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.delenv("VOXVERA_RUNTIME", raising=False)
    monkeypatch.setattr(platform_docker.DockerPlatformAdapter, "is_container_runtime", lambda self: False)
    adapter = get_platform_adapter(cli_module=cli)
    assert adapter.platform_id == "linux_cli_systemd"


def test_get_platform_adapter_docker(monkeypatch):
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setenv("VOXVERA_RUNTIME", "docker")
    monkeypatch.setattr(platform_docker.DockerPlatformAdapter, "is_container_runtime", lambda self: True)
    adapter = get_platform_adapter(cli_module=cli)
    assert adapter.platform_id == "docker_cli"


def test_get_platform_adapter_macos(monkeypatch):
    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    adapter = get_platform_adapter(cli_module=cli)
    assert adapter.platform_id == "macos_cli"


def test_get_platform_adapter_windows(monkeypatch):
    monkeypatch.setattr(platform, "system", lambda: "Windows")
    adapter = get_platform_adapter(cli_module=cli)
    assert adapter.platform_id == "windows_cli"


def test_init_template(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    # Mock choose_language to return 'en'
    monkeypatch.setattr(cli, "choose_language", lambda *a: "en")
    cli.main(["init", "--template", "voxvera"])
    dest = test_data_dir / "host" / "voxvera"
    assert dest.is_dir()
    assert (dest / "config.json").exists()
    assert (dest / "index.html").exists()


def test_init_seeds_missing_default_config(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    config_path = test_data_dir / "fresh-config.json"
    answers = iter([
        "Fresh Site",
        "freshsite",
        "Fresh Title",
        "Fresh Subtitle",
        "Fresh Headline",
        "https://example.com",
        "Read more",
        "Footer bits",
        "",
    ])

    monkeypatch.setattr(cli, "choose_language", lambda *a: "en")
    monkeypatch.setattr(cli, "prompt", lambda questions: {question["name"]: next(answers) for question in questions})
    monkeypatch.setattr(cli, "open_editor", lambda initial: "Fresh content")

    class _Confirm:
        def execute(self):
            return False

    monkeypatch.setattr(cli.inquirer, "confirm", lambda **kwargs: _Confirm())

    cli.main(["--config", str(config_path), "init"])

    assert config_path.exists()
    saved = cli.load_config(config_path)
    assert saved["folder_name"] == "freshsite"
    assert saved["content"] == "Fresh content"


def test_init_noninteractive_does_not_prompt_for_language(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    config_path = test_data_dir / "fresh-config.json"

    def _fail_choose_language(*args, **kwargs):
        raise AssertionError("choose_language should not run for non-interactive init")

    monkeypatch.setattr(cli, "choose_language", _fail_choose_language)

    cli.main(["--config", str(config_path), "init", "--non-interactive"])

    saved = cli.load_config(config_path)
    assert saved["lang"] == "en"
    assert (test_data_dir / "host" / saved["folder_name"] / "index.html").exists()


def test_create_from_template_persists_current_language(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    cli.load_locale("es")

    class _Prompt:
        def execute(self):
            return cli.list_presets()[0]

    monkeypatch.setattr(cli.inquirer, "select", lambda **kwargs: _Prompt())
    monkeypatch.setattr(cli, "interactive_update", lambda path: None)
    monkeypatch.setattr(cli, "resolve_new_site_folder", lambda path: cli.load_config(path)["folder_name"])
    monkeypatch.setattr(cli, "build_assets", lambda path: None)
    monkeypatch.setattr(cli, "serve", lambda path: None)

    cli.create_from_template(None)

    config = cli.load_config(tmp_path / "data" / "config.json")
    assert config["lang"] == "es"


def test_resolve_new_site_folder_versions_existing_folder(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    host_dir = test_data_dir / "host"
    existing_dir = host_dir / "jesus"
    existing_dir.mkdir(parents=True)
    (existing_dir / "config.json").write_text(json.dumps({"folder_name": "jesus"}), encoding="utf-8")

    config_path = test_data_dir / "config.json"
    config_path.write_text(json.dumps({"folder_name": "jesus"}), encoding="utf-8")

    class _Prompt:
        def execute(self):
            return "version"

    monkeypatch.setattr(cli.inquirer, "select", lambda **kwargs: _Prompt())

    resolved = cli.resolve_new_site_folder(str(config_path))
    updated = cli.load_config(config_path)

    assert resolved == "jesus_01"
    assert updated["folder_name"] == "jesus_01"


def test_build(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / "voxvera"
    assert dest.is_dir()
    assert (dest / "config.json").exists()
    assert (dest / "index.html").exists()


def test_build_with_download(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    download_file = tmp_path / "sample.zip"
    download_file.write_text("dummy")
    cli.main(["build", "--download", str(download_file)])
    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / "voxvera" / "download" / "extra-content.zip"
    assert dest.is_file()


def test_build_generates_tear_off_qr_from_url_when_onion_missing(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    config_path = test_data_dir / "config.json"
    config = cli.load_config(config_path)
    config["url"] = "https://example.com/learn-more"
    config["tear_off_link"] = ""
    cli.save_config(config, config_path)

    cli.build_assets(str(config_path))

    dest = test_data_dir / "host" / config["folder_name"]
    html = (dest / "index.html").read_text(encoding="utf-8")

    assert (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()
    assert 'class="container no-tear-offs"' not in html
    assert "https://example.com/learn-more" in html


def test_import(tmp_path, monkeypatch):
    repo = _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    imports_dir = test_data_dir / "imports"
    imports_dir.mkdir(parents=True, exist_ok=True)
    base_data = json.load(open(repo / "imports" / "example.json"))
    for sub in ["foo", "bar"]:
        data = dict(base_data)
        data["folder_name"] = sub
        with open(imports_dir / f"{sub}.json", "w") as fh:
            json.dump(data, fh)
    cli.main(["batch-import"])
    for sub in ["foo", "bar"]:
        test_data_dir = tmp_path / "data"
        dest = test_data_dir / "host" / sub
        assert dest.is_dir()
        assert (dest / "index.html").exists()


def test_import_preserves_session(tmp_path, monkeypatch):
    """Re-importing a config must not destroy the OnionShare session key."""
    repo = _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    imports_dir = test_data_dir / "imports"
    imports_dir.mkdir(parents=True, exist_ok=True)
    base_data = json.load(open(repo / "imports" / "example.json"))
    base_data["folder_name"] = "keep"
    with open(imports_dir / "keep.json", "w") as fh:
        json.dump(base_data, fh)

    # first import creates the host dir
    cli.main(["batch-import"])
    test_data_dir = tmp_path / "data"
    host_dir = test_data_dir / "host" / "keep"
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


def test_import_rejects_zip_path_traversal(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    malicious_zip = tmp_path / "malicious.zip"
    with zipfile.ZipFile(malicious_zip, "w") as zf:
        zf.writestr("../escape.txt", "owned")
        zf.writestr("config.json", json.dumps({"folder_name": "evil"}))

    cli.import_site(str(malicious_zip))

    captured = capsys.readouterr()
    assert "Refusing to extract path outside destination" in captured.out
    assert not (tmp_path / "escape.txt").exists()
    assert not ((tmp_path / "data" / "host" / "evil").exists())


def test_load_config_migrates_binary_message_to_footer_message(tmp_path):
    config_path = tmp_path / "legacy-config.json"
    config_path.write_text(json.dumps({"binary_message": "0101", "folder_name": "legacy"}), encoding="utf-8")

    loaded = cli.load_config(str(config_path))

    assert loaded["footer_message"] == "0101"
    assert "binary_message" not in loaded


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


def test_doctor_command_outputs_platform_report(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(shutil, "which", lambda cmd: f"/usr/bin/{cmd}" if cmd in {"voxvera", "tor", "onionshare-cli", "systemctl"} else None)

    class FakeSocket:
        def settimeout(self, value):
            return None

        def connect_ex(self, addr):
            return 0

        def close(self):
            return None

    def fake_check_output(args, stderr=None):
        if "is-enabled" in args:
            return b"enabled"
        if "is-active" in args:
            return b"active"
        raise AssertionError(args)

    monkeypatch.setattr(platform_linux.socket, "socket", lambda *args, **kwargs: FakeSocket())
    monkeypatch.setattr(platform_base.subprocess, "check_output", fake_check_output)
    cli.main(["doctor"])
    captured = capsys.readouterr()
    assert "VoxVera Doctor" in captured.out
    assert "linux_cli_systemd" in captured.out


def test_doctor_json_output(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(shutil, "which", lambda cmd: f"/usr/bin/{cmd}" if cmd in {"voxvera", "tor", "onionshare-cli"} else None)

    class FakeSocket:
        def settimeout(self, value):
            return None

        def connect_ex(self, addr):
            return 0

        def close(self):
            return None

    monkeypatch.setattr(platform_linux.socket, "socket", lambda *args, **kwargs: FakeSocket())
    monkeypatch.setattr(platform_base.subprocess, "check_output", lambda *args, **kwargs: b"disabled")

    cli.main(["doctor", "--json"])
    captured = capsys.readouterr()
    report = json.loads(captured.out)
    assert report["platform_id"] == "linux_cli_systemd"
    assert "summary" in report
    assert "sections" in report
    assert "dependencies" in report["sections"]
    assert "checks" in report


def test_platform_status_json_output(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    monkeypatch.setattr(platform, "system", lambda: "Linux")

    cli.main(["platform-status", "--json"])
    captured = capsys.readouterr()
    report = json.loads(captured.out)
    assert report["platform_id"] == "linux_cli_systemd"
    assert report["hosting_model"]
    assert "checks" not in report


def test_autostart_status_command_outputs_timer_state(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    fake_home = tmp_path / "home"
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(platform_base.Path, "home", lambda: fake_home)
    systemd_dir = fake_home / ".config" / "systemd" / "user"
    systemd_dir.mkdir(parents=True, exist_ok=True)
    (systemd_dir / "voxvera-start.service").write_text("service", encoding="utf-8")
    (systemd_dir / "voxvera-start.timer").write_text("timer", encoding="utf-8")

    def fake_check_output(args, stderr=None):
        if "is-enabled" in args:
            return b"enabled"
        if "is-active" in args:
            return b"active"
        raise AssertionError(args)

    monkeypatch.setattr(shutil, "which", lambda cmd: f"/usr/bin/{cmd}" if cmd == "systemctl" else None)
    monkeypatch.setattr(platform_base.subprocess, "check_output", fake_check_output)

    cli.main(["autostart", "status"])
    captured = capsys.readouterr()
    assert "Autostart Status" in captured.out
    assert "systemd_timer_enabled" in captured.out


def test_autostart_status_json_output(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    fake_home = tmp_path / "home"
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(platform_base.Path, "home", lambda: fake_home)
    systemd_dir = fake_home / ".config" / "systemd" / "user"
    systemd_dir.mkdir(parents=True, exist_ok=True)
    (systemd_dir / "voxvera-start.service").write_text("service", encoding="utf-8")
    (systemd_dir / "voxvera-start.timer").write_text("timer", encoding="utf-8")
    monkeypatch.setattr(shutil, "which", lambda cmd: f"/usr/bin/{cmd}" if cmd == "systemctl" else None)
    monkeypatch.setattr(platform_base.subprocess, "check_output", lambda *args, **kwargs: b"enabled")

    cli.main(["autostart", "status", "--json"])
    captured = capsys.readouterr()
    status = json.loads(captured.out)
    assert status["platform_id"] == "linux_cli_systemd"
    assert len(status["artifacts"]) == 2


def test_linux_autostart_uninstall_removes_artifacts(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    fake_home = tmp_path / "home"
    commands = []
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(platform_linux.Path, "home", lambda: fake_home)
    monkeypatch.setattr(platform_linux.subprocess, "run", lambda args, **kwargs: commands.append(args))
    systemd_dir = fake_home / ".config" / "systemd" / "user"
    systemd_dir.mkdir(parents=True, exist_ok=True)
    service = systemd_dir / "voxvera-start.service"
    timer = systemd_dir / "voxvera-start.timer"
    service.write_text("service", encoding="utf-8")
    timer.write_text("timer", encoding="utf-8")

    cli.main(["autostart", "uninstall"])
    captured = capsys.readouterr()

    assert "Removed systemd user service" in captured.out
    assert not service.exists()
    assert not timer.exists()
    assert ["systemctl", "--user", "disable", "--now", "voxvera-start.timer"] in commands


def test_macos_autostart_status_and_render(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    fake_home = tmp_path / "home"
    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    monkeypatch.setattr(platform_base.Path, "home", lambda: fake_home)

    adapter = get_platform_adapter(cli_module=cli)
    assert adapter.platform_id == "macos_cli"

    plist = adapter.render_launchd_plist("/tmp/voxvera")
    assert "org.voxvera.start-all" in plist
    assert "<string>/tmp/voxvera</string>" in plist
    assert "start-all" in plist

    status = adapter.autostart_status()
    assert status["platform_id"] == "macos_cli"
    assert status["artifacts"] == [str(fake_home / "Library" / "LaunchAgents" / "org.voxvera.start-all.plist")]
    assert any(check["name"] == "launchd_loaded" for check in status["checks"])


def test_macos_autostart_uninstall_removes_plist(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    fake_home = tmp_path / "home"
    commands = []
    monkeypatch.setattr(platform, "system", lambda: "Darwin")
    monkeypatch.setattr(platform_base.Path, "home", lambda: fake_home)
    monkeypatch.setattr(platform_base.subprocess, "check_output", lambda args, stderr=None: commands.append(args) or b"")
    plist = fake_home / "Library" / "LaunchAgents" / "org.voxvera.start-all.plist"
    plist.parent.mkdir(parents=True, exist_ok=True)
    plist.write_text("plist", encoding="utf-8")

    cli.main(["autostart", "uninstall"])
    captured = capsys.readouterr()

    assert "Removed LaunchAgent" in captured.out
    assert not plist.exists()
    assert ["launchctl", "unload", str(plist)] in commands


def test_windows_autostart_status_and_render(monkeypatch):
    monkeypatch.setattr(platform, "system", lambda: "Windows")
    monkeypatch.setattr(platform_base.subprocess, "check_output", lambda *args, **kwargs: b"TaskName: VoxVera Start All")

    adapter = get_platform_adapter(cli_module=cli)
    assert adapter.platform_id == "windows_cli"

    command = adapter.render_schtasks_create_command("C:\\voxvera.exe")
    assert command[:6] == ["schtasks", "/Create", "/F", "/SC", "ONLOGON", "/TN"]
    assert "VoxVera Start All" in command
    assert '"C:\\voxvera.exe" start-all' in command

    status = adapter.autostart_status()
    assert status["platform_id"] == "windows_cli"
    assert any(check["name"] == "scheduled_task_present" for check in status["checks"])


def test_windows_autostart_uninstall_uses_schtasks(monkeypatch, capsys):
    commands = []
    monkeypatch.setattr(platform, "system", lambda: "Windows")
    monkeypatch.setattr(platform_base.subprocess, "check_output", lambda args, stderr=None: commands.append(args) or b"SUCCESS")

    cli.main(["autostart", "uninstall"])
    captured = capsys.readouterr()

    assert "removed" in captured.out.lower()
    assert ["schtasks", "/Delete", "/TN", "VoxVera Start All", "/F"] in commands


def test_build_download_zip(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    folder_name = config["folder_name"]
    zip_path = tmp_path / "file.zip"
    with zipfile.ZipFile(zip_path, "w") as zf:
        zf.writestr("dummy.txt", "data")
    cli.main(["build", "--download", str(zip_path)])
    dest = test_data_dir / "host" / folder_name / "download" / "extra-content.zip"
    assert dest.is_file()


def test_serve_updates_url(tmp_path, monkeypatch):
    """Test that serve() auto-generates onion URL for tear-off links."""
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    folder_name = config["folder_name"]
    dir_path = test_data_dir / "host" / folder_name

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
        def __init__(self, cmd, stdout=None, stderr=None, env=None, **kwargs):
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


def test_serve_recovers_onion_url_from_session_file(tmp_path, monkeypatch):
    """OnionShare 2.6 may not log the URL when using system Tor."""
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    folder_name = config["folder_name"]
    dir_path = test_data_dir / "host" / folder_name

    (dir_path / ".onionshare-session").write_text(
        json.dumps({"general": {"service_id": "sessionserviceid"}}),
        encoding="utf-8",
    )

    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    orig_build = cli.build_assets

    def safe_build_assets(cfg, download_path=None):
        dest = cli.ROOT / "host" / json.load(open(cfg))["folder_name"] / "config.json"
        if Path(cfg) == dest:
            return
        return orig_build(cfg, download_path=download_path)

    monkeypatch.setattr(cli, "build_assets", safe_build_assets)
    monkeypatch.setattr(time, "sleep", lambda x: None)

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None, env=None, **kwargs):
            self.pid = 43
            if stdout is not None:
                stdout.write("Onion.start_onion_service: key_type=ED25519-V3\n")
                stdout.flush()

        def poll(self):
            return None

    monkeypatch.setattr(cli.subprocess, "Popen", FakePopen)

    cli.main(["serve"])

    updated = json.load(open(dir_path / "config.json"))
    assert updated["tear_off_link"] == "http://sessionserviceid.onion"


def test_quickstart_noninteractive(tmp_path, monkeypatch):
    """Test quickstart builds and serves in one command."""
    _setup_tmp(monkeypatch, tmp_path)
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
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
        def __init__(self, cmd, stdout=None, stderr=None, env=None, **kwargs):
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
    config_path = test_data_dir / "config.json"
    cli.main(["quickstart", "--non-interactive"])

    dir_path = test_data_dir / "host" / folder_name
    assert (dir_path / "index.html").exists()
    log_file = dir_path / "onionshare.log"
    assert onion_url in log_file.read_text()
    updated = json.load(open(dir_path / "config.json"))
    # tear_off_link should be set to onion address (for tear-off tabs)
    assert updated["tear_off_link"] == onion_url
    # url should be preserved (user-configured content link)
    assert updated["url"] == config["url"]


def test_install_systemd_autostart_writes_recovery_timer(tmp_path, monkeypatch):
    """Test Linux autostart installs a recurring recovery service and timer."""
    commands = []

    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(platform_linux.Path, "home", lambda: tmp_path)
    monkeypatch.setattr(cli, "_find_voxvera_bin", lambda: "/tmp/voxvera")
    monkeypatch.setattr(platform_linux.subprocess, "run", lambda args, **kwargs: commands.append(args))
    monkeypatch.setenv("USER", "tester")

    cli._install_systemd_autostart()

    service_dir = tmp_path / ".config" / "systemd" / "user"
    service_text = (service_dir / "voxvera-start.service").read_text(encoding="utf-8")
    timer_text = (service_dir / "voxvera-start.timer").read_text(encoding="utf-8")

    assert "ExecStart=/tmp/voxvera _linux_autostart_start" in service_text
    assert "KillMode=process" in service_text
    assert "OnUnitActiveSec=5min" in timer_text
    assert "Persistent=true" in timer_text
    assert any(args[:4] == ["systemctl", "--user", "enable", "--now"] and args[4] == "voxvera-start.timer" for args in commands)
    assert any(args[:4] == ["systemctl", "--user", "start", "voxvera-start.service"] for args in commands)


def test_linux_autostart_start_sets_hardened_environment(monkeypatch):
    events = []

    monkeypatch.delenv("VOXVERA_ONIONSHARE_NO_AWAIT_PUBLICATION", raising=False)
    monkeypatch.delenv("VOXVERA_ONIONSHARE_SYSTEM_TOR", raising=False)
    monkeypatch.setattr(cli, "cleanup_onionshare_tmp", lambda max_age_minutes=60: events.append(("cleanup", max_age_minutes)) or 0)
    monkeypatch.setattr(cli, "_user_is_group_member", lambda group: False)
    monkeypatch.setattr(cli, "start_all_servers", lambda: events.append(("start_all", None)))

    cli.linux_autostart_start()

    assert events == [("cleanup", 60), ("start_all", None)]
    assert os.environ["VOXVERA_ONIONSHARE_NO_AWAIT_PUBLICATION"] == "1"
    assert os.environ["VOXVERA_ONIONSHARE_SYSTEM_TOR"] == "1"


def test_linux_autostart_start_switches_to_debian_tor_group(monkeypatch):
    exec_call = {}

    monkeypatch.setattr(cli, "cleanup_onionshare_tmp", lambda max_age_minutes=60: 0)
    monkeypatch.setattr(cli, "_user_is_group_member", lambda group: group == "debian-tor")
    monkeypatch.setattr(cli, "_current_group_names", lambda: {"user"})
    monkeypatch.setattr(cli, "_find_voxvera_bin", lambda: "/tmp/vox vera")

    def fake_execvp(binary, args):
        exec_call["binary"] = binary
        exec_call["args"] = args
        raise RuntimeError("stop")

    monkeypatch.setattr(cli.os, "execvp", fake_execvp)

    with pytest.raises(RuntimeError, match="stop"):
        cli.linux_autostart_start()

    assert exec_call["binary"] == "sg"
    assert exec_call["args"][:3] == ["sg", "debian-tor", "-c"]
    assert "VOXVERA_ONIONSHARE_NO_AWAIT_PUBLICATION=1" in exec_call["args"][3]
    assert "VOXVERA_ONIONSHARE_SYSTEM_TOR=1" in exec_call["args"][3]
    assert "'/tmp/vox vera' start-all" in exec_call["args"][3]


def test_serve_uses_internal_onionshare_when_no_await_requested(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    folder_name = config["folder_name"]
    dir_path = test_data_dir / "host" / folder_name

    monkeypatch.setenv("VOXVERA_ONIONSHARE_NO_AWAIT_PUBLICATION", "1")
    monkeypatch.setattr(cli, "require_cmd", lambda c: True)
    monkeypatch.setattr(cli, "build_assets", lambda *args, **kwargs: None)
    monkeypatch.setattr(time, "sleep", lambda x: None)
    monkeypatch.setattr(cli.shutil, "which", lambda cmd: "/usr/bin/onionshare-cli" if cmd == "onionshare-cli" else None)

    onion_url = "http://internalpath.onion"
    popen_calls = []

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None, env=None, **kwargs):
            popen_calls.append(cmd)
            self.pid = 44
            if stdout is not None:
                stdout.write(f"URL: {onion_url}\n")
                stdout.flush()

        def poll(self):
            return None

    monkeypatch.setattr(cli.subprocess, "Popen", FakePopen)

    cli.main(["serve"])

    assert popen_calls
    assert "_internal_onionshare" in popen_calls[0]
    assert "/usr/bin/onionshare-cli" not in popen_calls[0]
    updated = json.load(open(dir_path / "config.json"))
    assert updated["tear_off_link"] == onion_url


def _write_nostr_event(path, payload_overrides=None, event_overrides=None):
    payload = {
        "type": "voxvera_flyer",
        "version": 1,
        "folder_name": "nostr-flyer",
        "lang": "en",
        "name": "Nostr Flyer",
        "title": "PUBLIC NOTICE",
        "subtitle": "DO ~~NOT~~ IGNORE",
        "headline": "NOSTR SOURCE TEST",
        "content": "This flyer came from a Nostr event.",
        "url_message": "Read the source.",
        "url": "https://example.com/source",
        "footer_message": "npub test",
        "attachment_path": "",
        "attachment_filename": "",
        "qr_target": "flyer_url",
    }
    if payload_overrides:
        payload.update(payload_overrides)
    event = {
        "id": "f" * 64,
        "pubkey": "a" * 64,
        "created_at": 1760000000,
        "kind": 30078,
        "tags": [["d", "voxvera:nostr-flyer"], ["t", "voxvera"], ["t", "flyer"]],
        "content": json.dumps(payload),
        "sig": "b" * 128,
    }
    if event_overrides:
        event.update(event_overrides)
    path.write_text(json.dumps(event), encoding="utf-8")
    return path


def test_nostr_validate_accepts_local_event_file(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json")

    cli.main(["nostr", "validate", str(event_path)])

    assert "Valid VoxVera Nostr flyer: NOSTR SOURCE TEST" in capsys.readouterr().out


def test_nostr_import_writes_existing_config_schema(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json")

    cli.main(["nostr", "import", str(event_path)])

    config_path = tmp_path / "data" / "host" / "nostr-flyer" / "config.json"
    imported = json.loads(config_path.read_text(encoding="utf-8"))
    assert imported["folder_name"] == "nostr-flyer"
    assert imported["headline"] == "NOSTR SOURCE TEST"
    assert imported["content"] == "This flyer came from a Nostr event."
    assert imported["url"] == "https://example.com/source"
    assert "Imported Nostr flyer to" in capsys.readouterr().out


def test_nostr_import_rejects_existing_site_without_overwrite(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json")
    cli.main(["nostr", "import", str(event_path)])

    with pytest.raises(SystemExit):
        cli.main(["nostr", "import", str(event_path)])

    assert "already exists" in capsys.readouterr().err


def test_nostr_build_generates_existing_flyer_output(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json")

    cli.main(["nostr", "build", str(event_path)])

    host_dir = tmp_path / "data" / "host" / "nostr-flyer"
    assert (host_dir / "config.json").exists()
    assert (host_dir / "index.html").exists()
    html = (host_dir / "index.html").read_text(encoding="utf-8")
    assert "NOSTR SOURCE TEST" in html


def test_nostr_serve_builds_then_uses_existing_serve_path(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json")
    served = []
    monkeypatch.setattr(cli, "serve", lambda config_path: served.append(Path(config_path).name) or "http://ok.onion")

    cli.main(["nostr", "serve", str(event_path)])

    assert served == ["config.json"]
    assert (tmp_path / "data" / "host" / "nostr-flyer" / "index.html").exists()


def test_nostr_validate_rejects_unsafe_url_scheme(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json", {"url": "javascript:alert(1)"})

    with pytest.raises(SystemExit):
        cli.main(["nostr", "validate", str(event_path)])

    assert "Unsupported URL scheme" in capsys.readouterr().err


def test_nostr_validate_rejects_raw_html(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    event_path = _write_nostr_event(tmp_path / "event.json", {"content": "<script>alert(1)</script>"})

    with pytest.raises(SystemExit):
        cli.main(["nostr", "validate", str(event_path)])

    assert "contains raw HTML" in capsys.readouterr().err


def test_nostr_validate_rejects_non_file_identifier_in_phase_one(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)

    with pytest.raises(SystemExit):
        cli.main(["nostr", "validate", "note1example"])

    assert "Phase 1 only supports local Nostr event JSON files" in capsys.readouterr().err


def test_is_server_running_returns_false_for_unreachable_onion(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    host_dir = test_data_dir / "host" / "voxvera"
    host_dir.mkdir(parents=True, exist_ok=True)
    (host_dir / "server.pid").write_text("123\n", encoding="utf-8")
    (host_dir / "config.json").write_text(
        json.dumps({"folder_name": "voxvera", "tear_off_link": "http://examplehiddenservice.onion"}),
        encoding="utf-8",
    )
    old = time.time() - 1200
    os.utime(host_dir / "server.pid", (old, old))

    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(cli.os, "kill", lambda pid, sig: None)
    monkeypatch.setattr(cli.subprocess, "check_output", lambda *args, **kwargs: b"onionshare-cli --website")
    monkeypatch.setattr(cli.shutil, "which", lambda cmd: "/usr/bin/curl" if cmd == "curl" else None)

    class _Result:
        returncode = 97
        stdout = ""

    monkeypatch.setattr(cli.subprocess, "run", lambda *args, **kwargs: _Result())

    assert cli.is_server_running("voxvera") is False
    assert (host_dir / "server.pid").exists()


def test_is_server_running_keeps_recent_unreachable_onion_alive(tmp_path, monkeypatch):
    _setup_tmp(monkeypatch, tmp_path)
    test_data_dir = tmp_path / "data"
    host_dir = test_data_dir / "host" / "voxvera"
    host_dir.mkdir(parents=True, exist_ok=True)
    (host_dir / "server.pid").write_text("123\n", encoding="utf-8")
    (host_dir / "config.json").write_text(
        json.dumps({"folder_name": "voxvera", "tear_off_link": "http://examplehiddenservice.onion"}),
        encoding="utf-8",
    )

    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(cli.os, "kill", lambda pid, sig: None)
    monkeypatch.setattr(cli.subprocess, "check_output", lambda *args, **kwargs: b"onionshare-cli --website")
    monkeypatch.setattr(cli.shutil, "which", lambda cmd: "/usr/bin/curl" if cmd == "curl" else None)

    class _Result:
        returncode = 97
        stdout = ""

    monkeypatch.setattr(cli.subprocess, "run", lambda *args, **kwargs: _Result())

    assert cli.is_server_running("voxvera") is True


def test_start_all_servers_restarts_unhealthy_site(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    host_dir = tmp_path / "data" / "host" / "voxvera"
    host_dir.mkdir(parents=True, exist_ok=True)
    (host_dir / "config.json").write_text(json.dumps({"folder_name": "voxvera"}), encoding="utf-8")
    (host_dir / "server.pid").write_text("123\n", encoding="utf-8")

    events = []
    monkeypatch.setattr(cli, "_seed_bundled_sites", lambda: None)
    monkeypatch.setattr(cli, "is_server_running", lambda name: False)
    monkeypatch.setattr(cli, "stop_server", lambda name: events.append(("stop", name)))
    monkeypatch.setattr(cli, "serve", lambda path: events.append(("serve", Path(path).name)) or "http://ok.onion")

    cli.start_all_servers()

    assert events == [("stop", "voxvera"), ("serve", "config.json")]
    output = capsys.readouterr().out
    assert "[RESTART] voxvera: existing process failed health check" in output
    assert "[OK]   voxvera: http://ok.onion" in output


def test_stop_server_kills_process_group_on_linux(tmp_path, monkeypatch, capsys):
    _setup_tmp(monkeypatch, tmp_path)
    host_dir = tmp_path / "data" / "host" / "voxvera"
    host_dir.mkdir(parents=True, exist_ok=True)
    pid_file = host_dir / "server.pid"
    pid_file.write_text("456\n", encoding="utf-8")

    killed = []
    monkeypatch.setattr(platform, "system", lambda: "Linux")
    monkeypatch.setattr(cli.os, "killpg", lambda pid, sig: killed.append((pid, sig)))

    cli.stop_server("voxvera")

    assert killed == [(456, cli.signal.SIGTERM)]
    assert not pid_file.exists()
    assert "Stopped voxvera (PID 456)" in capsys.readouterr().out


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
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    config["url"] = ""
    config["tear_off_link"] = ""
    with open(test_data_dir / "config.json", "w") as f:
        json.dump(config, f)

    # Remove any existing QR files from src and host to test fresh generation
    for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
        (res_root / "src" / qr_file).unlink(missing_ok=True)
        (test_data_dir / "host" / config["folder_name"] / qr_file).unlink(missing_ok=True)
    # Build should complete without error, just skip QR generation
    cli.main(["build"])

    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / config["folder_name"]
    assert dest.is_dir()
    assert (dest / "config.json").exists()
    assert (dest / "index.html").exists()
    html = (dest / "index.html").read_text(encoding="utf-8")
    assert 'class="container no-tear-offs"' in html
    # QR codes should not exist since no URLs were provided
    assert not (dest / "qrcode-content.png").exists()
    assert not (dest / "qrcode-tear-offs.png").exists()


def test_build_injects_localized_tor_browser_download_links(tmp_path, monkeypatch):
    """Test that the localized Tor Browser CTA gets the expected localized URL."""
    _setup_tmp(monkeypatch, tmp_path)

    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    config["lang"] = "de"
    with open(test_data_dir / "config.json", "w") as f:
        json.dump(config, f)

    cli.main(["--config", str(test_data_dir / "config.json"), "build"])

    html = (test_data_dir / "host" / config["folder_name"] / "index.html").read_text(encoding="utf-8")
    assert 'href="https://www.torproject.org/de/download/"' in html
    assert "Tor-Browser verwenden" in html


def test_build_with_only_url(tmp_path, monkeypatch):
    """Test that the main URL also populates tear-off rendering before onion setup."""
    _setup_tmp(monkeypatch, tmp_path)

    # Set only url (content link)
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    config["url"] = "https://example.com/external-resource"
    config["tear_off_link"] = ""
    with open(test_data_dir / "config.json", "w") as f:
        json.dump(config, f)

    # Remove any existing QR files from src and host to test fresh generation
    for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
        (res_root / "src" / qr_file).unlink(missing_ok=True)
        (test_data_dir / "host" / config["folder_name"] / qr_file).unlink(missing_ok=True)
    cli.main(["build"])

    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / config["folder_name"]
    html = (dest / "index.html").read_text(encoding="utf-8")
    assert (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()
    assert 'class="container no-tear-offs"' not in html
    assert "https://example.com/external-resource" in html


def test_build_with_only_tear_off_link(tmp_path, monkeypatch):
    """Test that QR codes work when only tear_off_link is set (pre-serve)."""
    _setup_tmp(monkeypatch, tmp_path)

    # Set only tear_off_link (before serve sets it to onion)
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    config["url"] = ""
    config["tear_off_link"] = "http://preconfigured.onion"
    with open(test_data_dir / "config.json", "w") as f:
        json.dump(config, f)

    # Remove any existing QR files from src and host to test fresh generation
    for qr_file in ["qrcode-content.png", "qrcode-tear-offs.png"]:
        (res_root / "src" / qr_file).unlink(missing_ok=True)
        (test_data_dir / "host" / config["folder_name"] / qr_file).unlink(missing_ok=True)
    cli.main(["build"])

    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / config["folder_name"]
    html = (dest / "index.html").read_text(encoding="utf-8")
    assert 'class="container no-tear-offs"' not in html
    # Only tear-off QR should exist (will be updated by serve)
    assert not (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()


def test_serve_passes_tor_ports_to_env(monkeypatch, tmp_path):
    """Test that serve() passes detected Tor ports via env to subprocess."""
    _setup_tmp(monkeypatch, tmp_path)
    cli.main(["build"])

    captured_env = {}

    class FakePopen:
        def __init__(self, cmd, stdout=None, stderr=None, env=None, **kwargs):
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
    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    config["url"] = "https://example.com/old-style"
    config["tear_off_link"] = "https://example.com/tear-off"
    with open(test_data_dir / "config.json", "w") as f:
        json.dump(config, f)

    cli.main(["build"])

    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / config["folder_name"]
    assert (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()


def test_long_urls_in_qr(tmp_path, monkeypatch):
    """Test that long URLs still generate valid QR codes."""
    _setup_tmp(monkeypatch, tmp_path)

    res_root = tmp_path / "data" / "voxvera"
    test_data_dir = tmp_path / "data"
    config = json.load(open(res_root / "src" / "config.json"))
    # Very long URL (close to 200 char limit)
    config["url"] = "http://" + "a" * 190 + ".onion"
    config["tear_off_link"] = "https://example.com/" + "path/" * 20
    with open(test_data_dir / "config.json", "w") as f:
        json.dump(config, f)

    cli.main(["build"])

    test_data_dir = tmp_path / "data"
    dest = test_data_dir / "host" / config["folder_name"]
    assert (dest / "qrcode-content.png").exists()
    assert (dest / "qrcode-tear-offs.png").exists()
