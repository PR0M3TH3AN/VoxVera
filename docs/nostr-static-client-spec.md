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
  index.html
  CNAME
  nostr/
    index.html
    nostr-client.css
    nostr-client.js
    locales.js
    vendor/
      nostr-tools/
      qrcode-generator/
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

`site/index.html` redirects root traffic to `/nostr/`.

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
  "title": "TOP SECRET",
  "subtitle": "DO ~~NOT~~ DISTRIBUTE",
  "headline": "OPERATION VOX VERA",
  "content": "Flyer body text",
  "url_message": "Follow this link to learn more.",
  "url": "https://creator.example/action",
  "tear_off_link": "https://voxvera.org/nostr/?addr=naddr1...",
  "footer_message": "0110010",
  "qr_target": "flyer_url"
}
```

The UI labels `folder_name` as `Flyer Name`; it acts as the event slug, not a local hosting folder.

## QR Target

Default behavior: `qr_target: "flyer_url"`.

`url` is always the creator-controlled content destination shown in the body of the flyer. The editor must not overwrite this field with generated app URLs.

When publishing, the client computes the replaceable-event `naddr` and writes the generated poster URL to `tear_off_link`. The tear-off tabs and tear-off QR code point at `tear_off_link`, so people can re-open and reprint the flyer. The main flyer QR code points at `url`, so viewers can visit the creator's intended destination.

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

## Localization

Flyer defaults come from `site/nostr/locales.js`.

Nostr editor/viewer controls and Nostr-specific flyer labels come from `NOSTR_UI` in `site/nostr/nostr-client.js`.

Language changes should:

- publish the selected flyer language in payload `lang`
- publish matching Nostr language tags
- infer language from event tags if a fetched payload omits `lang`
- update default flyer content while the flyer is still using default content
- preserve user-authored or fetched event content
- update editor/viewer tool labels
- update printed side-tab labels
- respect RTL direction metadata

## Verification

```bash
node --check site/nostr/nostr-client.js
pytest -q
```

For UI work, also verify browser rendering and print output from a local static server.
