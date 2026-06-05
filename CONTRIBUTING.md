# Contributing To VoxVera

VoxVera `main` is a static Nostr client. Keep contributions focused on the browser editor/viewer, Nostr event validation, printable flyer rendering, and static deployment.

## Frontend

- Edit the active app under `site/nostr/`.
- Keep dependencies vendored under `site/nostr/vendor/`; do not rely on CDNs.
- Preserve viewer mode as a flyer-first experience.
- Keep editor, load, print, language, and other controls hidden from print output.
- Verify print layout after changes that affect the flyer surface.

## Localization

The static client currently uses `site/nostr/locales.js` plus the `NOSTR_UI` table in `site/nostr/nostr-client.js`.

When adding user-facing text:

- Add translations for every supported language.
- Check right-to-left languages in the browser where layout may be affected.
- Keep side-tab strings short enough for tear-off strips.

## Nostr Schema

Python validation helpers live in `voxvera/nostr/`. Keep the schema conservative:

- Reject raw HTML in user-supplied flyer fields.
- Reject unsupported URL schemes.
- Keep attachments out of V1 events unless the spec is deliberately expanded.

## Verification

Run:

```bash
node --check site/nostr/nostr-client.js
pytest -q
```

For UI work, also run a local static server and inspect `/nostr/` in a browser.
