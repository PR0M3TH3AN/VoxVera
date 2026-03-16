import sys
import os

try:
    import pkg_resources
    import setuptools
    print("pkg_resources available")
except ImportError as e:
    print(f"Failed to import: {e}")

from voxvera import cli
cli._internal_onionshare()
