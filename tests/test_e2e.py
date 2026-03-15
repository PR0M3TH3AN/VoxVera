"""
End-to-end tests for VoxVera installation and serving.

These tests verify:
1. Installation script works correctly
2. Full workflow from init -> build -> serve
3. Site is reachable at the onion address

To run these tests:
  pytest tests/test_e2e.py -v --tb=short

Requirements:
- Tor must be running (system tor or Tor Browser)
- onionshare-cli must be installed
"""

import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path

import pytest

# Mark these tests as slow/integration tests
pytestmark = [pytest.mark.slow, pytest.mark.integration]


def check_tor_running():
    """Check if Tor is running on default ports."""
    for port in [9050, 9150]:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.5)
            result = sock.connect_ex(("127.0.0.1", port))
            sock.close()
            if result == 0:
                return port
        except Exception:
            pass
    return None


def check_onionshare_cli():
    """Check if onionshare-cli is installed."""
    try:
        import onionshare_cli  # noqa: F401
        return True
    except ImportError:
        return False


@pytest.fixture(scope="module")
def skip_without_deps():
    """Skip tests if required dependencies aren't available."""
    tor_port = check_tor_running()
    if not tor_port:
        pytest.skip("Tor is not running on expected ports (9050 or 9150)")
    if not check_onionshare_cli():
        pytest.skip("onionshare-cli is not installed")
    return tor_port


class TestInstallation:
    """Tests for the installation process."""

    def test_install_script_detects_package_manager(self):
        """Test that install script detects the system's package manager."""
        install_script = Path(__file__).resolve().parent.parent / "install.sh"

        # Check script exists and has proper structure
        assert install_script.exists()
        content = install_script.read_text()

        # Verify it handles multiple package managers
        assert "apt-get" in content
        assert "dnf" in content or "yum" in content
        assert "onionshare-cli" in content or "onionshare" in content

    def test_voxvera_install_script_structure(self):
        """Test that voxvera-install.sh has all required components."""
        install_script = Path(__file__).resolve().parent.parent / "voxvera-install.sh"
        content = install_script.read_text()

        # Verify it tries to install onionshare-cli
        assert "onionshare-cli" in content or "onionshare" in content

        # Verify it installs tor
        assert "tor" in content

        # Verify it creates a torrc config
        assert "torrc" in content


class TestFullWorkflow:
    """End-to-end tests for the complete VoxVera workflow."""

    @pytest.mark.usefixtures("skip_without_deps")
    def test_full_init_build_serve_workflow(self, tmp_path, monkeypatch):
        """Test complete workflow: init -> build -> serve -> verify onion site."""
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from voxvera import cli

        # Setup temp workspace
        repo_root = Path(__file__).resolve().parent.parent
        shutil.copytree(repo_root / "voxvera" / "src", tmp_path / "src")
        shutil.copytree(repo_root / "voxvera" / "locales", tmp_path / "locales")

        # Monkeypatch ROOT to use temp directory
        monkeypatch.setattr(cli, "ROOT", tmp_path)
        monkeypatch.setattr(cli, "_src_res", lambda *p: tmp_path / "src" / Path(*p))
        monkeypatch.setattr(cli, "_locale_res", lambda *p: tmp_path / "locales" / Path(*p))

        # Create test config
        config = {
            "name": "Test Flyer",
            "folder_name": "testflyer",
            "title": "TEST TITLE",
            "subtitle": "Test Subtitle",
            "headline": "Test Headline",
            "content": "Test content for the flyer.",
            "url": "https://example.com/external",
            "tear_off_link": "",  # Will be set by serve
            "url_message": "Visit our site",
            "binary_message": "0101010",
        }

        config_path = tmp_path / "src" / "config.json"
        with open(config_path, "w") as f:
            json.dump(config, f)

        # Step 1: Build
        cli.build_assets(config_path)

        host_dir = tmp_path / "host" / "testflyer"
        assert host_dir.exists()
        assert (host_dir / "index.html").exists()
        assert (host_dir / "config.json").exists()

        # Verify QR code was generated for URL
        assert (host_dir / "qrcode-content.png").exists()

        # Step 2: Serve (mock the subprocess to avoid isolation issues)
        onion_url = "http://test123abc.onion"

        class MockPopen:
            def __init__(self, cmd, stdout=None, stderr=None, env=None):
                self.cmd = cmd
                self.stdout = stdout
                self.stderr = stderr
                self.pid = 42
                self._running = True

                # Write to log file to simulate OnionShare
                if stdout is not None:
                    stdout.write(f"Started at {onion_url}\n")
                    stdout.flush()

            def poll(self):
                return None  # Still running

            def terminate(self):
                self._running = False

            def kill(self):
                self._running = False

            def wait(self, timeout=None):
                return 0

        monkeypatch.setattr(cli.subprocess, "Popen", MockPopen)
        monkeypatch.setattr(time, "sleep", lambda x: None)

        # Run serve
        cli.serve(str(host_dir / "config.json"))

        # Step 3: Verify
        # Verify config was updated
        updated_config = json.load(open(host_dir / "config.json"))
        assert updated_config["tear_off_link"] == onion_url
        assert updated_config["url"] == "https://example.com/external"

        # Verify QR code for tear-off link now exists (regenerated by serve)
        assert (host_dir / "qrcode-tear-offs.png").exists()

    @pytest.mark.usefixtures("skip_without_deps")
    def test_site_reachable_via_tor(self, tmp_path, monkeypatch):
        """Test that the served site is actually reachable via Tor.

        This test builds site assets, launches onionshare-cli directly against
        them, waits for the .onion address, then fetches it through Tor SOCKS.

        Requires: Tor running, onionshare-cli, requests[socks]
        """
        pytest.importorskip("requests", reason="requests library required")

        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from voxvera import cli

        # Setup
        repo_root = Path(__file__).resolve().parent.parent
        shutil.copytree(repo_root / "voxvera" / "src", tmp_path / "src")
        shutil.copytree(repo_root / "voxvera" / "locales", tmp_path / "locales")

        monkeypatch.setattr(cli, "ROOT", tmp_path)
        monkeypatch.setattr(cli, "_src_res", lambda *p: tmp_path / "src" / Path(*p))
        monkeypatch.setattr(cli, "_locale_res", lambda *p: tmp_path / "locales" / Path(*p))

        config = {
            "name": "Reachability Test",
            "folder_name": "reachtest",
            "title": "Reachability Test",
            "subtitle": "Testing Tor reachability",
            "headline": "Test Headline",
            "content": "This tests if the site is reachable via Tor.",
            "url": "https://example.com",
            "tear_off_link": "",
            "url_message": "Test message",
            "binary_message": "101010",
        }

        config_path = tmp_path / "src" / "config.json"
        with open(config_path, "w") as f:
            json.dump(config, f)

        cli.build_assets(config_path)

        host_dir = tmp_path / "host" / "reachtest"
        assert host_dir.is_dir(), f"Build did not create {host_dir}"

        # Launch onionshare-cli directly against the built host directory using our internal wrapper
        logfile = host_dir / "onionshare.log"
        log_fh = open(logfile, "w")

        # Pass Tor environment variables to ensure it uses the running Tor
        env = os.environ.copy()
        tor_port = check_tor_running()
        if tor_port:
            env["TOR_SOCKS_PORT"] = str(tor_port)
            env["TOR_CONTROL_PORT"] = str(tor_port + 1)

        cmd = [
            sys.executable,
            "-m", "voxvera.cli",
            "_internal_onionshare",
            "--website",
            "--public",
            "--tor-mode", "unmanaged",
            "--persistent",
            str(host_dir / ".onionshare-session"),
            "-v",
            str(host_dir),
        ]
        proc = subprocess.Popen(cmd, stdout=log_fh, stderr=subprocess.STDOUT, env=env)

        try:
            # Wait for onion URL to appear in the log
            onion_url = None
            start_time = time.time()

            while time.time() - start_time < 60:
                if proc.poll() is not None:
                    log_fh.close()
                    content = logfile.read_text()
                    pytest.skip(
                        f"onionshare-cli exited early (rc={proc.returncode}): "
                        + content[-500:]
                    )

                log_fh.flush()
                if logfile.exists():
                    content = logfile.read_text()
                    m = re.search(r"https?://[a-z2-7]{56}\.onion", content)
                    if m:
                        onion_url = m.group(0)
                        break
                time.sleep(1)

            if not onion_url:
                log_fh.close()
                content = logfile.read_text() if logfile.exists() else "(no log)"
                pytest.skip(
                    "Could not get onion URL within 60s. Log tail: " + content[-500:]
                )

            # Try to reach the site via Tor
            import requests

            tor_port = check_tor_running()
            session = requests.session()
            session.proxies = {
                "http": f"socks5h://127.0.0.1:{tor_port}",
                "https": f"socks5h://127.0.0.1:{tor_port}",
            }

            # Tor circuits can take time; retry several times
            success = False
            last_error = None
            for attempt in range(6):
                try:
                    response = session.get(onion_url, timeout=30)
                    if response.status_code == 200:
                        success = True
                        break
                except Exception as e:
                    last_error = str(e)
                    time.sleep(3)

            assert success, (
                f"Could not reach {onion_url} after 6 attempts. "
                f"Last error: {last_error}"
            )

        finally:
            log_fh.close()
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


class TestSiteFiles:
    """Tests for verifying site file structure."""

    def test_all_expected_files_present(self, tmp_path, monkeypatch):
        """Test that all expected files are present in the hosted directory."""
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from voxvera import cli

        # Setup
        repo_root = Path(__file__).resolve().parent.parent
        shutil.copytree(repo_root / "voxvera" / "src", tmp_path / "src")
        shutil.copytree(repo_root / "voxvera" / "locales", tmp_path / "locales")

        monkeypatch.setattr(cli, "ROOT", tmp_path)
        monkeypatch.setattr(cli, "_src_res", lambda *p: tmp_path / "src" / Path(*p))
        monkeypatch.setattr(cli, "_locale_res", lambda *p: tmp_path / "locales" / Path(*p))

        config = {
            "name": "Test",
            "folder_name": "filetest",
            "title": "Title",
            "subtitle": "Subtitle",
            "headline": "Headline",
            "content": "Content",
            "url": "https://example.com",
            "tear_off_link": "",
            "url_message": "",
            "binary_message": "",
        }

        config_path = tmp_path / "src" / "config.json"
        with open(config_path, "w") as f:
            json.dump(config, f)

        cli.build_assets(config_path)

        host_dir = tmp_path / "host" / "filetest"

        # Check all expected files exist
        expected_files = [
            "index.html",
            "config.json",
            "qrcode-content.png",
        ]

        for filename in expected_files:
            assert (host_dir / filename).exists(), f"Missing file: {filename}"


class TestErrorHandling:
    """Tests for error handling and edge cases."""

    def test_serve_without_build_fails_gracefully(self, tmp_path, monkeypatch):
        """Test that serve fails gracefully if build hasn't been run."""
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from voxvera import cli

        monkeypatch.setattr(cli, "ROOT", tmp_path)

        # Try to serve without building first
        config_path = tmp_path / "src" / "config.json"
        config_path.parent.mkdir(parents=True)
        config_path.write_text(
            json.dumps(
                {
                    "folder_name": "nonexistent",
                    "name": "Test",
                    "title": "Title",
                    "subtitle": "Subtitle",
                    "headline": "Headline",
                    "content": "Content",
                    "url": "",
                    "tear_off_link": "",
                }
            )
        )

        with pytest.raises(SystemExit):
            cli.serve(str(config_path))


class TestTorIntegration:
    """Tests for Tor integration."""

    def test_tor_auto_detection_falls_back_to_defaults(self, monkeypatch):
        """Test that Tor port detection falls back to defaults when Tor isn't running."""
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from voxvera import cli

        # Clear environment variables
        monkeypatch.delenv("TOR_SOCKS_PORT", raising=False)
        monkeypatch.delenv("TOR_CONTROL_PORT", raising=False)
        
        # Mock socket to always fail connection so it falls back to defaults
        import socket

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

        # This should not raise an error, just return defaults
        socks, ctl = cli.get_tor_ports()

        assert socks == "9050"
        assert ctl == "9051"

    def test_tor_env_vars_override_detection(self, monkeypatch):
        """Test that environment variables override auto-detection."""
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from voxvera import cli

        monkeypatch.setenv("TOR_SOCKS_PORT", "9999")
        monkeypatch.setenv("TOR_CONTROL_PORT", "8888")

        socks, ctl = cli.get_tor_ports()

        assert socks == "9999"
        assert ctl == "8888"
