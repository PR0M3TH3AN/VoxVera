# VoxVera Roadmap & Known Issues

This document captures known limitations and the development directions that
would address them. None of these are code bugs — they are product- and
threat-model-level gaps in the current static Nostr client. They are listed
roughly in priority order: the trust model (#1–#2) is the highest-leverage area
because almost every other risk flows from it being undefined.

Status legend: **Open** (not started) · **Partial** (some mitigation exists) ·
**Planned** (committed direction) · **In progress** (partially shipped).

## Shipped so far (2026-06-10)

The trust model (#1–#2) has moved from undefined to implemented:

- **Bulletin board login gate** — viewing the board requires a connected Nostr
  identity (NIP-07 extension, a pasted `nsec`, or a generated key).
- **Web-of-trust filter (degree-2)** — the board defaults to flyers from authors
  in the viewer's NIP-02 follow graph *and the people those follows follow*
  (follows-of-follows), seeded from a curator account for fresh keys, with a
  "Show all" opt-out (so it is no longer an unmoderated firehose).
- **Editor↔board identity sync** — a deliberate editor identity choice (NIP-07,
  imported/generated/unlocked nsec, or anonymous) is shared with the board via a
  local pubkey, so the same person sees a consistent identity across both pages.
- **Editor publishing identity** — authors can publish anonymously (default),
  via NIP-07, or with an imported `nsec` that is optionally PIN-encrypted at
  rest (PBKDF2 → AES-GCM; plaintext never stored).
- **Flyer management (edit / re-publish / delete)** — an author can edit a
  loaded flyer (re-publish replaces in place via the `d` tag), re-publish as a
  keep-alive, or delete it. Delete is belt-and-suspenders: a replaceable
  **tombstone** (so the board/viewer hide it even on relays that ignore NIP-09)
  plus a **NIP-09** deletion request. Best-effort, author-only. These actions are
  available in the editor and inline on the bulletin board (Edit / Re-broadcast /
  Delete on your own rows).
- **Local blocklist** — a per-device "Block" on the board hides flyers from any
  author you didn't post (separate from the web-of-trust filter), with a clear
  control. This is the local blocklist direction from #1.
- **Report (NIP-56)** — a board "Report" action on others' flyers publishes a
  signed **kind-1984** report (category + optional reason) referencing the flyer
  (`e`) and author (`p`), so other clients and moderators can aggregate it.
  Reporting also hides the flyer locally (pairs with the blocklist).
- **Author display names** — the board shows each author's kind-0 display name
  (falling back to the npub), so flyers aren't labeled by bare keys. (NIP-05
  *verification* is still a future addition.)
- **"My flyers" filter** — a board toggle to show only the connected user's own
  flyers (overrides the trust filter, since your own may not be in your graph).

All of the above is localized across the 14 languages and covered by the
cross-engine Playwright suite. **What remains** on #1–#2 is polish (NIP-05
badges, an identified-vs-anonymous display) plus
the editor follow-ups noted under the *Planned direction* section. **#3–#5 are
still fully open** — distribution centralization (#3) is now the
highest-leverage untouched item.

---

## 1. Bulletin board has no moderation or abuse story — **In progress**

> Direction agreed and **Phases 1–2 shipped**: the board requires a connected
> Nostr identity to view, and it now filters to flyers from the viewer's NIP-02
> web of trust (with a bootstrap seed for new keys). See *Planned direction:
> identity + web-of-trust on the board* below (jointly addresses #1 and #2).
> Remaining: NIP-05 badges (Phase 3). Degree-2 trust + NIP-56 report shipped.


**Problem.** `board.html` lists every Nostr event tagged `t=voxvera` / `t=flyer`
from the public default relays, with no filtering, verification, or moderation.
Anyone can publish a kind-`30078` event with those tags and immediately appear
on the board — including spam, hostile titles, or links to harmful content, all
under VoxVera's branding.

**Current mitigation (Partial on safety, not abuse).** Relay content is treated
as untrusted: titles and npubs are HTML-escaped, and link URLs are rejected
unless `http(s)` (so `javascript:`/`data:` never render). This prevents script
injection but does nothing about spam or unwanted-but-valid content.

**Why it matters.** A static client cannot rate-limit or moderate server-side,
so the board is trivially gameable the moment it is used adversarially. This is
the single biggest liability for promoting the board publicly.

**Possible directions.**
- Client-side curation: an allowlist of npubs (a "follows"/featured set) so the
  default view shows only vetted authors.
- A local, user-controlled blocklist / "hide this" with `localStorage`
  persistence (per-device, no server needed). **✅ Shipped** — the board's
  per-row **Block** (`voxvera_blocked_pubkeys`).
- A dedicated VoxVera relay (or relay set) that applies its own admission
  policy, with the public relays as fallback.
- A "report" affordance that records to a relay/list a curator can act on.
- Make the unfiltered firehose an explicit opt-in mode, not the default.

Depends on **#2** (without identity, allowlists/blocklists are weak).

## 2. Anonymous keys give no authenticity or accountability — **In progress**

> Phases 1–2 shipped: the board viewer connects a real Nostr identity (NIP-07)
> and the board is filtered by that viewer's web of trust (with a curator seed
> for new keys), so spam from unknown authors is hidden by default. The **editor
> now lets authors publish under their own identity too** — NIP-07, an imported
> `nsec` (optionally PIN-encrypted at rest), or stay anonymous (default) — so a
> flyer can carry a stable, identifiable author when the creator wants one.
> Authenticity *display* on the board (NIP-05 badges, an identified/anonymous
> distinction) remains ahead.

**Problem.** The client generates a fresh anonymous key per browser, so the
board's "Posted by" npub is effectively random and there is no way to verify a
flyer came from who it claims. The trust model is currently empty.

**Why it matters.** Authenticity underpins the board, "report"/blocklist
features, and any notion of a trusted author. Without stable identity, #1 has no
foundation to build on.

**Possible directions.**
- Optional persistent identity: let a user keep/reuse a key (or import one) and
  associate it with their flyers, while keeping anonymous-by-default.
- First-class NIP-07 support for users who already have a Nostr identity.
- Optional NIP-05 / verified handle display on the board.
- A clear UI distinction between "anonymous" and "identified" flyers.

The npub column on the board was built deliberately forward-looking so this
maps in cleanly.

## Planned direction: identity + web-of-trust on the board

Jointly addresses #1 and #2. The goal is to make the board accountable without
abandoning anonymous-by-default authoring.

**Key reality that shapes the design.** You cannot gate *writing* to public
relays — anyone can publish a `t=voxvera` event directly, never touching this
client. So a "login required to post" button is only a soft deterrent; it can't
bound what is on the board. The real lever is **filtering what the board
displays**. Login's actual job is to supply the *viewer's* identity so the
board can show them flyers from people they trust.

**Principles.**
- **Login enables a trust-filtered view; it is not access control.** The data
  is public on relays regardless, so hiding it in the UI is cosmetic. Treat
  login as "we know who you are, so we can show you a trustworthy board."
- **Keep anonymous creation + printing fully available.** The core authoring
  tool must not require a persistent, linkable identity (activist threat model).
  Identity is required only to *appear on the public board*, not to make/print a
  flyer.
- **Web-of-trust is the actual spam defense, not login.** NIP-07 keys are free
  and unlimited, so "must have a key" alone just makes a spammer generate one.
  Filtering by the viewer's NIP-02 follow graph (degree 1, optionally
  follows-of-follows) is what raises the cost.
- **Don't lock out mobile.** NIP-07 (`window.nostr`) needs a desktop extension,
  but scanned-QR flyers open on phones. "Login" should support NIP-07 **plus**
  nsec import (with warnings) and/or NIP-46 remote signer, and/or promoting the
  existing anonymous key to a kept identity.

**Phased plan.**
- **Phase 1 — Identity. ✅ Shipped.** The board (`board.html` / `board.js`) shows
  a login gate instead of the table until the viewer connects. Three methods: a
  NIP-07 extension (`window.nostr.getPublicKey()`), pasting an `nsec`, or creating
  a new key (see decision 2 below). On success it reveals the table, surfaces the
  connected npub with a Disconnect control, and remembers the pubkey in
  `localStorage` (`voxvera_connected_pubkey`) so a return visit reconnects from
  the pubkey alone — no prompt or re-entry, regardless of method. Anonymous
  create/print is untouched — connecting is required only to *view the board*.
- **Phase 2 — Web-of-trust filter. ✅ Shipped.** On connect the board fetches
  the viewer's NIP-02 contact list (kind 3) and defaults to flyers from authors
  in their follow graph (degree 1) plus themselves, with a **"Show all"**
  opt-out. **Bootstrap seed:** a viewer with no follow list of their own (a
  fresh key) is seeded from a pinned curator account's follows
  (`FALLBACK_CURATOR_PUBKEY` in `board.js` =
  `npub15jnttpymeytm80hatjqcvhhqhzrhx6gxp8pq0wn93rhnu8s9h9dsha32lx`), so a brand-
  new viewer still gets a curated board instead of the unmoderated firehose. If
  no trust data can be fetched at all, the board falls back to showing
  everything (never mysteriously empty). Covered by the cross-engine e2e suite
  (followed-only view + show-all opt-out; curator-seeded fallback).
- **Phase 3 — In progress.** Degree-2 trust (follows-of-follows) ✅ shipped; the
  local blocklist / "hide this" ✅ shipped; NIP-56 reporting (kind 1984) ✅
  shipped. **Remaining:** NIP-05 verified badges, and a curator-side flow that
  *consumes* reports (today a report is published for others to aggregate, but
  the board does not yet act on report counts). Also: the bootstrap curator is a
  single hardcoded pubkey — consider making it configurable or a small set.

**Decisions made (2026-06-10).**
1. **Board viewing: login-required.** The board is blank (a Connect prompt)
   until a Nostr identity is connected — framed as a members' space rather than a
   public discovery surface.
2. **Login methods: NIP-07 + nsec import + key generation. ✅ Shipped.** The gate
   offers three ways in: a NIP-07 browser extension, pasting a private key
   (`nsec`), or creating a new key. The nsec is decoded **in-page** to derive the
   pubkey and then discarded — only the pubkey is persisted, since the board only
   reads (never signs). "Create a new key" reuses this device's existing
   anonymous key if present (so it doesn't orphan an editor identity) or
   generates one, and reveals the `nsec` with a "save this — we can't recover it"
   warning before continuing. This **resolves the earlier mobile-lockout
   trade-off**: a phone visitor with no extension can now generate or paste a key
   to view the board. Covered by the cross-engine e2e suite (nsec import +
   pubkey-only persistence + reload restore; invalid nsec; key generation +
   reveal + connect).

**Follow-ups this opens.**
- **In-page nsec handling.** Pasting a secret key into a web page is inherently
  riskier than a NIP-07 extension that keeps the key isolated; the input is a
  password field, the value is cleared after use, and nothing is transmitted. The
  **NIP-46 remote signer** (below) is now the safer mobile path.
- **NIP-46 remote signer (shipped).** The editor can connect a remote signer
  (bunker) by pasting a `bunker://` link: the user's secret stays in their signer
  app (nsec.app, Amber, …) and the browser only holds an ephemeral local key. The
  client is hand-rolled over a raw WebSocket using the vendored NIP-44 (with a
  NIP-04 decrypt fallback) — the bundle ships no nip46 module. Connections are
  **session-only** (the bunker token is never written to disk, so a reload returns
  to anonymous). Covered by the cross-engine e2e suite (full connect →
  get_public_key → sign_event → publish round-trip against a fake signer doing
  real NIP-44 crypto).
- **Editor identity (shipped).** The editor signs under anon / NIP-07 / imported
  nsec / remote signer. A remembered nsec is PIN-encrypted at rest (PBKDF2 600k →
  AES-GCM); plaintext is never stored. **Known weakness:** a short numeric PIN is
  brute-forceable offline if the encrypted blob leaks — it guards casual snooping,
  not a targeted attacker. A **wrong-PIN lockout** is now in place (3 bad PINs →
  a 30s cooldown, persisted across reloads). Optionally encrypting the anonymous
  device key the same way is still open (today it is stored in plaintext, as
  before).
- **Editor↔board identity sync (shipped).** A deliberate editor identity choice
  (NIP-07 / imported / generated / unlocked nsec / remote signer) writes a shared
  local pubkey the board reads, so one connected identity is reflected across both
  pages.

## 3. Client distribution is centralized (a single chokepoint) — **Open**

**Problem.** The content lives on decentralized relays, but the *client* is one
domain (`voxvera.org`) on a centralized host (Vercel). A censor can block the
domain and most users are stuck, which undercuts the censorship-resistance
premise even though the backend is robust.

**Current mitigation (Partial).** The client is fully static and host-agnostic,
so it *can* be served from any static host or mirror — but discovery and trust
of mirrors is unsolved, so in practice users depend on the canonical domain.

**Possible directions.**
- Document and support official mirrors (IPFS/IPNS, other static hosts) with a
  verifiable build (subresource integrity / reproducible hash).
- A one-file/offline build users can save and reopen (`file://`) — verify
  WebCrypto/clipboard degrade gracefully off a secure context.
- Revisit the dropped Tor/onion distribution path as an *optional* mirror (kept
  off `main` per current guardrails, but a documented option).
- Publish the client itself to a content-addressed network so the front door is
  not a single DNS name.

## 4. Relay permanence is overstated — **Partial**

> Partial mitigation shipped: the editor now has a **Re-publish (keep-alive)**
> action, so an author can refresh a flyer before relays age it out. The durable
> fix (a pinned/dedicated relay) is still open.

**Problem.** The app depends on a few general-purpose relays
(`relay.damus.io`, `nos.lol`, `relay.primal.net`) that can prune app-data kinds,
rate-limit, or drop events. "Your flyer is still there later" is therefore not
guaranteed. The single relay hint in the `naddr` also reduces fetch robustness
for events not on the default set.

**Possible directions.**
- Run/pin a dedicated VoxVera relay (or several) so published flyers have a
  durable home, with the public relays as redundancy.
- Let authors configure and embed their own preferred relays.
- Consider a re-broadcast / "keep alive" helper for important flyers.
- Reconsider how many relay hints to embed in the poster `naddr` (tradeoff:
  URL length / QR density vs. fetch robustness — see the QR Target notes in the
  spec).
- **Self-contained fallback payload in the URL fragment (future).** Because a
  printed flyer cannot be edited, a pruned/unreachable event leaves a dead QR.
  The flyer payload is small (text only), so it could be compressed and encoded
  into the URL `#fragment` alongside the `naddr`, letting the viewer render the
  flyer *even when no relay has the event* — relay-independent durability, which
  fits the censorship-resistance pitch. **Constraint:** the tear-off QR URL is
  already near scannable capacity, so this likely can't be added without
  reducing the number of tear-off tabs and/or enlarging the QR (denser code,
  harder scan). Best treated as an opt-in "durable QR" mode rather than the
  default, and decided alongside the tab-count/QR-size tradeoff. The `naddr`
  remains the primary resolver; the embedded payload is a last-resort fallback.

## 5. Content-safety guardrails are minimal — **Open**

**Problem.** Beyond HTML-escaping and URL-scheme rejection, there is nothing
preventing the tool (and especially the public board) from being used to author
or surface illegal/harmful content carrying VoxVera's branding.

**Possible directions.** Tie this to #1/#2: curation, reporting, and a clear
terms/acceptable-use stance for any hosted board. A purely local authoring tool
has a smaller surface than a public discovery board, so scope decisions here
should follow the board's trust model.

---

## Smaller / lower-priority items

- **Field-fit is layout-measured, not a fixed cap.** Robust, but capacity
  varies with font availability and zoom; the
  [cheat sheet](flyer-field-limits.md) is explicitly approximate. Fine as-is;
  noted so it is not mistaken for a contract.
- **Favicon — ✅ done.** A small inline SVG (`site/favicon.svg`) is linked from
  both pages, so browsers no longer request (and 404 on) `/favicon.ico`.
- **i18n key-parity guard — ✅ done.** `e2e/i18n.spec.js` fails if any
  `NOSTR_UI` / `BOARD_UI` / `SAFETY_UI` / locales dictionary is missing (or has
  an extra) key in some language (and that the `SAFETY_UI` bullet lists are the
  same length in every language). It immediately caught `field_too_long`, which
  had been English-only across all 13 other languages.
- **Safety & privacy page — ✅ done.** A standalone `/safety` page
  (`safety.html` / `safety.js`), localized across all 14 languages, in plain
  language: what VoxVera protects, what it does **not** (relays see your IP; the
  anon key is plaintext in the browser; a short PIN won't stop a targeted
  attacker; published events are public/permanent; nsec-paste risk; reports are
  public; the host/relays still see requests), and operational tips (Tor/VPN,
  disposable keys, signer apps). Linked from the editor and the board. Aimed at
  the activist/whistleblower audience the aesthetic invites — being honest about
  limits matters more than any feature.
- **Link previews / Open Graph — partial, by design.** Static site-wide OG +
  Twitter-card meta are on the home, board, and safety pages, so a shared
  `voxvera.org` link renders a real title/description instead of nothing.
  **Per-flyer previews are a deliberate non-goal:** the poster `naddr` lives in
  the URL `#fragment` (invisible to servers), and a static host can't render
  per-flyer `<meta>` without server-side code — which is out of scope by choice
  (this stays a free, purely static site). Revisit only if that constraint ever
  changes.
- **Publish transparency — ✅ done.** The publish confirmation modal now reports
  how many relays accepted the event ("Relays accepted: N / M") and flags a
  zero-acceptance publish, so a weak publish is visible immediately.
- **WebKit/Safari coverage in CI** needs `libavif16` on Linux runners
  (`sudo npx playwright install-deps`); headless WebKit is also not a perfect
  stand-in for real Safari/iOS print + clipboard behavior, so a real-device
  pass before releases is still worth it.

---

*Reviewed 2026-06-10. The trust model (#1–#2) is now implemented — see "Shipped
so far" above. The highest-leverage untouched item is now #3 (the client is a
single centralized domain), since it most undercuts the censorship-resistance
premise even with the backend on decentralized relays.*
