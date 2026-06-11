# VoxVera Nostr Static Client Spec

Status: `main` is the Nostr static-client branch. The legacy Tor/OnionShare CLI version is preserved on `legacy-tor`.

## Goal

VoxVera should let anyone publish, fetch, and print flyer content without a centralized application server.

The static client is responsible for:

- rendering the flyer
- generating QR codes
- authoring a normalized Nostr flyer payload
- generating anonymous browser-side Nostr keys
- signing and publishing replaceable Nostr events
- fetching events by raw event ID, `note1`, `nevent1`, or `naddr`
- rendering fetched content safely

Nostr relays store the flyer source content. Static hosts only serve the client.

## Active Files

```text
site/
  index.html          (the client)
  nostr-client.css
  nostr-client.js
  locales.js
  board.html          (bulletin board page)
  board.js
  favicon.svg         (inline SVG site icon)
  CNAME
  vendor/
    nostr-tools/
    qrcode-generator/
  nostr/
    index.html        (redirect stub for legacy /nostr/ URLs)
voxvera/
  nostr/
    schema.py
tests/
  test_nostr_schema.py
```

## Deployment

The deployable static root is `site`.

No build command is required. Vercel should use:

- root directory: repository root
- output directory: `site`
- build command: empty

The client is served from the root (`site/index.html`). `site/nostr/index.html` is a redirect stub that forwards the legacy `/nostr/` path to the root, preserving the query string and `#naddr` fragment, so poster URLs and QR codes printed before the move still resolve.

## Event Model

Recommended event kind: `30078` parameterized replaceable event.

Required tags:

- `["d", "voxvera:<slug>"]`
- `["t", "voxvera"]`
- `["t", "flyer"]`

Recommended language tags:

- `["language", "<lang>"]`
- `["L", "ISO-639-1"]`
- `["l", "<lang>", "ISO-639-1"]`

The payload `lang` field is authoritative. The language tags exist for relay/search metadata and as a fallback for older events whose payload omitted `lang`.

Payload:

```json
{
  "type": "voxvera_flyer",
  "version": 1,
  "folder_name": "voxvera",
  "name": "Vox Vera Printable Flyers",
  "lang": "en",
  "title": "OPERATION VOX VERA",
  "subtitle": "DO ~~NOT~~ DISTRIBUTE",
  "headline": "TOP SECRET",
  "content": "Flyer body text",
  "url_message": "Follow this link to learn more.",
  "url": "https://creator.example/action",
  "tear_off_link": "https://voxvera.org/nostr/#naddr1...",
  "footer_message": "0110010",
  "qr_target": "flyer_url"
}
```

The UI labels `folder_name` as `Flyer Name`; it acts as the event slug, not a local hosting folder.

## QR Target

Default behavior: `qr_target: "flyer_url"`.

`url` is always the creator-controlled content destination shown in the body of the flyer. The editor must not overwrite this field with generated app URLs.

When publishing, the client computes the replaceable-event `naddr` and writes the generated poster URL to `tear_off_link`. The tear-off tabs and tear-off QR code point at `tear_off_link`, so people can re-open and reprint the flyer. The main flyer QR code points at `url`, so viewers can visit the creator's intended destination.

Each tear-off tab is labeled with the flyer's **title** (`.tear-off-title`, auto-sized by `fitTabTitles()` to be as large as fits the ~1in tab, shrinking rather than overflowing for long titles), a clickable **"Open & reprint this flyer"** link (`tab_link`, the `<a href>` so it stays live in a printed PDF), the tear-off QR, and a **"Reopen at VoxVera.org — Event ID:"** line (`tab_event_id`, the brand stays Latin; the rest is localized) with the full event id. All strings are translated in every supported language.

The `naddr` is encoded with a **single relay hint** (the primary configured relay) instead of the full relay list. This keeps the poster URL short and its tear-off QR code easy to scan — a typical poster URL drops from ~233 characters (full list) to ~171 — while still pointing a fresh viewer at a relay that has the event. Viewers also fall back to `DEFAULT_RELAYS`, which is where flyers are published by default. This stays a standard NIP-19 `naddr`, so any Nostr client can resolve it, and older relay-bearing `naddr` URLs continue to decode and resolve unchanged.

The naddr is carried in the URL **fragment** (`#naddr1...`) rather than a `?addr=` query parameter. The fragment is shorter (less QR clutter), needs no URL-encoding, and never reaches the static host. `getUrlEventReference` reads the naddr from query params, the fragment, or anywhere in the full URL, so older `?addr=` poster URLs and printed QR codes still resolve.

Supported values:

- `flyer_url`: tear-off QR points to the hosted client URL for the poster
- `content_url`: QR points to the payload's content URL
- `nostr_event`: QR points to the Nostr source identifier when available

## Safety

Nostr content is untrusted.

The client and schema helper must:

- reject raw HTML in flyer text fields
- escape rendered flyer content
- reject unsafe URL schemes such as `javascript:` and `data:`
- keep attachments unsupported in V1
- avoid remote frontend dependencies

## Publishing identity

The editor signs flyer events under one of four identities, chosen in the
identity controls (`activeIdentity` / `signActiveEvent` in `nostr-client.js`):

- **Anonymous (default).** The per-device key in `localStorage`
  (`voxvera_nostr_anon_secret_hex`); signs locally with `finalizeEvent`.
  Unchanged behavior — no connection required. "Generate anonymous npub" rolls a
  fresh device key.
- **Browser extension (NIP-07).** Signs via `window.nostr.signEvent`; the secret
  never enters the page. The pubkey is fetched with `getPublicKey()`.
- **Private key (nsec).** The user pastes an `nsec`; it is decoded to a secret
  key used to sign with `finalizeEvent`. By default the secret lives **only in
  memory** for the session. If the user ticks "Remember on this device", the
  secret is encrypted with a PIN and stored as `voxvera_identity_nsec_enc`; the
  plaintext secret is never written to storage.
- **Remote signer (NIP-46 / bunker).** The user pastes a `bunker://` link from a
  signer app (nsec.app, Amber, …). The client mints an **ephemeral** local key,
  connects to the bunker relay over a raw WebSocket, and exchanges encrypted
  kind-`24133` JSON-RPC requests (`connect` → `get_public_key` → `sign_event`).
  The user's real secret never reaches the browser. Requests are encrypted with
  **NIP-44** (with a NIP-04 decrypt fallback for older signers); the vendored
  nostr-tools bundle has no nip46 module, so this client is hand-rolled. The
  connection is **session-only** — the bunker token is never persisted, so a
  reload returns to anonymous.

The chosen mode is remembered in `voxvera_identity_mode` (and the npub in
`voxvera_identity_npub` for display). On reload: NIP-07 re-fetches the pubkey;
a remembered nsec shows a **locked** state until the PIN is entered (`unlock`);
a session-only nsec or a remote-signer session falls back to anonymous.
`naddr`/poster-URL/`author npub` outputs all reflect the active identity. A
deliberate identity choice is also mirrored to `voxvera_connected_pubkey` so the
bulletin board reflects the same identity.

**PIN encryption details.** PBKDF2 (`SHA-256`, 600k iterations, random 16-byte
salt) derives an AES-GCM-256 key (random 12-byte IV); the blob stores
`{v, iters, salt, iv, ct}` base64. A minimum 4-digit numeric PIN is enforced,
but longer PINs are allowed and encouraged.

> **Security caveat (documented deliberately).** A short numeric PIN has a tiny
> keyspace (a 4-digit PIN is ~10,000 combinations), so if the encrypted blob is
> exfiltrated (targeted XSS, or devtools access on a shared/stolen device) it is
> brute-forceable offline regardless of PBKDF2 cost. PIN-at-rest protects against
> casual snooping and untargeted localStorage scraping, **not** a determined or
> targeted attacker. The NIP-07 extension path (secret never in the page) and the
> NIP-46 remote signer (secret stays in the signer app; the browser holds only an
> ephemeral key — paste a `bunker://` link) are the stronger options. See
> [`roadmap.md`](roadmap.md).

## Editing, re-publishing, and deleting flyers

Because flyers are addressable replaceable events (`kind 30078`, identified by
`(pubkey, d)` where `d = voxvera:<slug>`), the author can manage a published
flyer by re-publishing under the same key + Flyer Name. When a flyer is loaded
from an event, the editor shows author-only actions (`#loaded-flyer-actions`):

- **Edit** — change fields and publish again; the same `d` tag replaces the
  prior version in place, keeping the same `naddr`/poster URL.
- **Re-publish (keep-alive)** — re-sign and re-broadcast the current content so
  relays that prune app-data don't age the flyer out (`republishCurrentFlyer`).
- **Delete** (`deleteLoadedFlyer`) — two layers, for robustness across relays:
  1. a **replaceable tombstone** (`buildTombstoneEvent`) — same `(kind, d)`, with
     `deleted: true` in the payload and a `["deleted"]` tag, so it *overwrites*
     the flyer's content; relays honoring replaceable semantics now serve the
     tombstone, and
  2. a **NIP-09 deletion request** (`buildDeletionEvent`, kind `5`) referencing
     the addressable `a` tag (`30078:<pubkey>:voxvera:<slug>`) and the event id,
     asking relays to drop it entirely.

All three are **author-only**: the active signing key must match the loaded
flyer's author (`resolveActivePubkey`), and `signAndPublish` refuses to publish
if the signed key diverges from the address. **Tombstone recognition:** the
board's `parseFlyers` keeps the newest event per `(pubkey, d)` and skips it if
that newest version is a tombstone (so a delete can't be undone by an older copy
arriving later); the viewer shows a localized "This flyer was removed." state
(`isFlyerTombstone`). Deletion is **best-effort** — relays that ignore both
replaceable overwrites and NIP-09 may still serve the original — so it is framed
as a request, not a guarantee.

## Importing and exporting a flyer design

The editor can save and load a flyer **design** as a portable `.json` file
(`Export design` / `Import design`), independent of publishing. The file format
is `{ type: "voxvera_flyer_design", version: 1, flyer: <payload>, relays: [] }`,
where `flyer` is exactly `rawPayloadFromForm()` — the content fields plus the
relay list, and **nothing identity-bound**: no npub, `naddr`, event id, or
signature (all of those are derived at publish time by `withPosterUrl` /
`signAndPublish`). That makes a design portable: it can be handed to anyone and
published under *their* key with a fresh address.

- **Export** (`exportDesign`) serializes the current form as-is (draft-friendly,
  no strict validation) and downloads `<folder_name>-voxvera-design.json`.
- **Import** (`importDesignFromFile`) reads the picked file (capped at 256 KB),
  `JSON.parse`s it, and accepts either the wrapper format or a bare
  `voxvera_flyer` payload (`readDesignFile`, lenient). It then shows a **confirm
  modal** (`#import-modal`) before overwriting the editor, and on confirm
  (`applyPendingImport`) fills the form via `fillEditorFromConfig` and restores
  the relay list. Imported content is untrusted, but it flows through the lenient
  view path (the renderer escapes every field) and still faces strict
  `validatePayload` at publish (raw-HTML rejection, length caps, URL schemes).

This replaced the earlier raw "Export event JSON" button; the published
(signed) event JSON is still shown in `#event-json-output` after a publish.

## Print paper size

The flyer supports two print sizes: **US Letter** (8.5×11in) and **A4**
(210×297mm), covering every country whose language the client supports (Letter
in North America and a few Latin American countries; A4 everywhere else,
including the EU, Russia, China, Japan, and the Middle East).

- Dimensions live in CSS custom properties `--sheet-w` / `--sheet-h`, switched
  by a `paper-letter` / `paper-a4` class on `<html>` (`applyPaperSize` in
  `nostr-client.js`). The tear-off column (`3.75in`) and QR codes (`1.25in`)
  stay fixed physical sizes; the content column flexes to the sheet width.
- The print `@page { size: … }` is injected by JS (an element with id
  `voxvera-page-size`), because `@page size` cannot read CSS custom properties
  across engines. The static `@media print` block keeps `margin: 0` and a
  Letter default for the pre-JS state.
- The default is chosen from the **region subtag** of the browser locale
  (`preferredPaperSize` — e.g. `en-GB` → A4, `en-US` → Letter). This is "by
  location" without geolocation, using the same signal as language. When no
  locale carries a region, it falls back to Letter.
- A user override (the paper-size selector) is stored in `localStorage`
  (`voxvera_paper`) and wins over the region default.
- **Paper size is a local print/view preference and is never written into the
  Nostr event.** A flyer authored on Letter reprints on A4 for a European
  viewer without changing the source event. The live fit-check protects
  authoring on whichever size is active; switching to a narrower size after
  authoring can ellipsis-truncate a maxed-out single-line field.

Field capacity therefore varies by paper size; see
[`flyer-field-limits.md`](flyer-field-limits.md).

## Bulletin board

`site/board.html` + `site/board.js` are a standalone page that lists the most
recent flyers found on the default relays as a sortable, spreadsheet-style
table: **title**, **link** (the poster URL, rendered as the word "link"),
**posting npub**, **language**, **posted date**, and the **event ID** (shown
shortened, full value in the title attribute, with a per-row copy button). Any
column header sorts (default is date descending); replaceable events are
de-duplicated per author+`d` identifier, keeping the latest.

- The entry point is a small screen-only link below the flyer preview
  (`.board-link`, label `bulletin_board`), outside the printable sheet. It must
  never print (hidden in the `@media print` block alongside the other app
  chrome).
- **The board is gated behind a connected Nostr identity.** On load it shows a
  login gate (`#board-gate`) instead of the table, with four ways to connect:
  a **NIP-07** extension (`window.nostr.getPublicKey()`), a **NIP-46 remote
  signer** (paste a `bunker://` link; same hand-rolled client as the editor —
  it establishes the viewer pubkey via `get_public_key` and keeps the connection
  so `getBoardSigner` can sign reports/deletes remotely this session, then falls
  back to read-only after a reload), **pasting an `nsec`** (decoded in-page to
  derive the pubkey, then discarded — the secret is never stored or transmitted),
  or **creating a new key** (reuses this device's anon key in
  `voxvera_nostr_anon_secret_hex` if present, else generates one, and reveals the
  `nsec` with a save-it warning before continuing). On success it reveals the
  table and surfaces the connected npub (`#board-identity`) with a Disconnect
  control. The board only ever needs the *pubkey* to view (it reads to filter),
  so the connected pubkey is remembered in `localStorage`
  (`voxvera_connected_pubkey`, shared with the main client) and a return visit
  reconnects from it directly — no prompt or re-entry, any method. This is
  **not access control** — the events are public on the relays regardless — it
  establishes the *viewer's* identity for the web-of-trust filter below.
  Authoring and printing flyers stays fully anonymous and never requires
  connecting.
- **Web-of-trust filter (NIP-02).** Once connected, the board fetches the
  viewer's contact list (kind 3) and defaults to showing only flyers whose
  author is in the viewer's follow graph (degree 1) plus the viewer themself. A
  **"Show all"** checkbox opts out to the full relay firehose. A viewer with no
  follow list of their own (a fresh key) is **seeded** from a pinned curator
  account's follows (`FALLBACK_CURATOR_PUBKEY` in `board.js`), so a brand-new
  viewer still gets a curated board. If no trust data can be fetched at all, the
  board falls back to showing everything so it is never mysteriously empty. The
  `#board-filter-note` explains which mode is active (following / seeded / all),
  and re-localizes with the language selector. See [`roadmap.md`](roadmap.md)
  for the phased plan (Phase 1 = the gate; Phase 2 = this filter; Phase 3 =
  degree-2 trust, blocklist/report, NIP-05 badges).
- `board.js` is independent of `nostr-client.js` (which exports nothing), so its
  UI strings live in `BOARD_UI` (all supported languages); it reuses the
  vendored nostr-tools and `locales.js` (for language names + RTL direction).
- The board has its own language selector. It reads/writes the same
  `voxvera_nostr_lang` localStorage key as the main client, so the chosen
  language carries across both pages, and switching it re-localizes the chrome,
  column headers, language labels, and date formatting (and flips RTL).
- Relay content is untrusted: titles and npubs are escaped, and link URLs are
  rejected unless `http:`/`https:` (so `javascript:`/`data:` never render as a
  link).
- The npub column is forward-looking — anonymous keys today, but a stable
  identity per author maps cleanly onto this view later.
- **Per-row actions** (behind a per-row **⋯ menu**). On flyers the connected
  viewer authored, the menu offers
  **Edit** (a link to `/?edit=1#<naddr>`, which loads the flyer in the editor),
  **Re-broadcast** (re-sends the already-signed event to all relays — no signing
  needed), and **Delete** (tombstone + NIP-09; the board signs via the device
  key or NIP-07, and for a pasted-nsec connection it points to the editor). On
  flyers from others it shows **Block** — a per-device blocklist of author
  pubkeys (`voxvera_blocked_pubkeys`) that always hides them, with a "Clear
  blocked" control. The blocklist is local "hide this," separate from the
  web-of-trust filter (roadmap #1).
- **Narrow screens (≤640px):** the table collapses to a card per flyer — the
  **title** and the **⋯ menu** stay visible, and the secondary fields (link,
  posted-by, language, date, event id) sit behind a per-row **Details**
  disclosure (`.board-details-toggle` toggles `tr.expanded`; the columns become
  labeled rows via their `data-label`).

On mobile the flyer preview scales to fully fit the screen width
(`updatePreviewScale` / `--flyer-preview-scale`): the sheet keeps its true print
width (`flex: 0 0 auto`, so the viewer-mode flexbox doesn't shrink it) and is
visually scaled with a transform — so it never side-scrolls or clips.

The login gate (Phase 1) and the web-of-trust filter (Phase 2) are in place.
Remaining gaps — degree-2 trust, a blocklist/report flow, NIP-05 badges, and
making the bootstrap curator configurable — are tracked in
[`roadmap.md`](roadmap.md).

## Localization

Flyer defaults come from `site/locales.js`.

Nostr editor/viewer controls and Nostr-specific flyer labels come from `NOSTR_UI` in `site/nostr-client.js`.

Language changes should:

- publish the selected flyer language in payload `lang`
- publish matching Nostr language tags
- infer language from event tags if a fetched payload omits `lang`
- update default flyer content while the flyer is still using default content
- preserve user-authored or fetched event content
- update editor/viewer tool labels
- update printed side-tab labels
- respect RTL direction metadata

### Letter-spacing by script

Flyer text uses tighter letter-spacing than the original design to fit more
characters per line, but `letter-spacing` is not script-neutral, so it is
applied per script via a policy class on the flyer `.container`
(`LETTER_SPACING_POLICY` in `nostr-client.js`; `ls-full` / `ls-cjk` / `ls-none`
rules and `--ls-*` variables in `nostr-client.css`):

- `full` — Latin, Cyrillic, Hebrew: reduced positive tracking on the display
  fields plus a slight negative on body/URL to reclaim line width.
- `cjk` — Japanese, Chinese: tracking is clamped to `0` and never negative, so
  full-width glyphs do not overlap.
- `none` — Arabic, Persian, Hindi: letter-spacing is turned off entirely. These
  are cursive or complex scripts where any tracking breaks the letter joins or
  detaches combining marks. (This also corrected the prior behavior, which
  applied the design's display tracking to every language unconditionally.)

When adding a language, classify its script in `LETTER_SPACING_POLICY` (default
is `full`) and verify the headline, subtitle, and body render correctly in the
browser.

## Verification

```bash
node --check site/nostr-client.js
pytest -q
```

For UI work, also verify browser rendering and print output from a local static server.
