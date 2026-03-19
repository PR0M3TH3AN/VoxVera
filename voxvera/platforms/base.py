from __future__ import annotations

import json
import platform
import shutil
import subprocess
from pathlib import Path


class PlatformAdapter:
    platform_id = "generic"
    tier = "experimental"
    label = "Generic platform"

    def __init__(self, cli_module=None):
        self.cli = cli_module

    @property
    def home_dir(self) -> Path:
        return Path.home()

    @property
    def data_dir(self) -> Path:
        if self.cli is not None:
            return Path(self.cli.DATA_DIR)
        return self.home_dir

    @property
    def repo_root(self) -> Path:
        if self.cli is not None and hasattr(self.cli, "ROOT"):
            return Path(self.cli.ROOT).parent
        return Path(__file__).resolve().parents[2]

    @property
    def support_matrix_path(self) -> Path:
        return self.repo_root / "support-matrix.json"

    def _run_capture(self, args: list[str]) -> tuple[bool, str]:
        try:
            output = subprocess.check_output(args, stderr=subprocess.STDOUT).decode().strip()
            return True, output
        except Exception as exc:
            return False, str(exc)

    def load_support_matrix(self) -> dict:
        if not self.support_matrix_path.exists():
            return {"platforms": [], "support_tiers": {}}
        return json.loads(self.support_matrix_path.read_text(encoding="utf-8"))

    def support_entry(self) -> dict:
        matrix = self.load_support_matrix()
        for entry in matrix.get("platforms", []):
            if entry.get("id") == self.platform_id:
                return entry
        return {
            "id": self.platform_id,
            "label": self.label,
            "tier": self.tier,
            "hosting_model": "",
            "distribution_surfaces": [],
            "required_capabilities": [],
            "current_notes": [],
            "next_gaps": [],
        }

    def autostart_status(self) -> dict:
        return {
            "platform_id": self.platform_id,
            "label": self.label,
            "tier": self.tier,
            "supported": False,
            "message": "Autostart status is not implemented for this platform.",
            "artifacts": [],
            "checks": [],
        }

    def install_autostart(self) -> None:
        raise NotImplementedError("Autostart is not implemented for this platform.")

    def uninstall_autostart(self) -> None:
        raise NotImplementedError("Autostart uninstall is not implemented for this platform.")

    def platform_status(self) -> dict:
        entry = self.support_entry()
        matrix = self.load_support_matrix()
        return {
            "platform_id": self.platform_id,
            "label": entry.get("label", self.label),
            "tier": entry.get("tier", self.tier),
            "tier_description": matrix.get("support_tiers", {}).get(entry.get("tier", self.tier), ""),
            "hosting_model": entry.get("hosting_model", ""),
            "distribution_surfaces": entry.get("distribution_surfaces", []),
            "required_capabilities": entry.get("required_capabilities", []),
            "current_notes": entry.get("current_notes", []),
            "next_gaps": entry.get("next_gaps", []),
        }

    def _doctor_section(self, title: str, check_names: list[str], checks: list[dict]) -> dict:
        section_checks = [check for check in checks if check["name"] in check_names]
        return {
            "title": title,
            "ok": all(check.get("ok") for check in section_checks) if section_checks else True,
            "checks": section_checks,
        }

    def build_doctor_sections(self, checks: list[dict]) -> dict:
        return {
            "platform_contract": self._doctor_section("Platform contract", ["platform"], checks),
            "dependencies": self._doctor_section("Dependencies", ["voxvera_cli", "onionshare_cli"], checks),
            "network": self._doctor_section("Network", [], checks),
            "autostart": self._doctor_section("Autostart", [], checks),
            "content_state": self._doctor_section("Content state", [], checks),
        }

    def doctor_report(self) -> dict:
        checks = []
        voxvera_path = shutil.which("voxvera")
        onionshare_path = shutil.which("onionshare-cli") or shutil.which("onionshare")
        platform_status = self.platform_status()

        checks.append(
            {
                "name": "platform",
                "ok": True,
                "detail": f"{platform.system()} ({self.platform_id}, tier={platform_status['tier']})",
            }
        )
        checks.append(
            {
                "name": "voxvera_cli",
                "ok": bool(voxvera_path),
                "detail": voxvera_path or "voxvera not found on PATH",
            }
        )
        checks.append(
            {
                "name": "onionshare_cli",
                "ok": bool(onionshare_path),
                "detail": onionshare_path or "onionshare-cli/onionshare not found on PATH",
            }
        )

        sections = self.build_doctor_sections(checks)
        return {
            "platform_id": self.platform_id,
            "label": platform_status["label"],
            "tier": platform_status["tier"],
            "tier_description": platform_status["tier_description"],
            "hosting_model": platform_status["hosting_model"],
            "distribution_surfaces": platform_status["distribution_surfaces"],
            "required_capabilities": platform_status["required_capabilities"],
            "current_notes": platform_status["current_notes"],
            "next_gaps": platform_status["next_gaps"],
            "summary": {
                "ok": all(check.get("ok") for check in checks),
                "failing_checks": [check["name"] for check in checks if not check.get("ok")],
            },
            "sections": sections,
            "checks": checks,
        }

    def autostart_artifacts(self) -> list[str]:
        return []
