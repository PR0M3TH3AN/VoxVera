import sys
from pathlib import Path

__version__ = "0.2.2"

# Add the vendor directory to sys.path as a fallback.
if getattr(sys, 'frozen', False):
    vendor_dir = Path(sys._MEIPASS).joinpath("voxvera", "vendor")
else:
    vendor_dir = Path(__file__).parent / "vendor"
if vendor_dir.exists():
    if str(vendor_dir) not in sys.path:
        sys.path.append(str(vendor_dir))
