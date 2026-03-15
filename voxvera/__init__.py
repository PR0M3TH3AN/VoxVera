import sys
from pathlib import Path

__version__ = "0.1.9"

# Add the vendor directory to sys.path as a fallback.
# For standard installs (pip/pipx), the installed dependencies in the venv
# should take priority. We append here so vendor acts as a fallback.
vendor_dir = Path(__file__).parent / "vendor"
if vendor_dir.exists():
    if str(vendor_dir) not in sys.path:
        sys.path.append(str(vendor_dir))
