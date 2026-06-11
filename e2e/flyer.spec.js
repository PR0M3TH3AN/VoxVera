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

/** Install a fake NIP-07 provider (window.nostr) so the board's login gate can
 *  be satisfied headlessly — no real extension exists in CI. */
function stubNip07(page, pubkeyHex) {
  const pk = pubkeyHex || "1".repeat(64);
  return page.addInitScript((hex) => {
    window.nostr = {
      getPublicKey: async () => hex,
      signEvent: async (e) => e
    };
  }, pk);
}

/** Stub all relay WebSockets so the board's REQs are answered from a fixed set
 *  of events (no real network). Events are matched against the REQ filter by
 *  kind, authors, and the `#t` tag, then streamed back followed by EOSE. */
function stubRelays(page, events) {
  return page.addInitScript((evts) => {
    function matches(ev, filter) {
      if (filter.kinds && filter.kinds.indexOf(ev.kind) === -1) return false;
      if (filter.authors && filter.authors.indexOf(ev.pubkey) === -1) return false;
      if (filter["#t"]) {
        const tvals = (ev.tags || []).filter((x) => x[0] === "t").map((x) => x[1]);
        if (!filter["#t"].some((v) => tvals.indexOf(v) !== -1)) return false;
      }
      return true;
    }
    class FakeWS {
      constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
      send(data) {
        let m;
        try { m = JSON.parse(data); } catch (_) { return; }
        if (m[0] !== "REQ") return;
        const sub = m[1];
        const filter = m[2] || {};
        const out = evts.filter((ev) => matches(ev, filter));
        setTimeout(() => {
          out.forEach((ev) => this.onmessage && this.onmessage({ data: JSON.stringify(["EVENT", sub, ev]) }));
          this.onmessage && this.onmessage({ data: JSON.stringify(["EOSE", sub]) });
        }, 1);
      }
      close() {}
    }
    window.WebSocket = FakeWS;
  }, events || []);
}

// Pubkeys used by the web-of-trust tests. ME matches stubNip07's default.
const ME = "1".repeat(64);
const TRUSTED = "a".repeat(64);
const UNTRUSTED = "b".repeat(64);
const CURATOR = "a4a6b5849bc917b3befd5c81865ee0b88773690609c207ba6588ef3e1e05b95b";

function flyerEvent(id, pubkey, title) {
  return {
    id,
    kind: 30078,
    pubkey,
    created_at: 2000,
    tags: [["d", "voxvera:" + id], ["t", "voxvera"], ["t", "flyer"]],
    content: JSON.stringify({ type: "voxvera_flyer", title, lang: "en", url: "https://example.com/" + id })
  };
}

function contactList(pubkey, follows) {
  return {
    id: "contacts-" + pubkey.slice(0, 6),
    kind: 3,
    pubkey,
    created_at: 1000,
    tags: follows.map((p) => ["p", p]),
    content: ""
  };
}

test.describe("VoxVera static client", () => {
  test("loads the default flyer with no JS errors", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/");
    const sheet = page.locator("#flyer-preview .container").first();
    await expect(sheet).toBeVisible();
    // Default sample content: title (the project name) renders first, the
    // dramatic line is the headline below it.
    await expect(page.locator(".content h1").first()).toContainText("OPERATION VOX VERA");
    await expect(page.locator(".content h1").nth(1)).toContainText("TOP SECRET");
    // The side tabs are labeled with the title (the project name).
    await expect(page.locator(".tear-off-title").first()).toContainText("OPERATION VOX VERA");
    // A real Letter sheet is taller than it is wide.
    const box = await sheet.boundingBox();
    expect(box && box.height).toBeGreaterThan(box ? box.width : 0);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("both pages declare an SVG favicon (no /favicon.ico 404)", async ({ page }) => {
    for (const path of ["/", "/board.html"]) {
      await page.goto(path);
      const href = await page.locator('link[rel~="icon"]').first().getAttribute("href");
      expect(href, `${path} should link a favicon`).toBe("/favicon.svg");
    }
    // The asset itself is served and is valid SVG.
    const res = await page.request.get("/favicon.svg");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"] || "").toContain("svg");
    expect(await res.text()).toContain("<svg");
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

  test("viewer renders a fetched flyer that fails strict authoring validation", async ({ page }) => {
    // A flyer that the board would list but the old viewer refused to open:
    // text that looks like HTML, an over-length body, and a javascript: URL.
    const PK = "c".repeat(64);
    const IDENT = "voxvera:edge-case-flyer";
    const event = {
      id: "e".repeat(64),
      kind: 30078,
      pubkey: PK,
      created_at: 3000,
      tags: [["d", IDENT], ["t", "voxvera"], ["language", "en"]], // note: no t=flyer
      content: JSON.stringify({
        type: "voxvera_flyer", version: 1, folder_name: "edge-case-flyer", lang: "en",
        name: "Edge", title: "BITCOIN < FREEDOM > STATE", subtitle: "sub", headline: "HEAD",
        content: "value < x > y and onload = boom " + "z".repeat(6000), // raw-HTML-ish + over length
        url_message: "msg", url: "javascript:alert(1)", footer_message: "foot",
        tear_off_link: "https://voxvera.org/#naddr1edgecase", qr_target: "flyer_url"
      })
    };
    await stubRelays(page, [event]);
    await page.goto("/");
    const naddr = await page.evaluate(({ pk, ident }) =>
      window.NostrTools.nip19.naddrEncode({ identifier: ident, pubkey: pk, kind: 30078, relays: [] }),
      { pk: PK, ident: IDENT });
    await page.goto("about:blank");
    await page.goto(`/#${naddr}`);
    // It renders (old behavior: "Could not load this flyer"). Title text is shown
    // with the angle brackets escaped to plain text, not refused.
    await expect(page.locator(".content h1").first()).toContainText("BITCOIN");
    await expect(page.locator(".content h1").first()).toContainText("FREEDOM");
    await expect(page.locator(".flyer-status-message")).toHaveCount(0);
    // The javascript: URL is neutralized — never rendered as a clickable link.
    const href = await page.locator(".qr-code-url a").getAttribute("href");
    expect(href || "").not.toMatch(/^javascript:/i);
  });

  test("tear-off tabs carry the title, an open-&-reprint link, and a VoxVera.org event-id", async ({ page }) => {
    const PK = "c".repeat(64);
    const IDENT = "voxvera:tab-test";
    await stubRelays(page, [{
      id: "ab".repeat(32), kind: 30078, pubkey: PK, created_at: 3000,
      tags: [["d", IDENT], ["t", "voxvera"], ["t", "flyer"], ["language", "en"]],
      content: JSON.stringify({
        type: "voxvera_flyer", version: 1, folder_name: "tab-test", lang: "en",
        name: "N", title: "BITCOIN", subtitle: "s", headline: "h", content: "c",
        url_message: "m", url: "https://example.com/x", footer_message: "f",
        tear_off_link: "https://voxvera.org/#naddr1tab", qr_target: "flyer_url"
      })
    }]);
    await page.goto("/");
    const naddr = await page.evaluate(({ pk, ident }) =>
      window.NostrTools.nip19.naddrEncode({ identifier: ident, pubkey: pk, kind: 30078, relays: [] }),
      { pk: PK, ident: IDENT });
    await page.goto("about:blank");
    await page.goto(`/#${naddr}`);
    const tab = page.locator(".tear-off").first();
    // Title labels the tab and is auto-sized to a concrete font size.
    await expect(tab.locator(".tear-off-title")).toHaveText("BITCOIN");
    expect(await tab.locator(".tear-off-title").evaluate((n) => n.style.fontSize)).toMatch(/\d+px/);
    // The instruction line is the clickable link to the poster URL.
    const link = tab.locator("a.tear-off-link");
    await expect(link).toHaveText("Open & reprint this flyer");
    await expect(link).toHaveAttribute("href", "https://voxvera.org/#naddr1tab");
    // Event-id label points people back to VoxVera.org.
    await expect(tab.locator(".tear-off-event-id")).toContainText("Reopen at VoxVera.org");
    await expect(tab.locator(".tear-off-event-id")).toContainText("Event ID");
  });

  test("viewer resolves a flyer from relays that ignore the #d filter", async ({ page }) => {
    // Simulate a relay that does NOT honor the addressable "#d" tag filter (it
    // returns nothing for such a REQ) but does answer a broad author query —
    // which is how the board finds the flyer. The viewer must still resolve it.
    const PK = "d".repeat(64);
    const IDENT = "voxvera:no-d-filter";
    const event = {
      id: "1".repeat(64), kind: 30078, pubkey: PK, created_at: 4000,
      tags: [["d", IDENT], ["t", "voxvera"], ["t", "flyer"], ["language", "en"]],
      content: JSON.stringify({
        type: "voxvera_flyer", version: 1, folder_name: "no-d-filter", lang: "en",
        name: "N", title: "RESOLVED VIA BROAD QUERY", subtitle: "s", headline: "H",
        content: "body", url_message: "m", url: "https://example.com/x",
        footer_message: "f", tear_off_link: "https://voxvera.org/#naddr1x", qr_target: "flyer_url"
      })
    };
    await page.addInitScript((ev) => {
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          let m; try { m = JSON.parse(data); } catch (_) { return; }
          if (m[0] !== "REQ") return;
          const sub = m[1], filter = m[2] || {};
          const emit = (arr) => this.onmessage && this.onmessage({ data: JSON.stringify(arr) });
          // Relay that ignores #d: a REQ carrying "#d" gets only EOSE, no events.
          const deny = Object.prototype.hasOwnProperty.call(filter, "#d");
          setTimeout(() => {
            if (!deny && (!filter.authors || filter.authors.indexOf(ev.pubkey) !== -1)) {
              emit(["EVENT", sub, ev]);
            }
            emit(["EOSE", sub]);
          }, 1);
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    }, event);
    await page.goto("/");
    const naddr = await page.evaluate(({ pk, ident }) =>
      window.NostrTools.nip19.naddrEncode({ identifier: ident, pubkey: pk, kind: 30078, relays: [] }),
      { pk: PK, ident: IDENT });
    await page.goto("about:blank");
    await page.goto(`/#${naddr}`);
    await expect(page.locator(".content h1").first()).toContainText("RESOLVED VIA BROAD QUERY");
    await expect(page.locator(".flyer-status-message")).toHaveCount(0);
  });

  test("on a narrow screen the flyer shrinks to fully fit the width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await page.waitForSelector("#flyer-preview .container");
    await page.waitForTimeout(200);
    const m = await page.evaluate(() => {
      const sheet = document.querySelector("#flyer-preview .container");
      return {
        rectW: Math.round(sheet.getBoundingClientRect().width),
        win: window.innerWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    expect(m.rectW).toBeLessThanOrEqual(m.win); // no clipping past the screen edge
    expect(m.overflow).toBe(false); // no horizontal page scroll
  });

  test("editor identity controls stay hidden until chosen", async ({ page }) => {
    await page.goto("/#editor");
    await expect(page.locator("#nsec-import")).toBeHidden();
    await expect(page.locator("#identity-locked-row")).toBeHidden();
  });

  test("on a narrow screen the board collapses to cards with a Details toggle", async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 800 });
    await stubNip07(page);
    await stubRelays(page, [flyerEvent("solo", "b".repeat(64), "Mobile Flyer")]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    const row = page.locator("#board-rows tr").first();
    const toggle = row.locator(".board-details-toggle");
    await expect(toggle).toBeVisible(); // shown only at narrow widths
    await expect(row.locator('td[data-col="author"]')).toBeHidden(); // collapsed
    await toggle.click();
    await expect(row).toHaveClass(/expanded/);
    await expect(row.locator('td[data-col="author"]')).toBeVisible(); // revealed
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
    // German-distinctive default headline (locales.js de.landing.headline).
    await expect(page.locator(".content h1").nth(1)).toContainText("STRENG GEHEIM");
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
    // Desktop table mode (narrow screens collapse to cards with the header hidden).
    await page.setViewportSize({ width: 1024, height: 768 });
    await stubNip07(page);
    await stubRelays(page, []);
    await page.goto("/board.html");
    await expect(page.locator("#board-title")).toHaveText("Bulletin Board");
    // The board is gated: connect a (stubbed) Nostr identity to reveal it.
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    const headers = page.locator("#board-head th");
    await expect(headers).toHaveCount(7); // + a non-sortable actions column
    await expect(headers.nth(0)).toContainText("Title");
    await expect(headers.nth(1)).toContainText("Link");
    await expect(headers.nth(2)).toContainText("Posted by");
    await expect(headers.nth(3)).toContainText("Language");
    await expect(headers.nth(4)).toContainText("Posted");
    await expect(headers.nth(5)).toContainText("Event ID");
    // Default sort is date descending.
    await expect(headers.nth(4).locator(".sort-indicator")).toContainText("▼");
    // Clicking the Title header makes it the active ascending sort.
    await headers.nth(0).click();
    await expect(headers.nth(0).locator(".sort-indicator")).toContainText("▲");
  });

  test("the board shows each flyer's event ID with a copy button", async ({ page }) => {
    const EVENT_ID = "a1b2c3d4e5f6071829303142535465768798a0b1c2d3e4f50617283940a1b2c3";
    await stubNip07(page);
    await stubRelays(page, [{
      id: EVENT_ID, kind: 30078, pubkey: "f".repeat(64), created_at: 5000,
      tags: [["d", "voxvera:id-test"], ["t", "voxvera"], ["t", "flyer"], ["language", "en"]],
      content: JSON.stringify({
        type: "voxvera_flyer", version: 1, folder_name: "id-test", lang: "en",
        name: "N", title: "ID Test Flyer", subtitle: "s", headline: "h", content: "c",
        url_message: "m", url: "https://example.com/i", footer_message: "f",
        tear_off_link: "https://voxvera.org/#naddr1i", qr_target: "flyer_url"
      })
    }]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    // Shortened id is displayed, the full id is in the title, and the copy button
    // carries the full id as its copy target.
    const idCell = page.locator(".board-eventid");
    await expect(idCell).toContainText("a1b2c3d4");
    await expect(idCell).toHaveAttribute("title", EVENT_ID);
    const copyBtn = page.locator(".board-copy");
    await expect(copyBtn).toHaveText("Copy");
    await expect(copyBtn).toHaveAttribute("data-copy", EVENT_ID);
  });

  test("bulletin board is gated behind a Nostr connection", async ({ page }) => {
    // No NIP-07 provider: the gate is shown, the table is hidden, and trying to
    // connect reports that no extension was found.
    await page.goto("/board.html");
    await expect(page.locator("#board-gate")).toBeVisible();
    await expect(page.locator("#board-content")).toBeHidden();
    await expect(page.locator("#board-identity")).toBeHidden();
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-gate-error")).toContainText(/No Nostr extension/i);
  });

  test("connecting a Nostr identity reveals the board and disconnect hides it", async ({ page }) => {
    await stubNip07(page);
    await stubRelays(page, []);
    await page.goto("/board.html");
    await expect(page.locator("#board-content")).toBeHidden();
    await page.locator("#board-connect").click();
    // Board content appears and the connected npub is surfaced.
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-identity")).toBeVisible();
    await expect(page.locator("#board-identity-npub")).toContainText(/^npub1/);
    // Disconnect returns to the gate.
    await page.locator("#board-disconnect").click();
    await expect(page.locator("#board-gate")).toBeVisible();
    await expect(page.locator("#board-content")).toBeHidden();
  });

  test("a remembered connection auto-restores on revisit", async ({ page }) => {
    await stubNip07(page);
    await stubRelays(page, []);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    // The pubkey was remembered, so a fresh load connects without a click.
    await page.reload();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-gate")).toBeHidden();
  });

  test("connecting by pasting an nsec derives the pubkey and reveals the board", async ({ page }) => {
    // No NIP-07 here — the nsec path must work without an extension (mobile).
    await stubRelays(page, []);
    await page.goto("/board.html");
    // Build a valid nsec in-page and capture the npub it should resolve to.
    const { nsec, npub } = await page.evaluate(() => {
      const t = window.NostrTools;
      const sk = t.generateSecretKey();
      return { nsec: t.nip19.nsecEncode(sk), npub: t.nip19.npubEncode(t.getPublicKey(sk)) };
    });
    await page.locator("#board-connect-nsec-toggle").click();
    await page.locator("#board-nsec-input").fill(nsec);
    await page.locator("#board-nsec-submit").click();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-identity-npub")).toContainText(npub.slice(0, 12));
    // The secret is not left in the input, and only the pubkey is remembered.
    await expect(page.locator("#board-nsec-input")).toHaveValue("");
    expect(await page.evaluate(() => localStorage.getItem("voxvera_connected_pubkey"))).toMatch(/^[0-9a-f]{64}$/);
    expect(await page.evaluate(() => localStorage.getItem("voxvera_nostr_anon_secret_hex"))).toBeNull();
    // A reload restores the session from the pubkey alone (no nsec re-entry).
    await page.reload();
    await expect(page.locator("#board-content")).toBeVisible();
  });

  test("an invalid nsec shows an error and does not connect", async ({ page }) => {
    await page.goto("/board.html");
    await page.locator("#board-connect-nsec-toggle").click();
    await page.locator("#board-nsec-input").fill("nsec1notarealkey");
    await page.locator("#board-nsec-submit").click();
    await expect(page.locator("#board-gate-error")).toContainText(/valid nsec/i);
    await expect(page.locator("#board-content")).toBeHidden();
  });

  test("creating a new key reveals the secret then connects", async ({ page }) => {
    await stubRelays(page, []);
    await page.goto("/board.html");
    await page.locator("#board-generate").click();
    // The new key is revealed (npub + nsec) so the user can save it.
    await expect(page.locator("#board-generated")).toBeVisible();
    await expect(page.locator("#board-gen-npub")).toHaveValue(/^npub1[0-9a-z]+/);
    await expect(page.locator("#board-gen-nsec")).toHaveValue(/^nsec1[0-9a-z]+/);
    // It is stored as the device key (shared with the editor's anon identity).
    expect(await page.evaluate(() => localStorage.getItem("voxvera_nostr_anon_secret_hex"))).toMatch(/^[0-9a-f]{64}$/);
    await page.locator("#board-gen-continue").click();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-identity-npub")).toContainText(/^npub1/);
  });

  test("web-of-trust filter shows only followed authors, with a show-all opt-out", async ({ page }) => {
    // The connected viewer follows TRUSTED (but not UNTRUSTED).
    await stubNip07(page, ME);
    await stubRelays(page, [
      contactList(ME, [TRUSTED]),
      flyerEvent("trusted", TRUSTED, "Trusted Flyer"),
      flyerEvent("untrusted", UNTRUSTED, "Untrusted Flyer")
    ]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    // Only the followed author's flyer is shown by default.
    await expect(page.locator("#board-rows")).toContainText("Trusted Flyer");
    await expect(page.locator("#board-rows")).not.toContainText("Untrusted Flyer");
    await expect(page.locator("#board-filter-note")).toContainText(/people you follow/i);
    await expect(page.locator("#board-show-all")).not.toBeChecked();
    // Opting in to "show all" reveals the untrusted flyer too. Click the label
    // (WebKit can report the bare checkbox as not actionable); this is also how
    // a user toggles it.
    await page.locator("#board-show-all-label").click();
    await expect(page.locator("#board-show-all")).toBeChecked();
    await expect(page.locator("#board-rows")).toContainText("Untrusted Flyer");
    await expect(page.locator("#board-filter-note")).toContainText(/all flyers/i);
  });

  test("the web-of-trust filter includes follows-of-follows (degree 2)", async ({ page }) => {
    const A = "a".repeat(64);
    const B = "b".repeat(64);
    const C = "c".repeat(64);
    await stubNip07(page); // viewer = ME (1*64)
    await stubRelays(page, [
      contactList(ME, [A]),  // you follow A (degree 1)
      contactList(A, [B]),   // A follows B (degree 2)
      flyerEvent("fa", A, "Direct Follow Flyer"),
      flyerEvent("fb", B, "Friend Of Friend Flyer"),
      flyerEvent("fc", C, "Stranger Flyer")
    ]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    // Trust-filtered (not show-all): degree-1 and degree-2 appear, stranger hidden.
    await expect(page.locator("#board-rows")).toContainText("Direct Follow Flyer");
    await expect(page.locator("#board-rows")).toContainText("Friend Of Friend Flyer");
    await expect(page.locator("#board-rows")).not.toContainText("Stranger Flyer");
    await expect(page.locator("#board-show-all")).not.toBeChecked();
  });

  test("a viewer with no follow list is seeded from the curator's web of trust", async ({ page }) => {
    // The connected viewer has NO contact list; the curator follows TRUSTED, so
    // the board seeds its trust set from the curator and still hides UNTRUSTED.
    await stubNip07(page, ME);
    await stubRelays(page, [
      contactList(CURATOR, [TRUSTED]),
      flyerEvent("trusted", TRUSTED, "Trusted Flyer"),
      flyerEvent("untrusted", UNTRUSTED, "Untrusted Flyer")
    ]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-rows")).toContainText("Trusted Flyer");
    await expect(page.locator("#board-rows")).not.toContainText("Untrusted Flyer");
    // The note explains this is a seeded/curated set, not the viewer's own graph.
    await expect(page.locator("#board-filter-note")).toContainText(/don't follow anyone yet|curated/i);
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

  test("publishing shows a confirmation modal with the flyer URL", async ({ page }) => {
    // Stub the relay WebSocket so the publish resolves instantly with an OK.
    await page.addInitScript(() => {
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          try {
            const m = JSON.parse(data);
            if (m[0] === "EVENT" && m[1] && m[1].id) {
              const id = m[1].id;
              setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["OK", id, true, ""]) }), 1);
            }
          } catch (_) {}
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    });
    await page.goto("/#editor");
    await page.locator("#publish-event").click();
    const modal = page.locator("#publish-modal");
    await expect(modal).toBeVisible();
    await expect(page.locator("#publish-modal-title")).toHaveText("Flyer published");
    await expect(page.locator("#publish-modal-message")).toContainText("Copy this URL");
    // The URL is a poster URL (naddr in the fragment).
    await expect(page.locator("#publish-modal-url")).toHaveValue(/#naddr1[0-9a-z]+/);
    // The relays-accepted line reports how many of the relays took the event.
    await expect(page.locator("#publish-modal-relays")).toContainText(/3\s*\/\s*3/);
    await page.locator("#publish-modal-close").click();
    await expect(modal).toBeHidden();
  });

  test("editor defaults to anonymous signing", async ({ page }) => {
    await page.goto("/#editor");
    await expect(page.locator("#signer-state")).toHaveText("Publishing anonymously");
  });

  test("a deliberate editor identity choice syncs to the board's connected key", async ({ page }) => {
    const PK = "a".repeat(64);
    await page.addInitScript((pk) => {
      window.nostr = { getPublicKey: async () => pk, signEvent: async (e) => e };
    }, PK);
    await page.goto("/#editor");
    await page.locator("#connect-nip07").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your extension identity");
    // The board reads this shared key to reflect the same identity.
    expect(await page.evaluate(() => localStorage.getItem("voxvera_connected_pubkey"))).toBe(PK);
  });

  test("editor connects a NIP-46 remote signer and publishes through it", async ({ page }) => {
    const errors = trackErrors(page);
    // A fake relay that also plays the remote signer: it decrypts NIP-46
    // requests with real NIP-44 crypto and replies with signed responses.
    await page.addInitScript(() => {
      function hexToBytes(hex) {
        const b = new Uint8Array(hex.length / 2);
        for (let i = 0; i < b.length; i += 1) b[i] = parseInt(hex.substr(i * 2, 2), 16);
        return b;
      }
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          let m; try { m = JSON.parse(data); } catch (_) { return; }
          if (m[0] === "REQ") {
            this.sub = m[1];
            setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["EOSE", this.sub]) }), 1);
            return;
          }
          if (m[0] !== "EVENT") return;
          const ev = m[1];
          const NT = window.NostrTools;
          if (ev.kind === 24133) {
            const skBytes = hexToBytes(window.__nip46SkHex);
            const ck = NT.nip44.getConversationKey(skBytes, ev.pubkey);
            let req; try { req = JSON.parse(NT.nip44.decrypt(ev.content, ck)); } catch (_) { return; }
            let result = "";
            if (req.method === "connect") result = "ack";
            else if (req.method === "get_public_key") result = window.__nip46Pubkey;
            else if (req.method === "sign_event") {
              result = JSON.stringify(NT.finalizeEvent(JSON.parse(req.params[0]), skBytes));
            }
            const content = NT.nip44.encrypt(JSON.stringify({ id: req.id, result }), ck);
            const resp = NT.finalizeEvent({
              kind: 24133, created_at: Math.floor(Date.now() / 1000),
              tags: [["p", ev.pubkey]], content
            }, skBytes);
            const sub = this.sub;
            setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["EVENT", sub, resp]) }), 1);
            return;
          }
          // A published flyer event → acknowledge with OK.
          setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["OK", ev.id, true, ""]) }), 1);
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    });
    await page.goto("/#editor");
    // Mint the signer keypair in-page (NostrTools is loaded there).
    const signerPubkey = await page.evaluate(() => {
      const sk = window.NostrTools.generateSecretKey();
      window.__nip46SkHex = Array.from(sk).map((b) => b.toString(16).padStart(2, "0")).join("");
      window.__nip46Pubkey = window.NostrTools.getPublicKey(sk);
      return window.__nip46Pubkey;
    });
    const expectedNpub = await page.evaluate((pk) => window.NostrTools.nip19.npubEncode(pk), signerPubkey);
    // Paste a bunker URI pointing at the fake signer and connect.
    await page.locator("#use-nip46-toggle").click();
    await page.locator("#nip46-input").fill(`bunker://${signerPubkey}?relay=wss://relay.damus.io&secret=hunter2`);
    await page.locator("#nip46-submit").click();
    // The connect + get_public_key handshake resolves the user's identity.
    await expect(page.locator("#signer-state")).toHaveText("Publishing via remote signer");
    await expect(page.locator("#author-npub-output")).toHaveText(expectedNpub);
    // Publishing routes signing through the remote signer (sign_event round-trip).
    await page.locator("#field-title").fill("Remote Signed Flyer");
    await page.locator("#publish-event").click();
    await expect(page.locator("#event-id-output")).not.toHaveText(/not published/i);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("exports the current flyer design as a portable, identity-free JSON file", async ({ page }) => {
    await page.goto("/#editor");
    // Wait for the editor to finish populating defaults before overwriting them
    // (otherwise setDefaultText can race ahead of fill() on some engines).
    await expect(page.locator("#flyer-preview .container").first()).toBeVisible();
    await expect(page.locator("#field-url")).toHaveValue(/voxvera\.org/);
    // Edit fields with no live auto-fit guard so the values reliably stick on
    // every engine (the printable-fit guard on title/url can revert text whose
    // rendering overflows the sheet, which is engine/font-metric dependent).
    await page.locator("#field-name").fill("Campaign Alpha");
    await page.locator("#field-folder-name").fill("alpha-campaign");
    await page.locator("#editor-relays").fill("wss://relay.example.com");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator("#export-design").click()
    ]);
    const data = JSON.parse(require("fs").readFileSync(await download.path(), "utf8"));
    expect(data.type).toBe("voxvera_flyer_design");
    expect(data.flyer.name).toBe("Campaign Alpha");
    expect(data.flyer.folder_name).toBe("alpha-campaign");
    expect(data.relays).toContain("wss://relay.example.com");
    // The url field is captured faithfully, whatever the form currently holds.
    expect(data.flyer.url).toBe(await page.locator("#field-url").inputValue());
    // Identity-free: no naddr, event id, pubkey, or signature is baked in.
    const blob = JSON.stringify(data);
    expect(blob).not.toContain("naddr");
    expect(blob).not.toContain("\"sig\"");
    expect(blob).not.toContain("\"pubkey\"");
    await expect(page.locator("#publish-status")).toHaveText("Design exported.");
  });

  test("imports a design file and replaces the editor after confirming", async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto("/#editor");
    const design = {
      type: "voxvera_flyer_design",
      version: 1,
      flyer: {
        type: "voxvera_flyer", version: 1, folder_name: "imported", lang: "en",
        name: "Imported Name", title: "Imported Title", subtitle: "", headline: "",
        content: "Imported body", url_message: "", url: "https://example.org/imported",
        footer_message: "", attachment_path: "", attachment_filename: "", qr_target: "flyer_url"
      },
      relays: ["wss://imported.example.com"]
    };
    await page.setInputFiles("#import-design-input", {
      name: "design.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(design))
    });
    // A confirm step guards against clobbering the current draft.
    await expect(page.locator("#import-modal")).toBeVisible();
    await page.locator("#import-modal-confirm").click();
    await expect(page.locator("#import-modal")).toBeHidden();
    await expect(page.locator("#field-title")).toHaveValue("Imported Title");
    await expect(page.locator("#field-name")).toHaveValue("Imported Name");
    await expect(page.locator("#field-content")).toHaveValue("Imported body");
    await expect(page.locator("#editor-relays")).toHaveValue("wss://imported.example.com");
    await expect(page.locator("#publish-status")).toHaveText("Design imported.");
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("cancelling the import confirm leaves the editor unchanged", async ({ page }) => {
    await page.goto("/#editor");
    await page.locator("#field-title").fill("Keep Me");
    await page.setInputFiles("#import-design-input", {
      name: "design.json", mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        type: "voxvera_flyer_design", version: 1,
        flyer: { type: "voxvera_flyer", version: 1, title: "Should Not Apply", lang: "en" },
        relays: []
      }))
    });
    await expect(page.locator("#import-modal")).toBeVisible();
    await page.locator("#import-modal-cancel").click();
    await expect(page.locator("#import-modal")).toBeHidden();
    await expect(page.locator("#field-title")).toHaveValue("Keep Me");
  });

  test("rejects a file that isn't a valid VoxVera design", async ({ page }) => {
    await page.goto("/#editor");
    await page.setInputFiles("#import-design-input", {
      name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello":"world"}')
    });
    await expect(page.locator("#import-modal")).toBeHidden();
    await expect(page.locator("#publish-status")).toHaveText("That file isn't a valid VoxVera design.");
  });

  test("editor can connect a NIP-07 identity and publish under it", async ({ page }) => {
    const PK = "a".repeat(64);
    await page.addInitScript((pk) => {
      window.nostr = {
        getPublicKey: async () => pk,
        // Return a plausibly-signed event so the publish path completes.
        signEvent: async (e) => ({ ...e, pubkey: pk, id: "f".repeat(64), sig: "0".repeat(128) })
      };
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          try {
            const m = JSON.parse(data);
            if (m[0] === "EVENT" && m[1] && m[1].id) {
              const id = m[1].id;
              setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["OK", id, true, ""]) }), 1);
            }
          } catch (_) {}
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    }, PK);
    await page.goto("/#editor");
    const expectedNpub = await page.evaluate((pk) => window.NostrTools.nip19.npubEncode(pk), PK);
    await page.locator("#connect-nip07").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your extension identity");
    await expect(page.locator("#author-npub-output")).toHaveText(expectedNpub);
    // Publishing routes through window.nostr.signEvent and still shows the modal.
    await page.locator("#publish-event").click();
    await expect(page.locator("#publish-modal")).toBeVisible();
    // The poster naddr must encode the SAME pubkey that signed (not the anon key).
    const url = await page.locator("#publish-modal-url").inputValue();
    const naddrPk = await page.evaluate(
      (u) => window.NostrTools.nip19.decode(u.split("#")[1]).data.pubkey,
      url
    );
    expect(naddrPk).toBe(PK);
  });

  test("NIP-07 publish builds the naddr from the signer even before the pubkey loads", async ({ page }) => {
    // Regression: a flyer signed via NIP-07 had its poster naddr built from the
    // anonymous key whenever window.nostr.getPublicKey hadn't resolved yet (e.g.
    // right after a reload restored nip07 mode) — so the poster URL pointed at
    // the wrong author and would not load back. The naddr must match the signer.
    const PK = "b".repeat(64);
    await page.addInitScript((pk) => {
      // nip07 mode persisted (as after a reload), and getPublicKey is slow, so at
      // publish time the pubkey is not yet cached — the old bug's trigger.
      localStorage.setItem("voxvera_identity_mode", "nip07");
      window.nostr = {
        getPublicKey: () => new Promise((res) => setTimeout(() => res(pk), 400)),
        signEvent: async (e) => ({ ...e, pubkey: pk, id: "f".repeat(64), sig: "0".repeat(128) })
      };
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          try {
            const m = JSON.parse(data);
            if (m[0] === "EVENT" && m[1] && m[1].id) {
              setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["OK", m[1].id, true, ""]) }), 1);
            }
          } catch (_) {}
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    }, PK);
    await page.goto("/#editor");
    // Publish right away, while getPublicKey is still pending (pubkey not cached).
    await page.locator("#publish-event").click();
    await expect(page.locator("#publish-modal")).toBeVisible();
    const url = await page.locator("#publish-modal-url").inputValue();
    const naddrPk = await page.evaluate(
      (u) => window.NostrTools.nip19.decode(u.split("#")[1]).data.pubkey,
      url
    );
    expect(naddrPk).toBe(PK);
  });

  test("deleting a loaded flyer publishes a tombstone and a NIP-09 deletion", async ({ page }) => {
    const PK = "a".repeat(64);
    await page.addInitScript((pk) => {
      let n = 0;
      window.nostr = {
        getPublicKey: async () => pk,
        signEvent: async (e) => ({ ...e, pubkey: pk, id: (++n).toString(16).padStart(64, "0"), sig: "0".repeat(128) })
      };
      window.__published = [];
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          try {
            const m = JSON.parse(data);
            if (m[0] === "EVENT" && m[1] && m[1].id) {
              window.__published.push(m[1]);
              setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["OK", m[1].id, true, ""]) }), 1);
            }
          } catch (_) {}
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    }, PK);
    await page.goto("/#editor");
    await page.locator("#connect-nip07").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your extension identity");
    // Publish so a flyer is "loaded" and the delete/re-publish actions appear.
    await page.locator("#publish-event").click();
    await expect(page.locator("#publish-modal")).toBeVisible();
    await page.locator("#publish-modal-close").click();
    await expect(page.locator("#loaded-flyer-actions")).toBeVisible();
    // Delete → confirm.
    await page.locator("#delete-flyer").click();
    await expect(page.locator("#delete-modal")).toBeVisible();
    await page.locator("#delete-modal-confirm").click();
    await expect(page.locator(".flyer-status-message")).toContainText("This flyer was removed");
    const pub = await page.evaluate(() => window.__published);
    const tombstone = pub.find((e) => e.kind === 30078 && (e.tags || []).some((t) => t[0] === "deleted"));
    const deletion = pub.find((e) => e.kind === 5);
    expect(tombstone, "a replaceable tombstone is published").toBeTruthy();
    expect(JSON.parse(tombstone.content).deleted).toBe(true);
    expect(deletion, "a NIP-09 deletion request is published").toBeTruthy();
    expect((deletion.tags || []).some((t) => t[0] === "a" && t[1].startsWith(`30078:${PK}:voxvera:`))).toBe(true);
  });

  test("the board hides a flyer that has been tombstoned", async ({ page }) => {
    const A = "a".repeat(64);
    await stubNip07(page);
    await stubRelays(page, [
      flyerEvent("live", A, "Live Flyer"), // d=voxvera:live, created_at 2000
      {
        id: "9".repeat(64), kind: 30078, pubkey: A, created_at: 3000,
        tags: [["d", "voxvera:live"], ["t", "voxvera"], ["deleted", ""]],
        content: JSON.stringify({ type: "voxvera_flyer", version: 1, deleted: true, folder_name: "live", lang: "en" })
      }
    ]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    // The newer tombstone hides the flyer even though both are returned.
    await expect(page.locator("#board-rows")).not.toContainText("Live Flyer");
  });

  test("viewer shows a removed state for a tombstoned flyer", async ({ page }) => {
    const PK = "c".repeat(64);
    const IDENT = "voxvera:gone";
    await stubRelays(page, [{
      id: "d".repeat(64), kind: 30078, pubkey: PK, created_at: 5000,
      tags: [["d", IDENT], ["t", "voxvera"], ["deleted", ""]],
      content: JSON.stringify({ type: "voxvera_flyer", version: 1, deleted: true, folder_name: "gone", lang: "en" })
    }]);
    await page.goto("/");
    const naddr = await page.evaluate(({ pk, ident }) =>
      window.NostrTools.nip19.naddrEncode({ identifier: ident, pubkey: pk, kind: 30078, relays: [] }),
      { pk: PK, ident: IDENT });
    await page.goto("about:blank");
    await page.goto(`/#${naddr}`);
    await expect(page.locator(".flyer-status-message")).toContainText("This flyer was removed");
    await expect(page.locator(".content h1")).toHaveCount(0);
  });

  test("blocking an author hides their flyers, persists, and clears", async ({ page }) => {
    const OTHER = "b".repeat(64);
    await stubNip07(page); // viewer = 1*64
    await stubRelays(page, [flyerEvent("other", OTHER, "Someone Else's Flyer")]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-rows")).toContainText("Someone Else's Flyer");
    // Open the row's ⋯ menu, then Block. (force: a sticky header can overlap the
    // control after auto-scroll on a mobile viewport.)
    await page.locator(".board-menu-btn").first().click({ force: true });
    await page.locator('.board-menu-item[data-act="block"]').first().click({ force: true });
    await expect(page.locator("#board-rows")).not.toContainText("Someone Else's Flyer");
    await expect(page.locator("#board-blocked-note")).toBeVisible();
    // Persists across a reload…
    await page.reload();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-rows")).not.toContainText("Someone Else's Flyer");
    // …and "Clear blocked" restores it.
    await page.locator("#board-unblock-all").click();
    await expect(page.locator("#board-rows")).toContainText("Someone Else's Flyer");
  });

  test("the 'My flyers' filter shows only the connected user's flyers", async ({ page }) => {
    const ME = "1".repeat(64);
    const OTHER = "b".repeat(64);
    await stubNip07(page); // viewer = ME
    await stubRelays(page, [flyerEvent("mine", ME, "My Own Flyer"), flyerEvent("theirs", OTHER, "Other Flyer")]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-rows")).toContainText("My Own Flyer");
    await expect(page.locator("#board-rows")).toContainText("Other Flyer");
    // Click the label (WebKit treats a bare checkbox as not actionable); this is
    // also how a user toggles it.
    await page.locator("#board-mine-only-label").click();
    await expect(page.locator("#board-mine-only")).toBeChecked();
    await expect(page.locator("#board-rows")).toContainText("My Own Flyer");
    await expect(page.locator("#board-rows")).not.toContainText("Other Flyer");
  });

  test("the board shows author display names from kind-0 metadata", async ({ page }) => {
    const A = "a".repeat(64);
    await stubNip07(page);
    await stubRelays(page, [
      flyerEvent("byalice", A, "Alice's Flyer"),
      { id: "0".repeat(64), kind: 0, pubkey: A, created_at: 9000, tags: [], content: JSON.stringify({ name: "alice", display_name: "Alice A" }) }
    ]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    await expect(page.locator("#board-rows")).toContainText("Alice's Flyer");
    // display_name (preferred) appears once the kind-0 profiles load.
    await expect(page.locator(".board-author-name")).toContainText("Alice A");
  });

  test("the board shows manage actions on your flyers and Block on others", async ({ page }) => {
    const ME = "1".repeat(64);
    const OTHER = "b".repeat(64);
    await stubNip07(page); // viewer = ME
    await stubRelays(page, [flyerEvent("mine", ME, "My Flyer"), flyerEvent("theirs", OTHER, "Their Flyer")]);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    const myRow = page.locator("#board-rows tr", { hasText: "My Flyer" });
    await myRow.locator(".board-menu-btn").click({ force: true });
    await expect(myRow.locator('.board-menu-item[data-act="rebroadcast"]')).toBeVisible();
    await expect(myRow.locator('.board-menu-item[data-act="delete"]')).toBeVisible();
    await expect(myRow.getByText("Edit")).toBeVisible();
    await expect(myRow.locator('.board-menu-item[data-act="block"]')).toHaveCount(0);
    await page.keyboard.press("Escape"); // close the first row's menu
    const theirRow = page.locator("#board-rows tr", { hasText: "Their Flyer" });
    await theirRow.locator(".board-menu-btn").click({ force: true });
    await expect(theirRow.locator('.board-menu-item[data-act="block"]')).toBeVisible();
    await expect(theirRow.locator('.board-menu-item[data-act="delete"]')).toHaveCount(0);
  });

  test("deleting your own flyer from the board publishes a tombstone + NIP-09", async ({ page }) => {
    const ME = "a".repeat(64);
    await page.addInitScript((me) => {
      let n = 0;
      window.nostr = {
        getPublicKey: async () => me,
        signEvent: async (e) => ({ ...e, pubkey: me, id: (++n).toString(16).padStart(64, "0"), sig: "0".repeat(128) })
      };
      window.__published = [];
      const flyer = {
        id: "e".repeat(64), kind: 30078, pubkey: me, created_at: 2000,
        tags: [["d", "voxvera:mine"], ["t", "voxvera"], ["t", "flyer"], ["language", "en"]],
        content: JSON.stringify({ type: "voxvera_flyer", version: 1, folder_name: "mine", lang: "en", title: "My Flyer", subtitle: "s", headline: "h", content: "c", url_message: "m", url: "https://example.com/m", footer_message: "f", tear_off_link: "https://voxvera.org/#naddr1m", qr_target: "flyer_url" })
      };
      const matches = (ev, f) => {
        if (f.kinds && f.kinds.indexOf(ev.kind) === -1) return false;
        if (f.authors && f.authors.indexOf(ev.pubkey) === -1) return false;
        if (f["#t"]) { const tv = (ev.tags || []).filter((x) => x[0] === "t").map((x) => x[1]); if (!f["#t"].some((v) => tv.indexOf(v) !== -1)) return false; }
        return true;
      };
      class FakeWS {
        constructor() { this.readyState = 1; setTimeout(() => this.onopen && this.onopen(), 1); }
        send(data) {
          let m; try { m = JSON.parse(data); } catch (_) { return; }
          if (m[0] === "REQ") {
            const sub = m[1], f = m[2] || {};
            setTimeout(() => {
              if (matches(flyer, f)) this.onmessage && this.onmessage({ data: JSON.stringify(["EVENT", sub, flyer]) });
              this.onmessage && this.onmessage({ data: JSON.stringify(["EOSE", sub]) });
            }, 1);
          } else if (m[0] === "EVENT") {
            window.__published.push(m[1]);
            setTimeout(() => this.onmessage && this.onmessage({ data: JSON.stringify(["OK", m[1].id, true, ""]) }), 1);
          }
        }
        close() {}
      }
      window.WebSocket = FakeWS;
    }, ME);
    await page.goto("/board.html");
    await page.locator("#board-connect").click();
    await expect(page.locator("#board-content")).toBeVisible();
    const myRow = page.locator("#board-rows tr", { hasText: "My Flyer" });
    // Open the ⋯ menu, then Delete. (force: sticky header overlap on mobile.)
    await myRow.locator(".board-menu-btn").click({ force: true });
    await myRow.locator('.board-menu-item[data-act="delete"]').click({ force: true });
    await expect(page.locator("#board-delete-modal")).toBeVisible();
    await page.locator("#board-delete-confirm").click({ force: true });
    await expect(page.locator("#board-rows")).not.toContainText("My Flyer");
    const pub = await page.evaluate(() => window.__published);
    expect(pub.some((e) => e.kind === 30078 && (e.tags || []).some((t) => t[0] === "deleted"))).toBe(true);
    expect(pub.some((e) => e.kind === 5 && (e.tags || []).some((t) => t[0] === "a" && t[1] === `30078:${ME}:voxvera:mine`))).toBe(true);
  });

  test("editor imports an nsec for the session without storing the secret", async ({ page }) => {
    await page.goto("/#editor");
    const { nsec, npub } = await page.evaluate(() => {
      const t = window.NostrTools;
      const sk = t.generateSecretKey();
      return { nsec: t.nip19.nsecEncode(sk), npub: t.nip19.npubEncode(t.getPublicKey(sk)) };
    });
    await page.locator("#use-nsec-toggle").click();
    await page.locator("#nsec-input").fill(nsec);
    await page.locator("#nsec-submit").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your imported key");
    await expect(page.locator("#author-npub-output")).toHaveText(npub);
    // No "remember" → nothing encrypted is stored, and the mode falls back to
    // anonymous on reload (so no dead lock).
    expect(await page.evaluate(() => localStorage.getItem("voxvera_identity_nsec_enc"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("voxvera_identity_mode"))).toBe("anon");
  });

  test("an invalid nsec in the editor shows an error", async ({ page }) => {
    await page.goto("/#editor");
    await page.locator("#use-nsec-toggle").click();
    await page.locator("#nsec-input").fill("nsec1clearlynotvalid");
    await page.locator("#nsec-submit").click();
    await expect(page.locator("#identity-error")).toContainText(/valid nsec/i);
    await expect(page.locator("#signer-state")).toHaveText("Publishing anonymously");
  });

  test("a remembered nsec is PIN-encrypted at rest and unlocks on reload", async ({ page }) => {
    // PBKDF2 at 600k iterations (encrypt + two decrypts) is CPU-heavy on WebKit
    // under full parallelism; give it room rather than weakening the KDF.
    test.slow();
    await page.goto("/#editor");
    const { nsec, npub, hex } = await page.evaluate(() => {
      const t = window.NostrTools;
      const sk = t.generateSecretKey();
      const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      return { nsec: t.nip19.nsecEncode(sk), npub: t.nip19.npubEncode(t.getPublicKey(sk)), hex: toHex(sk) };
    });
    await page.locator("#use-nsec-toggle").click();
    await page.locator("#nsec-input").fill(nsec);
    await page.locator("#nsec-remember").check();
    await page.locator("#nsec-pin").fill("13579");
    await page.locator("#nsec-submit").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your imported key");
    // What's stored is an AES-GCM blob, never the plaintext secret.
    const stored = await page.evaluate(() => localStorage.getItem("voxvera_identity_nsec_enc"));
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(hex);
    expect(stored).not.toContain(nsec);
    expect(JSON.parse(stored)).toHaveProperty("ct");

    // Reload → the identity is locked and requires the PIN. (reload() forces a
    // real document load; goto("/#editor") here would be a same-document hash
    // change that keeps JS memory, so the in-memory key would never clear.)
    await page.reload();
    await expect(page.locator("#identity-locked-row")).toBeVisible();
    await expect(page.locator("#identity-state")).toHaveText("Locked");
    // Wrong PIN is rejected.
    await page.locator("#unlock-pin").fill("00000");
    await page.locator("#unlock-key").click();
    await expect(page.locator("#identity-error")).toContainText(/Wrong PIN/i);
    // Correct PIN unlocks and restores the imported identity.
    await page.locator("#unlock-pin").fill("13579");
    await page.locator("#unlock-key").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your imported key");
    await expect(page.locator("#author-npub-output")).toHaveText(npub);
  });

  test("forgetting a stored identity clears it and returns to anonymous", async ({ page }) => {
    test.slow(); // PBKDF2 encrypt is CPU-heavy on WebKit under full parallelism.
    await page.goto("/#editor");
    const nsec = await page.evaluate(() => window.NostrTools.nip19.nsecEncode(window.NostrTools.generateSecretKey()));
    await page.locator("#use-nsec-toggle").click();
    await page.locator("#nsec-input").fill(nsec);
    await page.locator("#nsec-remember").check();
    await page.locator("#nsec-pin").fill("2468");
    await page.locator("#nsec-submit").click();
    // Wait for the (async) encrypt+persist to finish before reloading, or the
    // stored blob may not exist yet on slower engines.
    await expect(page.locator("#signer-state")).toHaveText("Publishing as your imported key");
    await page.reload();
    await expect(page.locator("#identity-locked-row")).toBeVisible();
    await page.locator("#forget-key").click();
    await expect(page.locator("#signer-state")).toHaveText("Publishing anonymously");
    expect(await page.evaluate(() => localStorage.getItem("voxvera_identity_nsec_enc"))).toBeNull();
  });

  test("unlock is locked out while the wrong-PIN cooldown is active", async ({ page }) => {
    // Seed a locked identity + an active lockout deadline so we exercise the
    // enforcement path without running several slow PBKDF2 decrypts.
    await page.addInitScript(() => {
      localStorage.setItem("voxvera_identity_mode", "nsec");
      localStorage.setItem("voxvera_identity_nsec_enc", JSON.stringify({ v: 1, iters: 600000, salt: "AAAA", iv: "BBBB", ct: "CCCC" }));
      localStorage.setItem("voxvera_identity_unlock_until", String(Date.now() + 60000));
    });
    await page.goto("/#editor");
    await expect(page.locator("#identity-locked-row")).toBeVisible();
    await page.locator("#unlock-pin").fill("1234");
    await page.locator("#unlock-key").click();
    await expect(page.locator("#identity-error")).toContainText(/too many attempts/i);
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
