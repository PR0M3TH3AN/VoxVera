// @ts-check
// Pure-Node guard (no browser): fails if any localized dictionary is missing a
// key in some language, or has an extra one. We add user-facing strings across
// 14 languages by hand, so this catches drift before it ships as a fallback to
// English (or a raw key) for some users.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

function readSite(file) {
  return fs.readFileSync(path.join(__dirname, "..", "site", file), "utf8");
}

// Extract the first balanced { ... } object literal after a marker, string-aware
// so braces inside strings don't throw off the depth count.
function extractObject(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`marker not found: ${marker}`);
  const open = src.indexOf("{", start);
  let depth = 0;
  let str = null;
  let esc = false;
  for (let j = open; j < src.length; j += 1) {
    const c = src[j];
    if (str) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === str) str = null;
    } else if (c === '"' || c === "'" || c === "`") {
      str = c;
    } else if (c === "{") {
      depth += 1;
    } else if (c === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, j + 1);
    }
  }
  throw new Error(`unbalanced braces for ${marker}`);
}

function evalObject(objectText) {
  // The literals are pure data (label strings); safe to evaluate.
  return Function(`return (${objectText});`)();
}

function checkParity(label, dict, refLang = "en") {
  const langs = Object.keys(dict);
  expect(langs, `${label}: no ${refLang} reference`).toContain(refLang);
  const ref = Object.keys(dict[refLang]).sort();
  for (const lang of langs) {
    const keys = Object.keys(dict[lang]).sort();
    const missing = ref.filter((k) => !keys.includes(k));
    const extra = keys.filter((k) => !ref.includes(k));
    expect(missing, `${label}[${lang}] is missing: ${missing.join(", ")}`).toEqual([]);
    expect(extra, `${label}[${lang}] has unexpected keys: ${extra.join(", ")}`).toEqual([]);
  }
}

test.describe("i18n key parity", () => {
  test("NOSTR_UI defines every key in all languages", () => {
    const dict = evalObject(extractObject(readSite("nostr-client.js"), "const NOSTR_UI ="));
    expect(Object.keys(dict).length).toBe(14);
    checkParity("NOSTR_UI", dict);
  });

  test("BOARD_UI defines every key in all languages", () => {
    const dict = evalObject(extractObject(readSite("board.js"), "const BOARD_UI ="));
    expect(Object.keys(dict).length).toBe(14);
    checkParity("BOARD_UI", dict);
  });

  test("locales labels and landing match across all languages", () => {
    const locales = Function(`var window={}; ${readSite("locales.js")}; return window.VoxVeraLocales;`)();
    const labels = {};
    const landing = {};
    for (const [lang, v] of Object.entries(locales)) {
      labels[lang] = v.labels || {};
      landing[lang] = v.landing || {};
    }
    checkParity("locales.labels", labels);
    checkParity("locales.landing", landing);
  });
});
