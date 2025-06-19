
import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from voxvera.cli import main
import pytest


def test_help(capsys):
    with pytest.raises(SystemExit):
        main(["-h"])
    captured = capsys.readouterr()
    assert "usage:" in captured.out
