# VoxVera

VoxVera is now a static Nostr-powered flyer client.

The active app lives at the site root ([`site/`](site/)). It lets a user author flyer content, publish it as a public Nostr event, and render the flyer later from an event ID or Nostr address. The frontend is intentionally self-contained: relays store the content, and any static host can serve the client.

The previous Tor/OnionShare CLI version is preserved on the `legacy-tor` branch.

## What Is In `main`

- `site/index.html`, `site/nostr-client.js`, `site/nostr-client.css`, `site/locales.js`: static editor/viewer client
- `site/vendor/`: vendored browser dependencies for Nostr and QR generation
- `site/nostr/index.html`: redirect stub so legacy `/nostr/` poster URLs and QR codes still resolve
- `site/CNAME`: custom-domain target
- `voxvera/nostr/`: small Python schema/validation helpers
- `docs/nostr-static-client-spec.md`: design notes and development plan

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
node --check site/nostr-client.js
pytest -q
```

The Python tests only cover the Nostr source schema. The frontend is static and should be checked in-browser for layout and print behavior after UI changes.

## License

MIT (c) 2026 thePR0M3TH3AN
