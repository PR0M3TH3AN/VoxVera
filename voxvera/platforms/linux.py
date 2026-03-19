from __future__ import annotations

import os
import shutil
import socket
import subprocess
from pathlib import Path

from .base import PlatformAdapter


class LinuxPlatformAdapter(PlatformAdapter):
    platform_id = "linux_cli_systemd"
    tier = "supported"
    label = "Linux CLI with systemd --user"

    @property
    def user_systemd_dir(self) -> Path:
        return self.home_dir / ".config" / "systemd" / "user"

    @property
    def service_path(self) -> Path:
        return self.user_systemd_dir / "voxvera-start.service"

    @property
    def timer_path(self) -> Path:
        return self.user_systemd_dir / "voxvera-start.timer"

    def autostart_artifacts(self) -> list[str]:
        return [str(self.service_path), str(self.timer_path)]

    def render_systemd_service(self, voxvera_bin: str) -> str:
        return f"""\
[Unit]
Description=VoxVera hidden-service recovery runner
After=network-online.target tor.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart={voxvera_bin} start-all
"""

    def render_systemd_timer(self) -> str:
        return """\
[Unit]
Description=Retry VoxVera hidden-service startup

[Install]
WantedBy=timers.target

[Timer]
OnBootSec=2min
OnStartupSec=2min
OnUnitActiveSec=5min
Unit=voxvera-start.service
Persistent=true
"""

    def autostart_status(self) -> dict:
        checks = []
        artifacts = self.autostart_artifacts()
        for path in [self.service_path, self.timer_path]:
            checks.append(
                {
                    "name": path.name,
                    "ok": path.exists(),
                    "detail": str(path) if path.exists() else f"missing: {path}",
                }
            )

        if shutil.which("systemctl"):
            ok, output = self._run_capture(["systemctl", "--user", "is-enabled", "voxvera-start.timer"])
            checks.append(
                {
                    "name": "systemd_timer_enabled",
                    "ok": ok and output == "enabled",
                    "detail": output,
                }
            )
            ok, output = self._run_capture(["systemctl", "--user", "is-active", "voxvera-start.timer"])
            checks.append(
                {
                    "name": "systemd_timer_active",
                    "ok": ok and output == "active",
                    "detail": output,
                }
            )
        else:
            checks.append(
                {
                    "name": "systemctl",
                    "ok": False,
                    "detail": "systemctl not found",
                }
            )

        supported = all(check["ok"] for check in checks if check["name"] in {"voxvera-start.service", "voxvera-start.timer"})
        return {
            "platform_id": self.platform_id,
            "label": self.label,
            "tier": self.tier,
            "supported": supported,
            "message": "Linux recovery timer is the supported persistent-host path.",
            "artifacts": artifacts,
            "checks": checks,
        }

    def install_autostart(self) -> None:
        if self.cli is None:
            raise RuntimeError("CLI module is required to install Linux autostart.")
        self.user_systemd_dir.mkdir(parents=True, exist_ok=True)
        voxvera_bin = self.cli._find_voxvera_bin()

        self.service_path.write_text(self.render_systemd_service(voxvera_bin), encoding="utf-8")
        self.timer_path.write_text(self.render_systemd_timer(), encoding="utf-8")

        legacy_service = self.user_systemd_dir / "voxvera.service"
        if legacy_service.exists():
            legacy_service.unlink()

        commands = [
            ["systemctl", "--user", "daemon-reload"],
            ["systemctl", "--user", "disable", "--now", "voxvera.service"],
            ["systemctl", "--user", "enable", "--now", "voxvera-start.timer"],
            ["systemctl", "--user", "start", "voxvera-start.service"],
        ]
        for command in commands:
            try:
                subprocess.run(
                    command,
                    check=False,
                    stdin=subprocess.DEVNULL,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    timeout=10,
                )
            except Exception:
                pass

        linger_output = ""
        try:
            result = subprocess.run(
                ["loginctl", "show-user", os.environ.get("USER", ""), "--property=Linger", "--value"],
                check=False,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                timeout=5,
            )
            linger_output = (result.stdout or "").strip()
            if linger_output == "no":
                print("Note: user linger is not enabled. The recovery timer will run while you are logged in.")
                print("  To enable boot-time user services, run: sudo loginctl enable-linger $USER")
        except Exception:
            pass

        print(f"Systemd user service installed: {self.service_path}")
        print(f"Systemd user timer installed: {self.timer_path}")
        print("Sites will be retried automatically after boot and every few minutes.")
        print("  Manage with: systemctl --user [start|stop|status] voxvera-start.service")
        print("  Timer status: systemctl --user status voxvera-start.timer")

    def uninstall_autostart(self) -> None:
        commands = [
            ["systemctl", "--user", "disable", "--now", "voxvera-start.timer"],
            ["systemctl", "--user", "stop", "voxvera-start.service"],
            ["systemctl", "--user", "daemon-reload"],
        ]
        for command in commands:
            try:
                subprocess.run(command, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception:
                pass

        self.service_path.unlink(missing_ok=True)
        self.timer_path.unlink(missing_ok=True)
        print(f"Removed systemd user service: {self.service_path}")
        print(f"Removed systemd user timer: {self.timer_path}")

    def doctor_report(self) -> dict:
        report = super().doctor_report()
        checks = report["checks"]

        tor_found = bool(shutil.which("tor"))
        checks.append(
            {
                "name": "tor_binary",
                "ok": tor_found,
                "detail": shutil.which("tor") or "tor not found on PATH",
            }
        )

        socks_port = os.getenv("TOR_SOCKS_PORT")
        if not socks_port:
            for candidate in ("9050", "9150"):
                try:
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(0.25)
                    result = sock.connect_ex(("127.0.0.1", int(candidate)))
                    sock.close()
                    if result == 0:
                        socks_port = candidate
                        break
                except Exception:
                    pass
        checks.append(
            {
                "name": "tor_socks_reachable",
                "ok": bool(socks_port),
                "detail": f"reachable on {socks_port}" if socks_port else "no Tor SOCKS port detected",
            }
        )

        status = self.autostart_status()
        timer_check = next((check for check in status["checks"] if check["name"] == "systemd_timer_enabled"), None)
        if timer_check is not None:
            checks.append(
                {
                    "name": "autostart_timer_enabled",
                    "ok": timer_check["ok"],
                    "detail": timer_check["detail"],
                }
            )

        host_root = self.data_dir / "host"
        checks.append(
            {
                "name": "host_root",
                "ok": host_root.exists(),
                "detail": str(host_root) if host_root.exists() else f"missing: {host_root}",
            }
        )
        report["summary"] = {
            "ok": all(check.get("ok") for check in checks),
            "failing_checks": [check["name"] for check in checks if not check.get("ok")],
        }
        report["sections"] = {
            "platform_contract": self._doctor_section("Platform contract", ["platform"], checks),
            "dependencies": self._doctor_section("Dependencies", ["voxvera_cli", "onionshare_cli", "tor_binary"], checks),
            "network": self._doctor_section("Network", ["tor_socks_reachable"], checks),
            "autostart": self._doctor_section("Autostart", ["autostart_timer_enabled"], checks),
            "content_state": self._doctor_section("Content state", ["host_root"], checks),
        }
        return report
