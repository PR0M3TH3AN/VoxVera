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
