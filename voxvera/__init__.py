import sys
from pathlib import Path

__version__ = "0.3.4"

# Add the vendor directory to sys.path ONLY for PyInstaller (frozen) builds.
# For pip/pipx installs the system/venv packages are correct and the vendored
# copies are incomplete (missing data files), so we must not shadow them.
if getattr(sys, 'frozen', False):
    vendor_dir = Path(sys._MEIPASS).joinpath("voxvera", "vendor")
    if vendor_dir.exists() and str(vendor_dir) not in sys.path:
        sys.path.insert(0, str(vendor_dir))
