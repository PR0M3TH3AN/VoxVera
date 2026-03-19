import json
import os
import shutil
import zipfile
from pathlib import Path
from voxvera import cli

# Helper to find project root
REPO_ROOT = Path(__file__).resolve().parent.parent


def test_support_matrix_exists_and_matches_docs():
    support_matrix_path = REPO_ROOT / "support-matrix.json"
    support_doc_path = REPO_ROOT / "docs" / "platform-support-matrix.md"

    assert support_matrix_path.exists()
    assert support_doc_path.exists()

    support_data = json.loads(support_matrix_path.read_text(encoding="utf-8"))
    assert support_data["default_supported_target"] == "linux_cli_systemd"
    assert any(platform["tier"] == "supported" for platform in support_data["platforms"])
    assert any(platform["id"] == "windows_cli" for platform in support_data["platforms"])

    support_doc = support_doc_path.read_text(encoding="utf-8")
    assert "Linux CLI with `systemd --user`" in support_doc
    assert "Experimental" in support_doc


def test_platform_smoke_is_wired_into_validation_surfaces():
    smoke_script = REPO_ROOT / "scripts" / "platform-smoke.sh"
    ci_workflow = (REPO_ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    e2e_script = (REPO_ROOT / "ci" / "test-e2e.sh").read_text(encoding="utf-8")
    binaries_workflow = (REPO_ROOT / ".github" / "workflows" / "binaries.yml").read_text(encoding="utf-8")
    smoke_text = smoke_script.read_text(encoding="utf-8")

    assert smoke_script.exists()
    assert "scripts/platform-smoke.sh linux-cli" in ci_workflow
    assert "scripts/platform-smoke.sh linux-cli" in e2e_script
    assert "platform-status --json" in ci_workflow
    assert "doctor --json" in ci_workflow
    assert "autostart status --json" in ci_workflow
    assert "platform-status --json" in binaries_workflow
    assert "doctor --json" in binaries_workflow
    assert "autostart status --json" in binaries_workflow
    for target in ("linux-cli", "macos-cli", "windows-cli", "docker-cli"):
        assert target in smoke_text


def test_linux_validation_runbook_and_helper_are_linked():
    runbook = REPO_ROOT / "docs" / "linux-hosting-validation.md"
    helper = REPO_ROOT / "scripts" / "linux-recovery-check.sh"
    readme = (REPO_ROOT / "README.md").read_text(encoding="utf-8")

    assert runbook.exists()
    assert helper.exists()
    assert "docs/linux-hosting-validation.md" in readme
    assert "scripts/linux-recovery-check.sh" in runbook.read_text(encoding="utf-8")

def test_locale_completeness():
    """Verify that all non-English locales have the same keys as English."""
    locales_dir = REPO_ROOT / "voxvera" / "locales"
    en_path = locales_dir / "en.json"
    
    with open(en_path, "r", encoding="utf-8") as f:
        en_data = json.load(f)
    
    # Flatten keys for easier comparison
    def get_keys(d, prefix=""):
        keys = set()
        for k, v in d.items():
            if isinstance(v, dict):
                keys.update(get_keys(v, f"{prefix}{k}."))
            else:
                keys.add(f"{prefix}{k}")
        return keys

    en_keys = get_keys(en_data)
    
    locale_files = list(locales_dir.glob("*.json"))
    assert len(locale_files) >= 10, "Should have at least 10 languages supported"

    missing_info = []
    for lp in locale_files:
        if lp.name == "en.json":
            continue
        with open(lp, "r", encoding="utf-8") as f:
            data = json.load(f)
            keys = get_keys(data)
            missing = en_keys - keys
            if missing:
                missing_info.append(f"{lp.name} is missing: {missing}")
    
    assert not missing_info, "\n".join(missing_info)


def test_critical_locale_labels_are_not_left_in_english():
    """Verify key translated labels are not left as raw English in non-English locales."""
    locales_dir = REPO_ROOT / "voxvera" / "locales"
    en_data = json.loads((locales_dir / "en.json").read_text(encoding="utf-8"))
    critical_paths = [
        ("cli", "attachment_path_label"),
        ("cli", "manage_action_edit"),
        ("web", "download_attachment"),
    ]

    for lp in locales_dir.glob("*.json"):
        if lp.name == "en.json":
            continue
        data = json.loads(lp.read_text(encoding="utf-8"))
        for section, key in critical_paths:
            assert data[section][key] != en_data[section][key], f"{lp.name} leaves {section}.{key} in English"


def test_export_import_roundtrip(tmp_path, monkeypatch):
    """Verify that export -> import preserves the Tor identity key perfectly."""
    # Setup tmp environment
    shutil.copytree(REPO_ROOT / "voxvera" / "src", tmp_path / "src")
    shutil.copytree(REPO_ROOT / "voxvera" / "locales", tmp_path / "locales")
    monkeypatch.setattr(cli, "ROOT", tmp_path)
    monkeypatch.setattr(cli, "DATA_DIR", tmp_path)
    monkeypatch.setattr(cli, "_src_res", lambda *p: tmp_path / "src" / Path(*p))
    monkeypatch.setattr(cli, "_locale_res", lambda *p: tmp_path / "locales" / Path(*p))
    
    # Create a site with a "secret" Tor key
    folder_name = "secret-site"
    site_dir = tmp_path / "host" / folder_name
    site_dir.mkdir(parents=True)
    
    config = {"folder_name": folder_name, "name": "Secret", "lang": "en"}
    with open(site_dir / "config.json", "w") as f:
        json.dump(config, f)
    
    secret_key = "THIS-IS-A-VERY-SECRET-TOR-KEY-12345"
    session_file = site_dir / ".onionshare-session"
    session_file.write_text(secret_key)
    
    # Export it
    export_zip = tmp_path / "export.zip"
    cli.export_site(folder_name, output_path=str(export_zip))
    assert export_zip.exists()
    
    # Delete the original site
    shutil.rmtree(site_dir)
    assert not site_dir.exists()
    
    # Import it
    cli.import_site(str(export_zip))
    
    # Verify the key is exactly the same
    restored_key = (tmp_path / "host" / folder_name / ".onionshare-session").read_text()
    assert restored_key == secret_key
    assert (tmp_path / "host" / folder_name / "config.json").exists()


def test_visual_width_logic():
    """Verify that visual width calculation handles CJK and Hindi correctly."""
    # Test cases: (string, expected_width)
    cases = [
        ("Hello", 5),
        ("日本語", 6), # Each char is 2 units wide
        ("हिन्दी", 5), # Hindi chars vary, but should be handled by wcwidth
        ("~~REDACTED~~", 13),
        ("W" * 10, 10),
    ]
    
    for text, expected in cases:
        width = cli._get_visual_width(text)
        assert width >= expected - 1, f"Width for '{text}' too low: {width}"


def test_portable_bundle_integrity(tmp_path, monkeypatch):
    """Verify that the portable ZIP contains all essential anchor files."""
    # Setup realistic directory structure:
    # tmp_path/ (project root)
    # └── voxvera/ (ROOT)
    
    project_root = tmp_path
    voxvera_dir = project_root / "voxvera"
    voxvera_dir.mkdir()
    
    shutil.copytree(REPO_ROOT / "voxvera" / "src", voxvera_dir / "src")
    shutil.copytree(REPO_ROOT / "voxvera" / "locales", voxvera_dir / "locales")
    os.makedirs(voxvera_dir / "vendor", exist_ok=True)
    (voxvera_dir / "vendor" / "anchor.txt").write_text("anchor")
    
    # Copy real scripts from repo
    for script in ["voxvera-run.sh", "uninstall.sh", "uninstall.ps1", "install.sh", "install.ps1", "setup.sh"]:
        if (REPO_ROOT / script).exists():
            shutil.copy(REPO_ROOT / script, project_root / script)
    
    # ROOT in cli.py points to the voxvera/ directory
    monkeypatch.setattr(cli, "ROOT", voxvera_dir)
    
    bundle_zip = project_root / "voxvera-portable.zip"
    cli.bundle_portable(bundle_zip)
    
    assert bundle_zip.exists()
    
    with zipfile.ZipFile(bundle_zip, "r") as zf:
        names = zf.namelist()
        # Verify source code (relative to project root)
        assert any("voxvera/src/index-master.html" in n for n in names)
        # Verify locales
        assert any("voxvera/locales/en.json" in n for n in names)
        # Verify vendored libs
        assert any("voxvera/vendor/anchor.txt" in n for n in names)
        # Verify uninstallers
        assert "uninstall.sh" in names
        assert "uninstall.ps1" in names

        # Verify root scripts
        assert "voxvera-run.sh" in names
