# VoxVera

VoxVera is a static, Nostr-powered flyer client.

The active app lives at the site root ([`site/`](site/)). It lets anyone author flyer content, publish it as a public Nostr event, and re-render or reprint the flyer later from a Nostr address or event ID — no application server. The frontend is intentionally self-contained: Nostr relays store the content, and any static host can serve the client.

The previous Tor/OnionShare CLI version is preserved on the `legacy-tor` branch.

## Features

- **Author and publish.** Fill in the flyer fields and publish them as a Nostr `30078` parameterized replaceable event. Republishing with the same flyer name replaces the previous version.
- **Anonymous by default, your identity if you want it.** The editor signs flyers under one of three identities: an **anonymous** per-device key (default, no setup), a **NIP-07 browser extension** (your secret never touches the page), or an **imported `nsec`**. An imported key signs in-memory for the session; tick "Remember on this device" to keep it, encrypted with a PIN (PBKDF2 → AES-GCM) — the plaintext secret is never stored. A short PIN is a convenience lock, not protection against a targeted attacker (see the [spec](docs/nostr-static-client-spec.md#publishing-identity)); the extension path is stronger.
- **Publish confirmation.** After signing and publishing, a modal shows the new flyer's URL to copy, so authors know they're done and where to find it (localized, like everything else).
- **Edit, re-publish, and delete your flyers.** Because flyers are replaceable events, the author can edit one in place (same key + Flyer Name keeps the same URL), re-publish it as a keep-alive so relays don't age it out, or delete it. Delete publishes a replaceable **tombstone** (so VoxVera hides it even where relays ignore deletions) **and** a NIP-09 deletion request — best-effort, author-only.
- **Open from a link or ID.** Load a flyer from an `naddr`, `nevent1`, `note1`, raw 64-char event ID, or `nostr:` URL. The lookup field tolerates copy/paste whitespace and newlines, so an event ID copied off a printed tear-off (where it wraps across two lines) still resolves.
- **Short, scannable poster URLs.** Each poster URL is a standard NIP-19 `naddr` carrying a single relay hint, placed in the URL `#fragment` (no `?addr=` query). Shorter URLs make the tear-off QR code easier to scan. Older relay-list `naddr`s and `?addr=` URLs still resolve.
- **Tear-off tabs.** The printable flyer has ten tear-off tabs. Each tab is a single hyperlinked call to action (the URL is the link, not printed as text) and prints the full event ID so anyone can re-find the flyer by typing it.
- **Loading state on shared links.** Opening a poster/event link shows a localized "Loading content…" placeholder (and a "Could not load this flyer." state on failure) instead of the default flyer; the default sample content appears only on the bare site URL.
- **14 languages with RTL support.** Flyer content and UI are localized; right-to-left scripts render correctly. Letter-spacing is applied per script so cursive (Arabic/Persian) and combining (Devanagari) scripts are not broken — see [the spec](docs/nostr-static-client-spec.md#letter-spacing-by-script).
- **US Letter and A4.** Print size defaults to the right paper for the visitor's country (from the browser locale's region — `en-US` → Letter, `en-GB` → A4, no geolocation), with a manual override. Paper size is a local print preference and is never written into the event. See the [spec](docs/nostr-static-client-spec.md#print-paper-size).
- **Fits-the-page editing.** Fields that would overflow the printable sheet are rejected as you type, with an inline error under the affected field. See the [field length cheat sheet](docs/flyer-field-limits.md) for how much text fits each field per language and paper size.
- **QR codes.** The tear-off QR points at the poster URL (re-open and reprint); the main flyer QR points at the creator's content URL.
- **Bulletin board (members-only, trust-filtered).** A small screen-only link below the flyer preview (outside the printed sheet, never printed) opens a spreadsheet-style page of the most recent flyers found on the relays — title, link, posting npub, language, date, and event ID (with a copy button) — sortable by any column. Viewing the board requires connecting a Nostr identity — via a NIP-07 browser extension, by pasting a private key (`nsec`, decoded in-page and never stored), or by creating a new key (revealed so you can save it). The board then shows only flyers from authors in your **web of trust** (your NIP-02 follow graph), with a "Show all" opt-out. A brand-new key with no follows is seeded from a curated trust anchor so the board is never an unmoderated firehose. On your own flyers the board offers inline **Edit / Re-broadcast / Delete**; on others' it offers a local **Block** (a per-device hide list). Connecting is not required to author or print flyers, which stay fully anonymous. See the [roadmap](docs/roadmap.md) for the phased trust model.
- **Self-contained.** No build step and no CDNs — Nostr and QR libraries are vendored under `site/vendor/`.

## What Is In `main`

- `site/index.html`, `site/nostr-client.js`, `site/nostr-client.css`, `site/locales.js`: static editor/viewer client
- `site/board.html`, `site/board.js`: bulletin-board page listing recent flyers from the relays
- `site/vendor/`: vendored browser dependencies for Nostr and QR generation
- `site/nostr/index.html`: redirect stub so legacy `/nostr/` poster URLs and QR codes still resolve
- `site/CNAME`: custom-domain target
- `voxvera/nostr/`: small Python schema/validation helpers
- `docs/nostr-static-client-spec.md`: design notes and development plan
- `docs/flyer-field-limits.md`: per-language field length cheat sheet
- `docs/roadmap.md`: known issues and future development directions

## Local Development

Run the static site from the repo root:

```bash
python3 -m http.server 8768 --directory site
```

Then open:

```text
http://127.0.0.1:8768/
```

No build command is required for the frontend.

## Vercel

Point Vercel at this repository on `main`.

- Framework preset: Other
- Root directory: repo root
- Build command: leave empty
- Output directory: `site`

The client is served from the domain root (`site/index.html`). `site/nostr/index.html` is a redirect stub that forwards the legacy `/nostr/` path to the root while preserving the query/fragment, so older poster URLs and printed QR codes still resolve.

## Verification

```bash
node --check site/nostr-client.js   # client syntax
pytest -q                           # Nostr source schema
```

### Cross-browser end-to-end tests

[Playwright](https://playwright.dev) smoke tests run the client on Chromium, Firefox, and WebKit (Safari's engine), plus Android/iOS mobile emulations — covering rendering, the `@media print` path, WebCrypto key generation, the `/nostr/` redirect, and the loading state.

```bash
npm install
npx playwright install     # download the browser engines
npm run test:e2e
```

See [`e2e/README.md`](e2e/README.md) for per-engine coverage and the one-time Linux step for WebKit (`sudo npx playwright install-deps`).

The Python tests only cover the Nostr source schema. The frontend is static; the Playwright suite covers engine behavior, but real Safari/iOS print and clipboard behavior is still worth a manual pass before a release.

## License

MIT (c) 2026 thePR0M3TH3AN
