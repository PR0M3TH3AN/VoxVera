# Flyer Field Length Cheat Sheet

How much text fits in each flyer field, by script.

VoxVera does **not** impose a fixed character count. The editor measures the
rendered flyer live and rejects a keystroke the moment a field would overflow
the printable sheet (you'll see an inline "too long" error under that field).
So the real limit is enforced for you as you type — the numbers below are
practical guidance for drafting copy, sizing translations, or prompting an LLM
to write flyer text that will fit on the first try.

Capacity varies by **script** (not by individual language) and by **paper
size**, for these reasons:

1. The flyer body font is monospace (`Courier New`), so within a script every
   character takes the same width regardless of upper/lowercase.
2. Per-script letter-spacing policy (`ls-full` / `ls-cjk` / `ls-none`, see
   [`nostr-static-client-spec.md`](nostr-static-client-spec.md#letter-spacing-by-script)).
3. Glyph width differs by script — CJK glyphs are full-width (≈2× a Latin
   character), Devanagari fallback glyphs are narrower, etc.
4. **Paper size.** A4 (210×297mm) is slightly narrower and taller than US
   Letter (8.5×11in), so single-line fields hold ~2 fewer characters on A4
   while the body holds a little more. Both sizes are shown below.

## Single-line fields (hard caps)

**Title**, **Subtitle**, and **Headline** are single-line: they never wrap, so
these are the limits people actually run into. Counts are characters
(codepoints), shown as **Letter / A4**.

| Languages | Title & Headline | Subtitle |
|---|---|---|
| Latin & Cyrillic & Hebrew — en, es, de, fr, pt, sw, tr, ru, he | ~28 / ~26 | ~32 / ~30 |
| Arabic & Persian — ar, fa | ~28 / ~27 | ~38 / ~36 |
| Devanagari — hi | ~36 / ~35 | ~51 / ~48 |
| CJK — ja, zh | ~17 / ~16 | ~23 / ~21 |

## Multi-line fields (generous)

**Body** (content), **Link message** (`url_message`), and **Footer**
(`footer_message`) wrap across multiple lines, so they hold far more and are
bounded only by the remaining height of the sheet.

| Languages | Body (content) — Letter / A4 |
|---|---|
| Latin & Cyrillic & Hebrew | ~1,900 / ~2,000 (a few hundred words) |
| Arabic & Persian | ~1,850 / ~1,930 |
| Devanagari — hi | ~2,450 / ~2,545 |
| CJK — ja, zh | ~1,170 / ~1,220 |

`url_message` and `footer_message` share the lower portion of the sheet and can
hold roughly 1,200–4,800 characters depending on script, but for a readable
flyer keep the link message to a sentence and the footer to a short line.

The **URL** field is a link, not body copy — keep it short both because it's
shown verbatim on the flyer and because it becomes the main QR code (shorter
URLs scan more reliably).

## Notes and caveats

- **Approximate.** These come from rendering each script in a headless browser
  at true print size for both Letter (8.5×11in) and A4 (210×297mm). The
  Latin/Cyrillic numbers (`Courier New`) are the most reliable; numbers for
  Hebrew, Arabic, Persian, Devanagari, and CJK depend on the system fallback
  font, which can differ slightly between devices and from print output.
- **The app is authoritative.** If the editor accepts your text it fits; if it
  rejects it, shorten it. Treat this sheet as a target, not a contract.
- **Redaction markup counts.** Wrapping text in `~~double tildes~~` renders it
  struck-through; the four `~` characters count toward the field length even
  though they don't appear on the flyer.
- **Re-measuring.** If the flyer layout, font, or letter-spacing policy
  changes, these numbers should be re-derived by rendering each script at print
  size and binary-searching each field for the largest run of characters that
  does not overflow the field target or the sheet.
