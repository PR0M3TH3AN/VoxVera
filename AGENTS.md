# AI Agent Instructions For VoxVera

`main` is the Nostr static-client branch. The old Tor/OnionShare CLI application is preserved on `legacy-tor`.

## Current Architecture

- Active frontend: `site/` (`index.html`, `nostr-client.js`, `nostr-client.css`, `locales.js`)
- Static deployment root: `site`
- Browser dependencies: vendored under `site/vendor/`
- Legacy path: `site/nostr/index.html` is a redirect stub forwarding old `/nostr/` poster URLs and QR codes to the root
- Python helper package: `voxvera/nostr/`
- Design plan: `docs/nostr-static-client-spec.md`

## Guardrails

- Do not reintroduce the legacy Tor CLI, OnionShare runtime, installer, Electron manager, bundled Tor binaries, generated old flyer site, or packaging workflows on `main`.
- Keep the Nostr client static and host-agnostic.
- Do not load frontend dependencies from CDNs.
- Treat Nostr event content as untrusted. Escape rendered content and reject unsafe schema input.
- Preserve print behavior: app controls must not print or shift the flyer sheet in print output.
- Preserve the old flyer visual language unless the user explicitly asks for a redesign.
- Paper size (US Letter / A4) is a local print/view preference (`localStorage`), defaulted from the browser locale region. Never write it into the Nostr event — a flyer must reprint on either size without changing the source event.

## Localization

- Use `site/locales.js` for flyer content defaults.
- Use `NOSTR_UI` in `site/nostr-client.js` for editor/viewer controls and Nostr-specific labels.
- Add translations for every supported language when adding user-facing strings.
- Check right-to-left languages when touching layout.

## Verification

Run:

```bash
node --check site/nostr-client.js
pytest -q
```

For visual or print changes, also run a local static server and inspect the site root (`/`) in a browser.

Cross-browser end-to-end tests live in `e2e/` (Playwright; Chromium, Firefox, WebKit, plus mobile emulations). Run them after changes that touch rendering, print, key generation, URL/redirect handling, or the loading state:

```bash
npm install && npx playwright install
npm run test:e2e
```

WebKit/Safari on Linux needs `sudo npx playwright install-deps` once. See `e2e/README.md`. Test tooling is a dev dependency only — it must not pull runtime frontend dependencies from CDNs or otherwise weaken the static, host-agnostic client.
