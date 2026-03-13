# Multi-Language Support Developer Plan

This document outlines the strategy for implementing a token-based multi-language system in VoxVera, covering the CLI, the generated landing page, and documentation.

## 1. Core Architecture: The Token System

All translatable strings will be centralized in JSON files located in `voxvera/locales/`. This allows for easy addition of new languages by simply dropping a new file.

- **Storage:** `voxvera/locales/{lang_code}.json` (e.g., `en.json`, `es.json`).
- **Structure:**
  ```json
  {
    "meta": {
      "language_name": "English",
      "flag": "🇺🇸"
    },
    "cli": {
      "welcome": "Welcome to VoxVera Setup",
      "select_lang": "Select your preferred language",
      "folder_prompt": "Enter folder name for this flyer:"
    },
    "web": {
      "title": "VoxVera - Anonymous Flyers",
      "download_btn": "Download Flyer",
      "onion_link_desc": "Scan to view on Tor",
      "change_lang": "Change Language"
    }
  }
  ```

## 2. CLI Implementation (`voxvera/cli.py`)

The CLI will be updated to handle localization from the start of the user interaction.

### Workflow:
1. **Initial Detection:** On startup, the CLI checks the system locale (`LANG` env var or `locale` module).
2. **Language Selection:** The first prompt in `voxvera init` will be a language selector, defaulting to the detected system locale.
3. **Session Loading:** Once selected, the CLI loads the corresponding JSON. All subsequent `InquirerPy` prompts will use these tokens.
4. **Configuration:** The chosen language code is saved in the flyer's `config.json` as a preference for that specific project.

## 3. Web Implementation (`voxvera/src/index-master.html`)

The landing page will support dynamic language switching without requiring server-side logic (essential for Tor-hidden services).

### Detection Logic:
- **Avoid IP-based Detection:** Since VoxVera is hosted on Tor, IP lookups return the Tor Exit Node location, not the user's.
- **Browser-based Detection:** Use `navigator.language` to detect the user's browser preference.
- **Persistence:** Save the user's manual choice in `localStorage`.

### Frontend Components:
1. **Attributes:** Use `data-i18n="web.token_name"` on HTML elements.
2. **Language Switcher:** A dropdown menu or text-link list (e.g., "EN | ES | FR") placed next to the **Download** button.
3. **I18n Engine:** A lightweight JavaScript snippet injected during the build process that:
    - Loads the bundled locale data.
    - Detects the best language (Manual Selection > Browser Setting > English Fallback).
    - Updates all `data-i18n` elements.

## 4. Build System Updates (`voxvera/build.py`)

The `build` process will be updated to bundle the necessary translations.

- **Multi-bundle:** By default, all available `web` tokens from all locale files will be injected into a single `<script>` tag in the final `index.html`. This ensures instant switching even when offline or on slow Tor connections.
- **Asset Optimization:** Minify the locale JSON data before injection to keep the HTML lightweight.

## 5. Portable & Viral Distribution Model

To ensure VoxVera is truly censorship-resistant, every generated flyer will serve as a mirror for the entire tool, including all supported languages and dependencies.

### Key Requirements:
- **Zero-Dependency Execution:** All Python libraries (from `requirements.txt`) will be bundled into a `voxvera/vendor/` directory. The CLI will be updated to prioritize this local path.
- **Pre-Bundled Tor:** The existing `voxvera/resources/tor/` binaries for Linux, Mac, and Windows will be included in every distribution.
- **Universal Language Bundle:** Every `voxvera-portable.zip` will include the full `voxvera/locales/` directory, ensuring that a user who downloads the tool from an English flyer can immediately switch it to Spanish, French, or any other supported language.

### The "Mirror" Workflow:
1. **Build Phase:** When `voxvera build` is executed, it assembles a `voxvera-portable.zip` containing:
    - The full `voxvera/` source code.
    - The `vendor/` library directory.
    - All `locales/*.json` files.
    - Cross-platform Tor binaries.
    - A `voxvera-run.sh` / `voxvera-run.bat` entry point.
2. **Injection:** This ZIP is automatically placed in the `voxvera/host/<folder_name>/download/` directory of the generated flyer.
3. **User Access:** The landing page's "Download" button is updated to explicitly offer the "Full Portable Tool & Source," allowing the recipient to become a new node in the distribution network.

## 6. Documentation (`docs/`)

Documentation will follow a subdirectory structure for maximum compatibility with GitHub/Markdown renderers.

- **Structure:**
  - `docs/en/usage.md`
  - `docs/es/usage.md`
- **Maintenance:** A master English file will serve as the source of truth for all translations.

## 6. Implementation Phases

1. **Phase 1 (Audit):** Extract all hardcoded strings from `cli.py` and `index-master.html` into `en.json`.
2. **Phase 2 (CLI):** Implement the language selector and token loader in `cli.py`.
3. **Phase 3 (Web):** Update the HTML template with `data-i18n` attributes and the JS switcher.
4. **Phase 4 (Build):** Update `build.py` to inject the locale bundle.
5. **Phase 5 (Expansion):** Add a second language (e.g., Spanish) to verify the system.
