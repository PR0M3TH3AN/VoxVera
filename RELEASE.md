# VoxVera Release Process

This document outlines the mandatory steps to perform before every release to ensure code quality, cross-language integrity, and professional distribution assets.

## 1. Pre-Flight Checks (Quality Assurance)

Before any release, the codebase must pass all internal quality checks.

### Run Tests
Ensure all core CLI, E2E, and Integrity tests pass:
```bash
pytest tests/
```
*Note: The `test_integrity.py` check is critical as it verifies that all 14+ language locales have synchronized keys.*

### Run Linting
Ensure the code adheres to style guidelines (no trailing whitespace, proper spacing, etc.):
```bash
# Using flake8 (excluding vendored dependencies)
flake8 voxvera/ --exclude=voxvera/vendor/
```

## 2. Generate Localized Assets

All documentation and site templates must be synchronized with the translation system. This ensures that any changes to documentation are reflected across all 14+ supported languages.

### Synchronize Documentation
If you have modified any documentation templates in `docs/templates/`, you **must** use the translation system to regenerate the localized documentation before release:
```bash
# Regenerate docs/ folders for all languages from templates and locales
python3 -m voxvera.cli build-docs
```

### Synchronize Site Assets
The main `site/` directory (including QRs, HTML, and portable Zips) must also be refreshed to include the latest binary names and locale strings:
```bash
# Refresh site/ directory
python3 -m voxvera.cli build-site
```

## 3. Build Distribution Binaries

Standardized binaries and AppImages must be generated for the current platform.

### Standard Binary
Generates an architecture-specific binary (e.g., `voxvera-linux-x86_64`) in `voxvera/resources/bin/`.
```bash
./scripts/build_binaries.sh
```

### AppImage (Linux)
Wraps the standard binary into a self-contained AppImage.
```bash
./packaging/build_appimage.sh
```

### Flatpak (Linux)
Generates a standalone `.flatpak` bundle. Requires `flatpak-builder`.
```bash
./packaging/build_flatpak.sh
```

## 4. Release Execution

1. **Version Bump:** Update `__version__` in `voxvera/__init__.py` and `version` in `pyproject.toml`.
2. **Commit & Tag:**
   ```bash
   git add .
   git commit -m "chore: release vX.Y.Z"
   git tag -a vX.Y.Z -m "VoxVera vX.Y.Z"
   git push origin main --tags
   ```
3. **GitHub Release:**
   Create a release and upload the assets from `voxvera/resources/bin/` and `site/download/`.
   ```bash
   gh release create vX.Y.Z voxvera/resources/bin/* site/download/*.zip --title "VoxVera vX.Y.Z" --notes "Release notes here..."
   ```
