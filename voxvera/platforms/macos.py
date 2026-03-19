from pathlib import Path

from .base import PlatformAdapter


class MacOSPlatformAdapter(PlatformAdapter):
    platform_id = "macos_cli"
    tier = "experimental"
    label = "macOS CLI"

    @property
    def launch_agents_dir(self) -> Path:
        return self.home_dir / "Library" / "LaunchAgents"

    @property
    def plist_path(self) -> Path:
        return self.launch_agents_dir / "org.voxvera.start-all.plist"

    def autostart_artifacts(self) -> list[str]:
        return [str(self.plist_path)]

    def render_launchd_plist(self, voxvera_bin: str) -> str:
        home = self.home_dir
        return f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>org.voxvera.start-all</string>
    <key>ProgramArguments</key>
    <array>
        <string>{voxvera_bin}</string>
        <string>start-all</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{home}/host/voxvera-autostart.log</string>
    <key>StandardErrorPath</key>
    <string>{home}/host/voxvera-autostart.log</string>
</dict>
</plist>
"""

    def autostart_status(self) -> dict:
        checks = [
            {
                "name": self.plist_path.name,
                "ok": self.plist_path.exists(),
                "detail": str(self.plist_path) if self.plist_path.exists() else f"missing: {self.plist_path}",
            }
        ]
        if self._run_capture(["launchctl", "list", "org.voxvera.start-all"])[0]:
            checks.append(
                {
                    "name": "launchd_loaded",
                    "ok": True,
                    "detail": "org.voxvera.start-all is loaded",
                }
            )
        else:
            checks.append(
                {
                    "name": "launchd_loaded",
                    "ok": False,
                    "detail": "org.voxvera.start-all is not loaded",
                }
            )
        return {
            "platform_id": self.platform_id,
            "label": self.label,
            "tier": self.tier,
            "supported": False,
            "message": "macOS launchd autostart is experimental and not validated for reliable hidden-service recovery.",
            "artifacts": self.autostart_artifacts(),
            "checks": checks,
        }

    def install_autostart(self) -> None:
        if self.cli is None:
            raise RuntimeError("CLI module is required to install macOS autostart.")
        self.launch_agents_dir.mkdir(parents=True, exist_ok=True)
        voxvera_bin = self.cli._find_voxvera_bin()
        self.plist_path.write_text(self.render_launchd_plist(voxvera_bin), encoding="utf-8")
        self._run_capture(["launchctl", "load", "-w", str(self.plist_path)])
        print(f"LaunchAgent installed: {self.plist_path}")
        print("Sites will start automatically on login.")
        print(f"  Disable with: launchctl unload {self.plist_path}")
