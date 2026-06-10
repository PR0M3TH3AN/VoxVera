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

  test("infers language from the first supported browser preference", async ({ page }) => {
    // Browser prefers Dutch (unsupported), then German (supported), then
    // English. We should honor German rather than jumping to the English
    // fallback — i.e. walk navigator.languages, not just navigator.language.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", {
        configurable: true,
        get: () => ["nl-NL", "de-DE", "en-US"]
      });
      Object.defineProperty(navigator, "language", {
        configurable: true,
        get: () => "nl-NL"
      });
    });
    await page.goto("/");
    // German default headline (locales.js de.landing.title).
    await expect(page.locator(".content h1").first()).toContainText("STRENG GEHEIM");
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
  });

  test("defaults to A4 for an A4-region locale (no geolocation)", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["de-DE"] });
      Object.defineProperty(navigator, "language", { configurable: true, get: () => "de-DE" });
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/paper-a4/);
    const pageRule = await page.evaluate(
      () => document.getElementById("voxvera-page-size").textContent
    );
    expect(pageRule).toContain("A4");
  });

  test("defaults to US Letter for a Letter-region locale", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["en-US"] });
      Object.defineProperty(navigator, "language", { configurable: true, get: () => "en-US" });
    });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/paper-letter/);
    const pageRule = await page.evaluate(
      () => document.getElementById("voxvera-page-size").textContent
    );
    expect(pageRule).toContain("Letter");
  });

  test("manual paper-size override persists across reloads", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "languages", { configurable: true, get: () => ["en-US"] });
    });
    // Editor mode shows the topbar controls; viewer mode hides them.
    await page.goto("/#editor");
    await expect(page.locator("html")).toHaveClass(/paper-letter/);
    await page.locator("#topbar-paper").selectOption("a4");
    await expect(page.locator("html")).toHaveClass(/paper-a4/);
    await page.reload();
    // Stored override beats the en-US region default.
    await expect(page.locator("html")).toHaveClass(/paper-a4/);
  });

  test("bulletin board link sits outside the flyer sheet and is not printed", async ({ page }) => {
    await page.goto("/");
    const link = page.locator(".preview-band > .board-link a");
    await expect(link).toHaveText("Bulletin board");
    await expect(link).toHaveAttribute("href", "board.html");
    // It is app chrome below the preview, not part of the printable sheet.
    await expect(page.locator(".container .board-link")).toHaveCount(0);
    // Screen-only — it must not appear in print output.
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".board-link")).toBeHidden();
  });

  test("bulletin board page renders localized, sortable columns", async ({ page }) => {
    await page.goto("/board.html");
    await expect(page.locator("#board-title")).toHaveText("Bulletin Board");
    const headers = page.locator("#board-head th");
    await expect(headers).toHaveCount(5);
    await expect(headers.nth(0)).toContainText("Title");
    await expect(headers.nth(1)).toContainText("Link");
    await expect(headers.nth(2)).toContainText("Posted by");
    await expect(headers.nth(3)).toContainText("Language");
    await expect(headers.nth(4)).toContainText("Posted");
    // Default sort is date descending.
    await expect(headers.nth(4).locator(".sort-indicator")).toContainText("▼");
    // Clicking the Title header makes it the active ascending sort.
    await headers.nth(0).click();
    await expect(headers.nth(0).locator(".sort-indicator")).toContainText("▲");
  });

  test("bulletin board assets use root-absolute paths (cleanUrls/trailingSlash safe)", async ({ page }) => {
    await page.goto("/board.html");
    const refs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("link[href], script[src]"))
        .map((n) => n.getAttribute("href") || n.getAttribute("src")));
    expect(refs.length).toBeGreaterThan(0);
    // Vercel serves this page at /board/ — relative asset paths would resolve
    // to /board/... and 404, leaving the page unstyled with no scripts.
    for (const ref of refs) {
      expect(ref, `asset "${ref}" must be root-absolute or external`).toMatch(/^(https?:|\/)/);
    }
  });

  test("bulletin board language selector localizes the page", async ({ page }) => {
    await page.goto("/board.html");
    await expect(page.locator("#board-title")).toHaveText("Bulletin Board");
    await page.locator("#board-lang").selectOption("de");
    await expect(page.locator("#board-title")).toHaveText("Schwarzes Brett");
    await expect(page.locator("#board-head th").first()).toContainText("Titel");
    // An RTL language flips the document direction.
    await page.locator("#board-lang").selectOption("ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("#board-title")).toHaveText("لوحة الإعلانات");
    // The choice persists (shared key) and survives a reload.
    await page.reload();
    await expect(page.locator("#board-title")).toHaveText("لوحة الإعلانات");
  });
});
