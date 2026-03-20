from __future__ import annotations

import os
import shutil
import socket
from pathlib import Path

from .base import PlatformAdapter


class DockerPlatformAdapter(PlatformAdapter):
    platform_id = "docker_cli"
    tier = "experimental"
    label = "Docker CLI container"

    @property
    def container_marker_paths(self) -> list[Path]:
        return [Path("/.dockerenv"), Path("/run/.containerenv")]

    def is_container_runtime(self) -> bool:
        return any(path.exists() for path in self.container_marker_paths) or os.environ.get("VOXVERA_RUNTIME") == "docker"

    def autostart_status(self) -> dict:
        artifacts = []
        if shutil.which("voxvera-docker-entrypoint"):
            artifacts.append("voxvera-docker-entrypoint")
        if shutil.which("voxvera-docker-healthcheck"):
            artifacts.append("voxvera-docker-healthcheck")

        checks = [
            {
                "name": "container_marker",
                "ok": self.is_container_runtime(),
                "detail": "container marker present"
                if self.is_container_runtime()
                else "no Docker marker detected",
            },
            {
                "name": "docker_entrypoint",
                "ok": bool(shutil.which("voxvera-docker-entrypoint")),
                "detail": shutil.which("voxvera-docker-entrypoint") or "voxvera-docker-entrypoint not found",
            },
            {
                "name": "docker_healthcheck",
                "ok": bool(shutil.which("voxvera-docker-healthcheck")),
                "detail": shutil.which("voxvera-docker-healthcheck") or "voxvera-docker-healthcheck not found",
            },
            {
                "name": "restart_policy_external",
                "ok": True,
                "detail": "Container restart behavior is managed by Docker/Compose, not VoxVera autostart.",
            },
        ]

        return {
            "platform_id": self.platform_id,
            "label": self.label,
            "tier": self.tier,
            "supported": all(check["ok"] for check in checks[:3]),
            "message": "Docker recovery depends on the container entrypoint plus an external restart policy.",
            "artifacts": artifacts,
            "checks": checks,
        }

    def install_autostart(self) -> None:
        raise RuntimeError("Docker autostart is managed by the container runtime. Use a restart policy such as '--restart unless-stopped'.")

    def uninstall_autostart(self) -> None:
        raise RuntimeError("Docker autostart is managed by the container runtime. Remove or change the container restart policy instead.")

    def doctor_report(self) -> dict:
        report = super().doctor_report()
        checks = report["checks"]

        marker_present = self.is_container_runtime()
        checks.append(
            {
                "name": "container_marker",
                "ok": marker_present,
                "detail": "Docker marker detected" if marker_present else "no Docker marker detected",
            }
        )

        socks_port = os.getenv("TOR_SOCKS_PORT", "9050")
        reachable = False
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(0.25)
            reachable = sock.connect_ex(("127.0.0.1", int(socks_port))) == 0
            sock.close()
        except Exception:
            reachable = False
        checks.append(
            {
                "name": "tor_socks_reachable",
                "ok": reachable,
                "detail": f"reachable on {socks_port}" if reachable else f"Tor SOCKS not reachable on {socks_port}",
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

        status = self.autostart_status()
        for name in ("docker_entrypoint", "docker_healthcheck"):
            check = next((item for item in status["checks"] if item["name"] == name), None)
            if check:
                checks.append(
                    {
                        "name": name,
                        "ok": check["ok"],
                        "detail": check["detail"],
                    }
                )

        report["summary"] = {
            "ok": all(check.get("ok") for check in checks),
            "failing_checks": [check["name"] for check in checks if not check.get("ok")],
        }
        report["sections"] = {
            "platform_contract": self._doctor_section("Platform contract", ["platform", "container_marker"], checks),
            "dependencies": self._doctor_section("Dependencies", ["voxvera_cli", "onionshare_cli", "docker_entrypoint", "docker_healthcheck"], checks),
            "network": self._doctor_section("Network", ["tor_socks_reachable"], checks),
            "autostart": self._doctor_section("Autostart", ["docker_entrypoint", "docker_healthcheck"], checks),
            "content_state": self._doctor_section("Content state", ["host_root"], checks),
        }
        return report
