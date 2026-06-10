# Cross-browser end-to-end tests

[Playwright](https://playwright.dev) smoke tests that exercise the static client
on every major browser engine and on mobile emulations, so a change that works
in Chrome can be confirmed to work in Firefox and Safari (WebKit) too.

## Coverage

Projects are defined in [`../playwright.config.js`](../playwright.config.js):

| Project | Engine | Notes |
|---|---|---|
| `chromium-desktop` | Chromium | Chrome / Brave / Edge |
| `firefox-desktop` | Gecko | Firefox |
| `webkit-desktop` | WebKit | Safari on macOS |
| `chrome-android` | Chromium | Pixel 5 emulation (touch, mobile UA) |
| `safari-ios` | WebKit | iPhone 13 emulation — proxy for iOS Safari |
| `firefox-mobileviewport` | Gecko | Mobile **viewport only** (Playwright Firefox has no touch/isMobile emulation) |

WebKit is the engine behind Safari and **every** iOS browser, so the WebKit
projects are our stand-in for the Apple ecosystem without a Mac in the loop.
They are not a perfect substitute for real Safari/iOS (notably print dialog
behavior and clipboard gesture rules), so a real-device pass is still worth
doing before a release.

The specs in [`flyer.spec.js`](flyer.spec.js) check the genuinely
engine-sensitive surfaces:

- default flyer renders with **no uncaught JS / console errors**
- `@media print` hides the app chrome and keeps the flyer (a print-media
  screenshot of the sheet is attached per engine for visual diffing)
- anonymous key generation works (the **WebCrypto** path)
- the legacy `/nostr/` redirect preserves the query string and `#hash`
- an event-lookup URL shows the localized loading state, never the default flyer
- the bulletin board is gated behind a Nostr connection: the gate shows when no
  identity is connected, connecting (stubbed `window.nostr`) reveals the table
  and the connected npub, disconnecting returns to the gate, and a remembered
  connection auto-restores on revisit
- the board's alternative connect methods: pasting an `nsec` derives the pubkey,
  reveals the board, leaves no secret in the DOM or storage, and restores on
  reload from the pubkey alone; an invalid `nsec` errors without connecting; and
  "Create a new key" reveals the npub/nsec, stores the device key, then connects
- the editor's publishing identity: defaults to anonymous; connecting NIP-07
  (stubbed) signs/publishes under the extension key; importing an `nsec` signs
  for the session without persisting the secret; an invalid `nsec` errors; a
  remembered `nsec` is PIN-encrypted at rest (the stored blob never contains the
  plaintext secret), locks on reload, rejects a wrong PIN, and unlocks with the
  right one; "Forget" clears the stored identity back to anonymous
- the board's web-of-trust filter (stubbed relays): a connected viewer sees only
  flyers from authors in their NIP-02 follow graph, "Show all" opts out to the
  full set, and a viewer with no follow list is seeded from the curator's follows

## Running

```bash
npm install
npx playwright install            # download Chromium, Firefox, WebKit
npm run test:e2e                  # all projects
npx playwright test --project=firefox-desktop   # one engine
npm run report                    # open the HTML report (with print screenshots)
```

Playwright starts and stops the static server itself (`python3 -m http.server`),
so you do not need a server running first.

### Linux: WebKit system dependency

On a fresh Linux box WebKit needs extra system libraries. If the WebKit
projects fail to launch, install them once:

```bash
sudo npx playwright install-deps   # or: sudo apt-get install -y libavif16
```

The Chromium and Firefox projects run without this step.
