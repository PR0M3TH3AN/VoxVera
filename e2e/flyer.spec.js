// @ts-check
const { test, expect } = require("@playwright/test");

// These run once per project (engine/device) defined in playwright.config.js,
// so every assertion below is validated on Chromium, Firefox, WebKit, and the
// Android/iOS mobile emulations.

/** Collect uncaught errors + console.error so we can fail on JS that only one
 *  engine throws (the classic "works in Chrome" trap). */
function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

test.describe("VoxVera static client", () => {
  test("loads the default flyer with no JS errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    const sheet = page.locator("#flyer-preview .container").first();
    await expect(sheet).toBeVisible();
    // Default sample content should render on the bare URL.
    await expect(page.locator(".content h1").first()).toContainText("TOP SECRET");
    // A real Letter sheet is taller than it is wide.
    const box = await sheet.boundingBox();
    expect(box && box.height).toBeGreaterThan(box ? box.width : 0);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("print media hides app chrome and keeps the flyer", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.emulateMedia({ media: "print" });
    // App header/toolbars must not print.
    await expect(page.locator("body > header")).toBeHidden();
    const sheet = page.locator(".container").first();
    await expect(sheet).toBeVisible();
    // Attach the printed-media render of the sheet for visual cross-engine diff.
    const shot = await sheet.screenshot();
    await testInfo.attach(`print-${testInfo.project.name}`, { body: shot, contentType: "image/png" });
  });

  test("generates an anonymous npub (WebCrypto path)", async ({ page }) => {
    const errors = trackErrors(page);
    // The identity controls live in the editor panel (hidden in viewer mode).
    await page.goto("/#editor");
    await page.locator("#generate-anon-identity").click();
    await expect(page.locator("#author-npub-output")).toContainText(/^npub1[0-9a-z]+/);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("legacy /nostr/ redirect preserves query + hash", async ({ page }) => {
    await page.goto("/nostr/?ref=qr#hello");
    await page.waitForURL((url) => url.pathname === "/" && url.hash === "#hello");
    expect(new URL(page.url()).pathname).toBe("/");
    expect(new URL(page.url()).search).toBe("?ref=qr");
    expect(new URL(page.url()).hash).toBe("#hello");
  });

  test("event-lookup URL shows the loading state, not default content", async ({ page }) => {
    await page.goto("/");
    // Build a well-formed naddr in-page so we don't depend on the network.
    const naddr = await page.evaluate(() => {
      const t = window.NostrTools;
      return t.nip19.naddrEncode({
        identifier: "voxvera:crossbrowser-smoke",
        pubkey: "0".repeat(64),
        kind: 30078,
        relays: []
      });
    });
    expect(naddr).toMatch(/^naddr1/);
    // Navigating to the fragment should immediately swap in the localized
    // "Loading content..." placeholder rather than the default TOP SECRET flyer.
    // Go via about:blank so this is a full document load (a bare #hash change
    // on the same URL would not re-run the URL-event handler).
    await page.goto("about:blank");
    await page.goto(`/#${naddr}`);
    // The default flyer (with its h1 headings) must never appear; only the
    // status placeholder. Accept either loading or the eventual load-failed
    // message, since the offline fetch may resolve before we assert.
    await expect(page.locator(".flyer-status-message")).toContainText(
      /Loading content|Could not load this flyer/i
    );
    await expect(page.locator(".content h1")).toHaveCount(0);
  });
});
