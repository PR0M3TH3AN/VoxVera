# VoxVera Nostr Static Client Spec

Status: Phase 1 CLI import implemented for local event JSON files. A first static Editor/Viewer client exists under `site/nostr/`; relay publish/fetch uses browser WebSockets. Viewer mode is flyer-first and keeps Nostr controls hidden behind a small drawer toggle. Browser-side QR generation is implemented with a vendored local QR library. Browser-side anonymous key generation/signing is implemented with a vendored Nostr library, so publishing does not require a NIP-07 login. Independent browser-side signature verification before accepting fetched events is pending.

Branch: `nostr-static-client`

## Purpose

Build a Nostr-powered VoxVera mode where public Nostr events store flyer content and any static/offline VoxVera client can fetch, validate, and render that content into the existing VoxVera flyer.

The generated flyer frontend must remain visually and behaviorally identical to the current VoxVera flyer. Nostr is an input/source layer, not a redesign.

## Core Principle

```text
Nostr event -> validate -> normalize to existing config.json -> existing VoxVera build/render path
```

The existing flyer template, QR layout, tear-off layout, typography, print behavior, download behavior, and Tor-safe static output stay unchanged.

## Goals

- Let anyone host the VoxVera client as static files, over the web, Tor, IPFS, local disk, USB drive, or other mirrors.
- Let Nostr relays store the flyer content as public events.
- Let the client fetch a VoxVera flyer event by `naddr`, `note1`, `nevent1`, raw event ID, or URL fragment.
- Let the CLI import/build/serve a Nostr-backed flyer without changing the generated flyer frontend.
- Generate QR codes locally from validated content.
- Keep the default QR behavior aligned with current VoxVera: QR points to the generated flyer URL unless explicitly configured otherwise.
- Support fully offline rendering once a Nostr event payload has been exported or cached.

## Non-Goals For V1

- No redesign of `index-master.html`.
- No new visual style for the flyer.
- No server-side backend.
- No custody of user-managed Nostr keys.
- No required login or NIP-07 signer.
- No private/encrypted Nostr events.
- No remote images, fonts, scripts, CSS, CDNs, analytics, or trackers.
- No raw HTML injection from Nostr content.
- No dependency on a single relay.

## User Flows

### Static Client Flow

1. User opens a static VoxVera client.
2. User pastes a `naddr`, `note1`, `nevent1`, raw event ID, or URL containing one.
3. Client chooses relays from the identifier, user settings, or defaults.
4. Client fetches the event.
5. Client validates the event as a VoxVera flyer source.
6. Client normalizes content into the existing VoxVera config schema.
7. Client renders the existing flyer UI and generates QR codes locally.
8. User prints, exports, saves, or hosts the generated flyer.

Viewer mode must default to the rendered flyer, not the editor shell. Header text, event forms, normalized config JSON, and other loader UI stay hidden unless the user opens the viewer controls drawer. Printing from viewer mode must target only the 8.5x11 flyer surface.

Viewer mode must auto-load content when the URL includes an event reference. Supported forms include:

- `?addr=<naddr>`
- `?event=<raw-id-or-note1-or-nevent1-or-naddr>`
- `?id=<raw-64-character-event-id>`
- `#viewer/<raw-id-or-note1-or-nevent1-or-naddr>`
- pasted `nostr:note1...`, `nostr:nevent1...`, or `nostr:naddr...` values in the viewer lookup tool

The manual viewer lookup tool must accept the same raw ID, `note1`, `nevent1`, `naddr`, and `nostr:` values. `nevent1` and `naddr` relay hints should be merged with the default/user relay list.

The canonical poster URL should use `naddr`, not the raw event ID, because the flyer itself needs to include a URL that resolves back to the poster. Raw event IDs are hashes of the final event payload, so embedding a raw event-ID URL in the same event creates a circular dependency. A `naddr` is stable because it is derived from author pubkey, kind `30078`, and the `d` tag.

### CLI Flow

```bash
voxvera nostr import <note-or-nevent>
voxvera nostr build <note-or-nevent>
voxvera nostr serve <note-or-nevent>
```

Expected behavior:

- `import` writes a normal site folder under `~/host/<folder_name>/` with a standard `config.json`.
- `build` imports and builds the flyer assets.
- `serve` imports, builds, and runs the existing OnionShare hosting path.

The CLI should preserve the current config/build/serve contract so Nostr flyers can be exported, imported, and mirrored by existing VoxVera mechanisms.

## Event Format

V1 should use a deterministic JSON payload in event `content`.

Recommended Nostr event kind for prototype: `30078` parameterized replaceable event, with a `d` tag.

Rationale:

- It avoids inventing a custom kind before the format proves itself.
- It allows stable named flyer records per author.
- It can later be migrated to a dedicated custom kind if needed.

Required tags:

```json
[
  ["d", "voxvera:<slug-or-id>"],
  ["t", "voxvera"],
  ["t", "flyer"]
]
```

Optional tags:

```json
[
  ["title", "OPERATION VOX VERA"],
  ["language", "en"],
  ["subject", "censorship"],
  ["relay", "wss://relay.example.org"]
]
```

Content schema:

```json
{
  "type": "voxvera_flyer",
  "version": 1,
  "folder_name": "voxvera",
  "lang": "en",
  "name": "Vox Vera Printable Flyers",
  "title": "TOP SECRET",
  "subtitle": "DO ~~NOT~~ DISTRIBUTE",
  "headline": "OPERATION VOX VERA",
  "content": "Main flyer text.",
  "url_message": "Follow this link to learn more.",
  "url": "https://example.com/",
  "footer_message": "0110010 0101011 0110010 0111101 0110100",
  "attachment_path": "",
  "attachment_filename": "",
  "qr_target": "flyer_url"
}
```

`folder_name` remains the internal compatibility key for the existing VoxVera config/build path, but the static Nostr editor should label this field as `Flyer Name`. In Nostr mode it acts as the stable flyer slug used in the replaceable event `d` tag, not as a local Tor hosting folder name.

Allowed `qr_target` values:

- `flyer_url`: default; current VoxVera behavior.
- `nostr_event`: QR points to the source Nostr identifier.
- `content_url`: QR points to the `url` field.

The static Nostr editor should default to `flyer_url`, where the flyer URL is the hosted client URL with `?addr=<naddr>`. That avoids the raw event-ID circular dependency and lets a re-published replaceable event keep the same printed flyer URL.

## Normalization Rules

The importer maps the Nostr payload to the existing `config.json` schema.

Rules:

- Missing optional fields use current VoxVera defaults.
- Unknown fields are ignored unless explicitly preserved in metadata.
- `folder_name` / editor `Flyer Name` must be slug-safe and length-limited.
- `lang` must be one of the supported locale keys or fall back to `en`.
- Text fields must be strings, not arrays or objects.
- Text fields must have length limits.
- URLs must be validated before use.
- Attachments are disabled for V1 unless represented as ordinary links.
- The normalized config must be buildable by the current `build_assets` path.
- The static Nostr viewer should preserve the old generated site's multilingual token behavior: `landing.*` and `web.*` token paths should resolve through the existing locale dictionaries, with browser/default language selection and RTL handling where applicable. This is not fully implemented in the first static preview renderer yet.

Suggested field limits:

- `folder_name`: 64 characters.
- `name`: 120 characters.
- `title`: 80 characters.
- `subtitle`: 120 characters.
- `headline`: 160 characters.
- `content`: 10000 characters.
- `url_message`: 240 characters.
- `url`: 2048 characters.
- `footer_message`: 240 characters.

## Frontend Contract

The flyer frontend must continue to use the existing generated HTML and print surface.

Allowed changes:

- Add a separate loader/import page or app shell.
- Add client-side Nostr fetch code in the loader.
- Add local QR generation in the loader or build path.
- Add metadata outside the flyer if needed.
- Add minimal viewer controls outside the flyer, preferably as a hidden drawer or compact toggle.
- Add anonymous local key generation/signing in the editor shell.

Disallowed changes:

- Changing the visual layout of the generated flyer.
- Adding visible Nostr branding to the flyer by default.
- Adding JavaScript dependency to the generated flyer.
- Adding remote assets to the generated flyer.
- Injecting raw Nostr content as HTML.
- Printing the loader shell, event form, normalized config JSON, or preview chrome.

## Static Client Architecture

Recommended structure:

```text
site/nostr/
  index.html
  nostr-client.js
  nostr-schema.js
  nostr-render.js
  vendor/
    qrcode-generator/
    nostr-tools/
```

The static client should:

- Be self-contained.
- Work from `file://` where practical.
- Work with JavaScript enabled for fetching/rendering.
- Produce/export a final flyer that remains static and Tor-safe.
- Avoid service workers in V1.
- Open `/nostr/#viewer` into a flyer-only viewer surface with a small control toggle.
- Keep `/nostr/#editor` as the form-based event authoring surface.
- Publish with a locally generated anonymous `npub` by default, stored only in browser local storage.
- Allow regenerating/rotating the anonymous `npub` from the editor.

The generated flyer remains separate from the loader:

```text
loader client: interactive, fetches Nostr
generated flyer: static, print-safe, JS-free
```

## Relay Strategy

Inputs:

- Relays embedded in `naddr`, when present.
- Relays embedded in `nevent1`, when present.
- User-provided relay list.
- Built-in fallback relay list.

Rules:

- Query multiple relays in parallel.
- Resolve `naddr` by querying kind `30078` with the addressed author pubkey and `d` tag, then use the newest matching replaceable event returned.
- Use the first valid matching event, then continue briefly to detect conflicts.
- Prefer exact event ID matches over replaceable address matches.
- Show event author, event ID, creation time, and relays used in the loader.
- Do not bake relay-specific state into the generated flyer unless explicitly requested.

## Security Model

Nostr content is untrusted external input.

Required protections:

- Parse JSON with strict schema validation.
- Escape all rendered text.
- Reject raw HTML/script fields.
- Do not load remote assets referenced by events.
- Validate URL schemes: allow `https`, `http`, `onion` URLs via `http://*.onion`, and Nostr identifiers. Reject `javascript:`, `data:`, and similar schemes.
- Put strict length limits on all fields.
- Treat relay responses as untrusted even if signed.
- Verify event signatures before accepting content.
- Do not require users to enter private keys for V1.
- If the browser editor stores an anonymous generated signing key in local storage, label it as a disposable local identity and provide a rotation path.

## Privacy Model

Fetching from public relays leaks interest in an event to those relays and network observers.

Mitigations:

- Allow custom relay lists.
- Allow Tor Browser usage as an optional transport choice.
- Allow offline import from pasted event JSON.
- Document that using public relays is not private.
- Do not phone home to VoxVera infrastructure.

## CLI Architecture

Suggested module split:

```text
voxvera/nostr/
  __init__.py
  ids.py          # parse note1/nevent1/event IDs
  relays.py       # fetch events
  schema.py       # validate payloads
  importers.py    # normalize to config
  qrcode.py       # QR target selection helpers if needed
```

CLI command group:

```bash
voxvera nostr import <identifier> [--relay wss://...] [--folder-name ...]
voxvera nostr build <identifier> [--relay wss://...]
voxvera nostr serve <identifier> [--relay wss://...]
voxvera nostr validate <file-or-identifier>
```

Implementation should keep Nostr code behind a command group so the current non-Nostr workflow remains stable.

## Browser Dependency Strategy

Prefer a small, vendored Nostr client implementation or a carefully vendored library.

Requirements:

- No CDN.
- No dynamic remote imports.
- Browser bundle stored in repo/package.
- CLI dependency either optional extra or small pure-Python implementation.
- Reproducible vendoring instructions.

Candidate directions:

- Browser: vendored `nostr-tools` bundle or a minimal NIP-01/NIP-19 fetch/verify implementation.
- Python CLI: optional `websockets` plus signature verification, or shell out to a bundled helper only if packaging remains clean.

Decision should happen during implementation after checking package size and offline portability impact.

## QR Behavior

V1 default:

- QR and tear-offs point to the generated poster URL, matching current VoxVera behavior without requiring Tor-specific wording.

Optional future modes:

- QR points to source Nostr event.
- QR points to original content URL.
- Flyer includes a separate source QR outside the current print layout.

Any QR mode that changes visible flyer output must be opt-in.

## Testing Plan

Unit tests:

- Parse `note1`, `nevent1`, raw IDs.
- Validate good schema.
- Reject invalid JSON.
- Reject wrong `type`.
- Reject unsupported `version`.
- Reject unsafe URL schemes.
- Enforce field length limits.
- Normalize payload to current config schema.
- Preserve current build output for existing configs.

Integration tests:

- Import fixture event into `~/host/<folder>/config.json`.
- Build imported fixture and compare required output files.
- Serve imported fixture through existing serve path with mocks.
- Static client fixture renders same fields as CLI normalization.

Security tests:

- Script tag in content is escaped.
- HTML event handler attributes are escaped.
- `javascript:` URL rejected.
- Oversized payload rejected.
- Unknown fields ignored.

Manual validation:

- Open static loader from local file.
- Fetch known fixture event from test relay or local mock relay.
- Render/print flyer.
- Verify generated flyer remains usable with JavaScript disabled.
- Verify Tor Browser Safest mode compatibility for generated flyer.

## Implementation Phases

### Phase 0: Design Lock

- Finalize this spec.
- Decide event kind strategy.
- Decide dependency strategy.
- Create fixture events.
- Define schema in code comments/docs before implementation.

### Phase 1: CLI Import

- Add `voxvera nostr validate`.
- Add `voxvera nostr import`.
- Use fixture JSON first.
- Normalize into existing `config.json`.
- Add tests.

Implemented initial local-file commands:

```bash
voxvera nostr validate ./event.json
voxvera nostr import ./event.json
voxvera nostr build ./event.json
voxvera nostr serve ./event.json
```

Phase 1 intentionally rejects non-file `note1` / `nevent1` identifiers with a clear message. Relay fetch, NIP-19 parsing, and signature verification belong to Phase 2.

### Phase 2: Relay Fetch

- Add relay fetching for public events.
- Add NIP-19 parsing.
- Add signature verification.
- Add relay selection options.
- Add tests with mocked relay responses.

### Phase 3: Static Loader

- Add self-contained static loader under `site/nostr/`.
- Fetch event by identifier.
- Validate and normalize payload.
- Render existing flyer output or produce config for existing render path.
- Add export/download option.

Initial implementation exists:

- `site/nostr/index.html`
- `site/nostr/nostr-client.css`
- `site/nostr/nostr-client.js`

Current behavior:

- Editor mode collects existing VoxVera flyer fields.
- Editor can export unsigned kind `30078` event JSON.
- Editor can sign/publish through a NIP-07 browser signer and returns the signed event ID.
- Viewer mode fetches a raw 64-character event ID from configured relays.
- Viewer normalizes event content into existing VoxVera config JSON.
- Preview is client-side and print-oriented, but it is not yet the final generated flyer artifact.

Pending hardening:

- Vendor or implement browser-side QR generation without CDN usage.
- Add independent event ID/signature verification in the browser.
- Decide whether the static viewer should generate a full standalone flyer HTML file for download.

### Phase 4: QR Modes

- Keep default QR as generated flyer URL.
- Add optional `qr_target` handling.
- Add tests and docs.

### Phase 5: Publishing Support

Deferred.

Possible future commands:

```bash
voxvera nostr publish config.json
voxvera nostr sign config.json
```

This requires a separate key-management spec.

## Open Questions

- Should V1 use kind `30078`, a custom kind, or both?
- Should replaceable events be accepted by default, or should exact immutable event IDs be preferred for anti-tamper stability?
- Should the static loader render HTML directly in browser, or should it generate/download a standard VoxVera project bundle?
- What relay list should be bundled by default, if any?
- Should `qr_target: nostr_event` encode `nevent1` with relay hints or a bare `note1`?
- Should the generated flyer include source attribution metadata in comments only, or not at all?

## Acceptance Criteria

- Existing non-Nostr VoxVera workflow continues to pass tests.
- Existing generated flyer visual output is unchanged for normal configs.
- Nostr fixture event can be validated, imported, built, and served through existing paths.
- Static loader is self-contained and does not use remote dependencies.
- Generated flyer remains static and JS-free.
- Unsafe Nostr payloads are rejected or escaped.
- Docs explain relay privacy tradeoffs.
