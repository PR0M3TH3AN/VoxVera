# VoxVera Roadmap & Known Issues

This document captures known limitations and the development directions that
would address them. None of these are code bugs — they are product- and
threat-model-level gaps in the current static Nostr client. They are listed
roughly in priority order: the trust model (#1–#2) is the highest-leverage area
because almost every other risk flows from it being undefined.

Status legend: **Open** (not started) · **Partial** (some mitigation exists) ·
**Planned** (committed direction).

---

## 1. Bulletin board has no moderation or abuse story — **Open**

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

## 2. Anonymous keys give no authenticity or accountability — **Open**

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
