# AI Agent Instructions for VoxVera

This guide is for AI agents (like Gemini, Claude, or GPT) contributing to the VoxVera project. Follow these protocols to maintain the architectural integrity and multi-language support.

## Core Mandates

1. **Security-First**: VoxVera is a Tor-based tool. Never suggest features that leak IP addresses or use non-Tor external resources (CDNs, etc.).
2. **Local-First**: All assets (fonts, dependencies, binaries) must be self-contained within the `voxvera/` package to support the Universal Mirroring model.
3. **Tokenized UI**: Never hardcode user-facing strings. Always add them to `voxvera/locales/en.json` and use the `t('cli.token')` helper.

## Localization Protocol

When adding a new language or updating an existing one:
- **CLI/Flyers**: Update `voxvera/locales/{lang}.json`. Include `meta`, `cli`, `web`, and `landing` categories.
- **Landing Page**: 
    - Directly update the `const locales` object in `site/index.html`.
    - **Crucial**: Run `voxvera build-site` to generate the latest portable bundle and refresh the pre-rendered HTML.
- **Documentation**: 
    - Master templates live in `docs/templates/`.
    - Localized overrides live in `voxvera/locales/{lang}/docs/`.
    - **Crucial**: After any change to locales or templates, you MUST run `voxvera build-docs` to synchronize the output in `docs/{en,es,de}/`.

## Universal Mirroring

VoxVera propagates through its own flyers.
- Every `voxvera build` and `voxvera build-site` generates `voxvera-portable.zip`.
- If you modify the core source code, ensure the `bundle_portable` function in `voxvera/cli.py` still correctly captures all necessary directories (especially `vendor/`, `locales/`, and `resources/`).

## Verification Checklist

Before finishing a task, ensure you have:
1. Run unit tests: `pytest tests/test_cli.py`.
2. Verified the localization: `voxvera --lang {lang} check`.
3. Rebuilt the documentation: `voxvera build-docs`.
4. Synchronized the public site: `voxvera build-site`.
5. Verified the portable bundle exists: `ls -l voxvera/host/*/download/voxvera-portable.zip` and `ls -l site/download/voxvera-portable.zip`.

---

Follow these rules to ensure VoxVera remains a robust, viral, and decentralized tool for truth.
