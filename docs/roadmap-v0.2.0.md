# VoxVera Roadmap & Technical Specification (v0.2.0)

This document outlines the next major evolution of the VoxVera project, focusing on trust, social amplification, visual versatility, and network resilience.

---

## 1. Integrity & Trust (PGP Signing)
**Goal:** Provide cryptographic proof that the `voxvera-portable.zip` provided by a flyer has not been tampered with by the hoster.

### Technical Requirements
- **CLI:** Add `voxvera sign <folder_name>` command.
- **Dependency:** Use a lightweight PGP implementation (e.g., `python-gnupg` or `pgpy`) to sign the portable ZIP.
- **Storage:** Generate a `.sig` or `.asc` file alongside the ZIP in the `download/` folder.
- **Web:** The landing page will look for `voxvera-portable.zip.asc`. If found, a **"Verified Source"** badge with the signer's Fingerprint will appear next to the download button.

### Implementation Phases
1. **Phase 1:** Add PGP key generation/import logic to `voxvera init`.
2. **Phase 2:** Update `build_assets` to optionally sign the generated ZIP.
3. **Phase 3:** Update `index-master.html` to display verification status.

---

## 2. Nostr Integration (Social Amplification)
**Goal:** Bridge the physical world (flyers) with the decentralized digital world (Nostr) by automatically broadcasting live .onion sites.

### Technical Requirements
- **CLI:** Add `voxvera serve --nostr` flag.
- **Workflow:** When a site goes live and the `.onion` URL is generated, the tool posts a "Flyer Event" to a list of configured Nostr relays.
- **Identity:** Users can provide an existing NSEC or have VoxVera generate a "Flyer Identity" (new NPUB) for that specific server.
- **Metadata:** Include tags for the flyer title, headline, and the `.onion` link.

### Implementation Phases
1. **Phase 1:** Add `nostr` and `bech32` to the `vendor/` directory.
2. **Phase 2:** Implement a background broadcast thread in `serve()`.
3. **Phase 3:** Add "View on Nostr" links to the flyer footer.

---

## 3. The "Tear-off" Designer (Template Gallery)
**Goal:** Expand the utility of VoxVera to new use cases like missing person alerts, protest organizing, and artistic distribution.

### Technical Requirements
- **Restructuring:** Move from a single `voxvera` template to a category-based system:
    - `/templates/default/` (The original Operation VoxVera style)
    - `/templates/minimal/` (Clean, text-heavy)
    - `/templates/alert/` (High-contrast, for emergencies)
    - `/templates/art/` (Image-focused)
- **CLI:** Update `voxvera init` to include a visual description and selector for templates.

### Implementation Phases
1. **Phase 1:** Refactor `copy_template` to support categories.
2. **Phase 2:** Design and implement 3 new HTML/CSS templates.
3. **Phase 3:** Allow templates to define their own custom character limits (e.g., "Alert" might allow larger headlines).

---

## 4. Self-Healing Network (Update Logic)
**Goal:** Ensure the decentralized "Viral" network stays current with security fixes and features.

### Technical Requirements
- **Discovery:** The tool will check a "Source of Truth" (e.g., `voxvera.org/version.json` or a hardcoded list of onion mirrors).
- **Notification:** `voxvera manage` will show a 🌟 or ⚠️ next to the version number if an update is available.
- **Update Workflow:** Provide a `voxvera update` command that downloads the latest `voxvera-portable.zip` and safely replaces the `vendor/` and `voxvera/` directories.

### Implementation Phases
1. **Phase 1:** Implement version-checking logic via Tor SOCKS proxy.
2. **Phase 2:** Add update notifications to the management menu.
3. **Phase 3:** (Advanced) Implement "In-Place" updates for the vendored dependencies.

---

## 5. GUI Modernization
**Goal:** Transition the Electron wrapper from a CLI mirror to a rich, visual dashboard.

### Technical Requirements
- **Flyer Cards:** Replace the text list with visual "cards" showing the flyer's headline and a mini QR preview.
- **Tor Dashboard:** A dedicated tab showing all active hidden services, their uptime, and their `.onion` links.
- **One-Click Actions:** Visual buttons for "Export All," "Start All," and "New Flyer."
- **Direct Log Stream:** A collapsible panel to see the OnionShare logs in real-time.

### Implementation Phases
1. **Phase 1:** Update the IPC bridge between Electron and the Python CLI.
2. **Phase 2:** Redesign the frontend using a modern, dark-themed CSS framework (keeping it local-first).
3. **Phase 3:** Add a "Theme Preview" during the flyer creation process.

---

## Summary of Impact
By completing this roadmap, VoxVera moves from a standalone utility to a **Decentralized Information Ecosystem**. 
- **Security** is solved via PGP.
- **Reach** is solved via Nostr.
- **Versatility** is solved via the Template Gallery.
- **Sustainability** is solved via Update Logic.
