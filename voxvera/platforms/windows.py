from .base import PlatformAdapter


class WindowsPlatformAdapter(PlatformAdapter):
    platform_id = "windows_cli"
    tier = "experimental"
    label = "Windows CLI"
    task_name = "VoxVera Start All"

    def render_schtasks_create_command(self, voxvera_bin: str) -> list[str]:
        return [
            "schtasks",
            "/Create",
            "/F",
            "/SC",
            "ONLOGON",
            "/TN",
            self.task_name,
            "/TR",
            f'"{voxvera_bin}" start-all',
            "/RL",
            "HIGHEST",
        ]

    def autostart_status(self) -> dict:
        ok, output = self._run_capture(["schtasks", "/Query", "/TN", self.task_name])
        checks = [
            {
                "name": "scheduled_task_present",
                "ok": ok,
                "detail": output if ok else f"missing or unreadable: {self.task_name}",
            }
        ]
        return {
            "platform_id": self.platform_id,
            "label": self.label,
            "tier": self.tier,
            "supported": False,
            "message": "Windows Task Scheduler autostart is experimental and not validated for reliable hidden-service recovery.",
            "artifacts": [],
            "checks": checks,
        }

    def install_autostart(self) -> None:
        if self.cli is None:
            raise RuntimeError("CLI module is required to install Windows autostart.")
        voxvera_bin = self.cli._find_voxvera_bin()
        ok, _output = self._run_capture(self.render_schtasks_create_command(voxvera_bin))
        if ok:
            print(f"Windows scheduled task '{self.task_name}' created.")
            print("Sites will start automatically on login.")
            print(f'  Remove with: schtasks /Delete /TN "{self.task_name}" /F')
            return
        print("Failed to create scheduled task. Try running as Administrator.")

    def uninstall_autostart(self) -> None:
        ok, _output = self._run_capture(["schtasks", "/Delete", "/TN", self.task_name, "/F"])
        if ok:
            print(f"Windows scheduled task '{self.task_name}' removed.")
            return
        print(f"Windows scheduled task '{self.task_name}' could not be removed.")
