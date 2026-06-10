# VoxVera Roadmap & Known Issues

This document captures known limitations and the development directions that
would address them. None of these are code bugs — they are product- and
threat-model-level gaps in the current static Nostr client. They are listed
roughly in priority order: the trust model (#1–#2) is the highest-leverage area
because almost every other risk flows from it being undefined.

Status legend: **Open** (not started) · **Partial** (some mitigation exists) ·
**Planned** (committed direction) · **In progress** (partially shipped).

---

## 1. Bulletin board has no moderation or abuse story — **In progress**

> Direction agreed and **Phases 1–2 shipped**: the board requires a connected
> Nostr identity to view, and it now filters to flyers from the viewer's NIP-02
> web of trust (with a bootstrap seed for new keys). See *Planned direction:
> identity + web-of-trust on the board* below (jointly addresses #1 and #2).
> Remaining: degree-2 trust, blocklist/report, NIP-05 badges (Phase 3).


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
  persistence (per-device, no server needed).
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
- **Phase 3 — Optional / next.** Degree-2 trust (follows-of-follows), a local
  blocklist / "hide this", report-to-list, and NIP-05 verified badges. Also:
  the bootstrap curator is currently a single hardcoded pubkey — consider making
  it configurable or a small curated set.

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
  password field, the value is cleared after use, and nothing is transmitted, but
  a NIP-46 remote signer would be a safer mobile path to add later.
- **Editor identity (shipped).** The editor now signs under anon / NIP-07 /
  imported nsec. A remembered nsec is PIN-encrypted at rest (PBKDF2 600k →
  AES-GCM); plaintext is never stored. **Known weakness:** a short numeric PIN is
  brute-forceable offline if the encrypted blob leaks — it guards casual snooping,
  not a targeted attacker. Next: NIP-46 remote signer; an attempt-limit / lockout
  on repeated wrong PINs; and optionally encrypting the anonymous device key the
  same way (today it is stored in plaintext, as before).
- **Editor vs board identity are independent.** The editor's publishing identity
  and the board's viewing identity are stored separately and don't yet sync; a
  future pass could share one connected identity across both pages.

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

## 4. Relay permanence is overstated — **Open**

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
- **No favicon** — browsers log a harmless `404 /favicon.ico`. Cosmetic.
- **WebKit/Safari coverage in CI** needs `libavif16` on Linux runners
  (`sudo npx playwright install-deps`); headless WebKit is also not a perfect
  stand-in for real Safari/iOS print + clipboard behavior, so a real-device
  pass before releases is still worth it.

---

*Reviewed 2026-06-09. The highest-leverage next decision is the trust model
(who can post, who appears on the board); most other risks resolve more easily
once that is defined.*
