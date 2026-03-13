import sys
from pathlib import Path

__version__ = "0.1.1"

# Add the vendor directory to sys.path so we can run without pip install
vendor_dir = Path(__file__).parent / "vendor"
if vendor_dir.exists():
    sys.path.insert(0, str(vendor_dir))
