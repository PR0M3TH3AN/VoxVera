# VoxVera

**Anonymous Information Distribution Engine**

Generate printable flyers with QR codes linking to Tor (.onion) hidden services. VoxVera is built for activists, journalists, and anyone who needs to spread a message securely and anonymously.

---

## Installation

VoxVera is designed for maximum portability and censorship resistance.

### 1. Standalone Binaries (Recommended)
Download the zero-dependency executable for your OS:
- 🐧 [**Linux**](https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera-linux)
- 🪟 [**Windows**](https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera-windows.exe)
- 🍏 [**macOS**](https://github.com/PR0M3TH3AN/VoxVera/releases/latest/download/voxvera-macos)

### 2. Universal Mirroring (The "Viral" Method)
If you found a physical VoxVera flyer, scan it and click **"Download Tool & Source"**. You will receive a `voxvera-portable.zip` containing the full tool, all dependencies, and all 14 languages—ready to run offline.

### 3. One-Line Installer (Linux/macOS)
```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 4. Developer / Python Install
```bash
pip install .
voxvera vendorize  # Optional: pull dependencies locally for offline use
```

---

## Key Features

*   **Universal Mirroring**: Every flyer acts as a mirror for the tool itself. The "Download" button provides a portable version of VoxVera, creating a decentralized distribution network.
*   **Standalone Binaries**: Zero-install executables for high-security environments.
*   **Global Multi-Script Support**: Native support for 14 languages including **Arabic (RTL)**, **Hebrew (RTL)**, **Hindi (Devanagari)**, **Japanese/Chinese (CJK)**, and **Russian (Cyrillic)**.
*   **Tor-Safe Architecture**: 100% static HTML flyers. Works perfectly in Tor "Safest" mode with **JavaScript completely disabled**.
*   **Integrated Server Manager**: `voxvera manage` provides an interactive UI to handle multiple flyers, monitor Tor bootstrapping, and manage persistent .onion URLs.
*   **Secure Migration**: Bulk export and import of flyers and their unique Tor identity keys via `~/voxvera-exports/`.

---

## Documentation

VoxVera is available in multiple languages. Select your preferred language for the detailed usage guide:

| Language | Documentation | Contributing | Agent Guide |
| :--- | :--- | :--- | :--- |
| 🇺🇸 **English** | [usage.md](docs/en/usage.md) | [CONTRIBUTING.md](docs/en/CONTRIBUTING.md) | [AGENTS.md](docs/en/AGENTS.md) |
| 🇪🇸 **Español** | [usage.md](docs/es/usage.md) | [CONTRIBUTING.md](docs/es/CONTRIBUTING.md) | [AGENTS.md](docs/es/AGENTS.md) |
| 🇩🇪 **Deutsch** | [usage.md](docs/de/usage.md) | [CONTRIBUTING.md](docs/de/CONTRIBUTING.md) | [AGENTS.md](docs/de/AGENTS.md) |
| 🇫🇷 **Français** | [usage.md](docs/fr/usage.md) | [CONTRIBUTING.md](docs/fr/CONTRIBUTING.md) | [AGENTS.md](docs/fr/AGENTS.md) |
| 🇷🇺 **Русский** | [usage.md](docs/ru/usage.md) | [CONTRIBUTING.md](docs/ru/CONTRIBUTING.md) | [AGENTS.md](docs/ru/AGENTS.md) |
| 🇮🇱 **עברית** | [usage.md](docs/he/usage.md) | [CONTRIBUTING.md](docs/he/CONTRIBUTING.md) | [AGENTS.md](docs/he/AGENTS.md) |
| 🇸🇦 **العربية** | [usage.md](docs/ar/usage.md) | [CONTRIBUTING.md](docs/ar/CONTRIBUTING.md) | [AGENTS.md](docs/ar/AGENTS.md) |
| 🇯🇵 **日本語** | [usage.md](docs/ja/usage.md) | [CONTRIBUTING.md](docs/ja/CONTRIBUTING.md) | [AGENTS.md](docs/ja/AGENTS.md) |
| 🇮🇳 **हिन्दी** | [usage.md](docs/hi/usage.md) | [CONTRIBUTING.md](docs/hi/CONTRIBUTING.md) | [AGENTS.md](docs/hi/AGENTS.md) |
| 🇰🇪 **Kiswahili** | [usage.md](docs/sw/usage.md) | [CONTRIBUTING.md](docs/sw/CONTRIBUTING.md) | [AGENTS.md](docs/sw/AGENTS.md) |

---

## Roadmap (v0.2.0)

We are actively working on:
- **PGP Signing**: Cryptographic proof of tool integrity.
- **Nostr Integration**: Automated social amplification.
- **Template Gallery**: Visual styles for protests, alerts, and art.
- **Self-Healing Network**: Automated decentralized updates.

See [ROADMAP-v0.2.0.md](docs/roadmap-v0.2.0.md) for details.

---

## License

MIT (c) 2026 thePR0M3TH3AN
