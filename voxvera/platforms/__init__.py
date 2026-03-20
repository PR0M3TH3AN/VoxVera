import platform

from .base import PlatformAdapter
from .docker import DockerPlatformAdapter
from .linux import LinuxPlatformAdapter
from .macos import MacOSPlatformAdapter
from .windows import WindowsPlatformAdapter


def get_platform_adapter(cli_module=None) -> PlatformAdapter:
    system = platform.system()
    if system == "Linux":
        docker_adapter = DockerPlatformAdapter(cli_module=cli_module)
        if docker_adapter.is_container_runtime():
            return docker_adapter
        return LinuxPlatformAdapter(cli_module=cli_module)
    if system == "Darwin":
        return MacOSPlatformAdapter(cli_module=cli_module)
    if system == "Windows":
        return WindowsPlatformAdapter(cli_module=cli_module)
    return PlatformAdapter(cli_module=cli_module)
