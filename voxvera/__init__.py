import sys
from pathlib import Path

__version__ = "0.2.7"

# Add the vendor directory to sys.path. We prepend it to ensure our bundled
# dependencies take priority over potentially incompatible system packages
# (e.g. Flask/Werkzeug version mismatches on Debian).
if getattr(sys, 'frozen', False):
    vendor_dir = Path(sys._MEIPASS).joinpath("voxvera", "vendor")
else:
    vendor_dir = Path(__file__).parent / "vendor"

if vendor_dir.exists():
    if str(vendor_dir) not in sys.path:
        sys.path.insert(0, str(vendor_dir))
