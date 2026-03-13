# Contributing to VoxVera

Thank you for your interest in contributing to VoxVera! This project aims to be a global, censorship-resistant tool, and your help—especially with translations—is vital.

## Adding a New Language

VoxVera uses a centralized token system for the CLI and Web components, and a template-based system for Documentation. To add a new language (e.g., French/`fr`), follow this checklist:

### 1. The Token File
Create a new JSON file in `voxvera/locales/{lang_code}.json`.
- Use `en.json` as your master template.
- **`meta`**: Include the native language name and a flag emoji.
- **`cli`**: Translate all strings used in the terminal interface.
- **`web`**: Translate strings used on the generated landing pages and flyers.
- **`landing`**: Translate the specific content for the official VoxVera website.
- **Formatting**: You can use Markdown-style strike-throughs (`~~redacted text~~`) in any of these strings; they will be automatically converted to the stylized "redacted" effect on the flyers.

### 2. The Landing Page
The main landing page (`site/index.html`) must be synchronized to include your new language.
- Open `site/index.html` and add your language to the `const locales` object in the `<script>` tag.
- Run `voxvera build-site` to refresh the public assets and ensure the pre-rendered HTML matches your new locale.

### 3. Documentation
VoxVera uses the **Doc-Sync Engine** to keep manuals in sync.
- Create localized Markdown files in `voxvera/locales/{lang_code}/docs/`.
- Use the templates in `docs/templates/` as your guide.
- You can use `cli.token_name` to reference terminal commands automatically.

### 4. Build and Verify
Run the following commands to verify your changes:
- `voxvera --lang {lang_code} check` (Verify CLI translation)
- `voxvera build-docs` (Generate localized manuals)
- Open `site/index.html` in a browser and test the language switcher.

## Code Contributions
- Ensure all tests pass: `pytest tests/test_cli.py`.
- Follow the existing coding style (PEP 8 for Python).
- If adding a new feature, update the master templates in `docs/templates/` and run `voxvera build-docs`.

---

Together, we can ensure that truth remains accessible to everyone, everywhere.
