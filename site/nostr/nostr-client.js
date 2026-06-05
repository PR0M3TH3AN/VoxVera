(function () {
  "use strict";

  const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net"
  ];
  const ANON_SECRET_STORAGE_KEY = "voxvera_nostr_anon_secret_hex";
  const UI_LANG_STORAGE_KEY = "voxvera_nostr_lang";
  const LOCALES = window.VoxVeraLocales || {};
  const FALLBACK_LANG = "en";
  const EVENT_KIND = 30078;
  const FIELD_LIMITS = {
    folder_name: 64,
    name: 120,
    title: 80,
    subtitle: 120,
    headline: 160,
    content: 10000,
    url_message: 240,
    url: 2048,
    footer_message: 240
  };
  const CONFIG_DEFAULTS = {
    name: "Vox Vera Printable Flyers",
    folder_name: "voxvera",
    lang: "en",
    title: "TOP SECRET",
    subtitle: "DO ~~NOT~~ DISTRIBUTE",
    headline: "OPERATION VOX VERA",
    content: `Break free from censorship with VoxVera. An anonymous guerrilla marketing and message-spreading tool. Whether online or in the physical world, it can empower you to spread your ideas boldly, shielded by complete anonymity (if you host over Tor). Download the code, design a flyer site, host it online and amplify your message.

Use memetic power to share your ideas in your school, workplace, online communities, or even globally. VoxVera ensures your message resonates far and wide, with tear-off sections featuring unique URLs and QR codes for easy reprinting.

Privacy can be maintained. Flyers can be shared via the Tor network, protecting hoster and users from censorship.

Join us in a revolution that values truth and transparency. Together, we can build a network of informed citizens who are unafraid to speak out.`,
    url_message: "Follow this link to learn more.",
    url: "https://voxvera.org/",
    tear_off_link: "",
    footer_message: "0110010 0101011 0110010 0111101 0110100",
    attachment_path: "",
    attachment_filename: ""
  };
  const UI_LABELS = {
    "label-relays": "cli.init_links",
    "label-flyer-name": "cli.init_folder",
    "label-page-title": "cli.init_name",
    "label-title": "cli.init_title",
    "label-subtitle": "cli.init_subtitle",
    "label-headline": "cli.init_headline",
    "label-content": "cli.init_body",
    "label-url-message": "cli.url_message_label",
    "label-poster-url": "cli.url_label",
    "label-footer-message": "cli.footer_message_label"
  };
  const BUTTON_LABELS = {
    "preview-editor": "Preview",
    "export-event": "Export event JSON",
    "publish-event": "Sign and publish",
    "copy-viewer-config": "Copy config JSON",
    "print-preview": "Print preview",
    "open-viewer-controls": "Load Event",
    "viewer-print": "Print",
    "viewer-editor": "Editor",
    "close-viewer-controls": "Close",
    "generate-anon-identity": "Generate anonymous npub",
    "viewer-fetch-render": "Fetch and render"
  };
  const HEADING_LABELS = {
    "editor-heading": "Editor",
    "viewer-heading": "Viewer",
    "published-event-heading": "Published Event",
    "normalized-config-heading": "Normalized Config",
    "preview-heading": "Preview"
  };

  const el = (id) => document.getElementById(id);

  function localeData(lang) {
    return LOCALES[lang] || LOCALES[FALLBACK_LANG] || {};
  }

  function supportedLang(lang) {
    return LOCALES[lang] ? lang : FALLBACK_LANG;
  }

  function translate(path, lang) {
    const data = localeData(supportedLang(lang));
    return path.split(".").reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), data);
  }

  function localeDefaults(lang) {
    const data = localeData(lang);
    const landing = data.landing || {};
    return {
      ...CONFIG_DEFAULTS,
      name: landing.name || CONFIG_DEFAULTS.name,
      folder_name: slugify(landing.name || CONFIG_DEFAULTS.folder_name),
      lang: supportedLang(lang),
      title: landing.title || CONFIG_DEFAULTS.title,
      subtitle: landing.subtitle || CONFIG_DEFAULTS.subtitle,
      headline: landing.headline || CONFIG_DEFAULTS.headline,
      content: landing.content || CONFIG_DEFAULTS.content,
      url_message: landing.url_message || CONFIG_DEFAULTS.url_message,
      url: CONFIG_DEFAULTS.url,
      tear_off_link: "",
      footer_message: CONFIG_DEFAULTS.footer_message,
      attachment_path: "",
      attachment_filename: ""
    };
  }

  function setText(id, value) {
    const node = el(id);
    if (node) node.textContent = value;
  }

  function setButtonText(id, value) {
    const node = el(id);
    if (node) node.textContent = value;
  }

  function populateLanguageOptions() {
    const langEntries = Object.entries(LOCALES).sort((a, b) => {
      const aName = (a[1] && a[1].meta && a[1].meta.language_name) || a[0];
      const bName = (b[1] && b[1].meta && b[1].meta.language_name) || b[0];
      return aName.localeCompare(bName);
    });
    ["field-lang", "viewer-lang"].forEach((selectId) => {
      const select = el(selectId);
      if (!select) return;
      select.innerHTML = "";
      for (const [code, data] of langEntries) {
        const option = document.createElement("option");
        option.value = code;
        const meta = data.meta || {};
        option.textContent = `${meta.flag || ""} ${meta.language_name || code}`.trim();
        select.appendChild(option);
      }
    });
  }

  function syncUiLanguage(lang) {
    const selected = supportedLang(lang);
    const data = localeData(selected);
    const meta = data.meta || {};
    document.documentElement.lang = selected;
    document.documentElement.dir = meta.direction || "ltr";
    try {
      window.localStorage.setItem(UI_LANG_STORAGE_KEY, selected);
    } catch (_) {}

    Object.entries(UI_LABELS).forEach(([id, path]) => {
      const translated = translate(path, selected);
      if (translated) setText(id, translated);
    });
    Object.entries(HEADING_LABELS).forEach(([id, value]) => setText(id, value));
    Object.entries(BUTTON_LABELS).forEach(([id, value]) => setButtonText(id, value));
    setButtonText("print-preview", translate("web.print_button", selected) || BUTTON_LABELS["print-preview"]);
    setButtonText("viewer-print", translate("web.print_button", selected) || BUTTON_LABELS["viewer-print"]);
    setButtonText("viewer-editor", translate("cli.manage_action_edit", selected) || BUTTON_LABELS["viewer-editor"]);
    setButtonText("close-viewer-controls", translate("cli.manage_action_back", selected) || BUTTON_LABELS["close-viewer-controls"]);

    ["field-lang", "viewer-lang"].forEach((selectId) => {
      const select = el(selectId);
      if (select) select.value = selected;
    });
  }

  function setDefaultText(lang) {
    const relayText = DEFAULT_RELAYS.join("\n");
    el("editor-relays").value = relayText;
    el("viewer-relays").value = relayText;
    populateLanguageOptions();
    const defaultLang = supportedLang(lang || getStoredUiLang() || navigator.language.split("-")[0]);
    applyFlyerDefaults(defaultLang);
    renderPreview(localeDefaults(defaultLang));
    refreshSignerState();
    refreshIdentityState();
  }

  function getStoredUiLang() {
    try {
      const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
      return stored && LOCALES[stored] ? stored : "";
    } catch (_) {
      return "";
    }
  }

  function applyFlyerDefaults(lang) {
    const defaults = localeDefaults(lang);
    el("field-lang").value = defaults.lang;
    el("field-folder-name").value = defaults.folder_name;
    el("field-name").value = defaults.name;
    el("field-title").value = defaults.title;
    el("field-subtitle").value = defaults.subtitle;
    el("field-headline").value = defaults.headline;
    el("field-content").value = defaults.content;
    el("field-url-message").value = defaults.url_message;
    el("field-url").value = defaults.url;
    el("field-footer-message").value = defaults.footer_message;
    syncUiLanguage(defaults.lang);
  }

  function refreshSignerState() {
    const state = el("signer-state");
    if (window.nostr && typeof window.nostr.signEvent === "function") {
      state.textContent = "Anonymous signing is default; NIP-07 detected";
      state.style.color = "#1d6b3a";
      return;
    }
    state.textContent = "Anonymous signing available; no NIP-07 login required";
    state.style.color = "#1d6b3a";
  }

  function nostrTools() {
    if (!window.NostrTools) {
      throw new Error("Nostr tools bundle did not load.");
    }
    return window.NostrTools;
  }

  function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function hexToBytes(hex) {
    if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error("Invalid anonymous secret key.");
    const bytes = new Uint8Array(32);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  }

  function getStoredAnonSecret() {
    try {
      const stored = window.localStorage.getItem(ANON_SECRET_STORAGE_KEY);
      return stored && /^[a-f0-9]{64}$/i.test(stored) ? stored : "";
    } catch (_) {
      return "";
    }
  }

  function storeAnonSecret(secretHex) {
    try {
      window.localStorage.setItem(ANON_SECRET_STORAGE_KEY, secretHex);
    } catch (_) {}
  }

  function getOrCreateAnonIdentity(forceNew = false) {
    const tools = nostrTools();
    let secretHex = forceNew ? "" : getStoredAnonSecret();
    if (!secretHex) {
      secretHex = bytesToHex(tools.generateSecretKey());
      storeAnonSecret(secretHex);
    }
    const secretKey = hexToBytes(secretHex);
    const pubkey = tools.getPublicKey(secretKey);
    const npub = tools.nip19.npubEncode(pubkey);
    const nsec = tools.nip19.nsecEncode(secretKey);
    return { secretKey, secretHex, pubkey, npub, nsec };
  }

  function refreshIdentityState() {
    const state = el("identity-state");
    const output = el("author-npub-output");
    if (!state || !output) return;
    try {
      const secretHex = getStoredAnonSecret();
      if (!secretHex) {
        state.textContent = "No anonymous npub yet";
        state.style.color = "#8a4d00";
        output.textContent = "Not generated";
        return;
      }
      const identity = getOrCreateAnonIdentity(false);
      state.textContent = "Anonymous npub ready";
      state.style.color = "#1d6b3a";
      output.textContent = identity.npub;
      updatePosterAddressOutputs();
    } catch (error) {
      state.textContent = error.message;
      state.style.color = "#8a4d00";
    }
  }

  function parseRelays(value) {
    return value
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, list) => item.startsWith("wss://") && list.indexOf(item) === index);
  }

  function slugify(value) {
    const slug = String(value || "voxvera")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, FIELD_LIMITS.folder_name);
    return slug || "voxvera";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function redactionToHtml(value) {
    return escapeHtml(value).replace(/~~(.*?)~~/g, '<span style="text-decoration: line-through;">$1</span>');
  }

  function buildPayloadFromForm() {
    const lang = supportedLang(el("field-lang").value || FALLBACK_LANG);
    const payload = {
      type: "voxvera_flyer",
      version: 1,
      folder_name: slugify(el("field-folder-name").value),
      lang,
      name: el("field-name").value.trim(),
      title: el("field-title").value.trim(),
      subtitle: el("field-subtitle").value.trim(),
      headline: el("field-headline").value.trim(),
      content: el("field-content").value.trim(),
      url_message: el("field-url-message").value.trim(),
      url: el("field-url").value.trim(),
      footer_message: el("field-footer-message").value.trim(),
      attachment_path: "",
      attachment_filename: "",
      qr_target: "flyer_url"
    };
    validatePayload(payload);
    return payload;
  }

  function validatePayload(payload) {
    if (payload.type !== "voxvera_flyer") throw new Error("Payload type must be voxvera_flyer.");
    if (payload.version !== 1) throw new Error("Payload version must be 1.");
    Object.entries(FIELD_LIMITS).forEach(([key, limit]) => {
      if (payload[key] && payload[key].length > limit) {
        throw new Error(`${key} exceeds ${limit} characters.`);
      }
    });
    Object.entries(payload).forEach(([key, value]) => {
      if (typeof value === "string" && key !== "url" && /<\s*\/?\s*[a-z][^>]*>|on[a-z]+\s*=/i.test(value)) {
        throw new Error(`${key} contains raw HTML.`);
      }
    });
    if (payload.url) {
      const parsed = new URL(payload.url);
      if (!["http:", "https:", "nostr:"].includes(parsed.protocol)) {
        throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
      }
    }
  }

  function normalizePayload(payload) {
    validatePayload(payload);
    const lang = supportedLang(payload.lang || FALLBACK_LANG);
    return {
      ...CONFIG_DEFAULTS,
      name: payload.name || CONFIG_DEFAULTS.name,
      folder_name: slugify(payload.folder_name),
      lang,
      title: payload.title || CONFIG_DEFAULTS.title,
      subtitle: payload.subtitle || CONFIG_DEFAULTS.subtitle,
      headline: payload.headline || CONFIG_DEFAULTS.headline,
      content: payload.content || CONFIG_DEFAULTS.content,
      url_message: payload.url_message || CONFIG_DEFAULTS.url_message,
      url: payload.url || CONFIG_DEFAULTS.url,
      footer_message: payload.footer_message || CONFIG_DEFAULTS.footer_message,
      attachment_path: "",
      attachment_filename: ""
    };
  }

  function buildUnsignedEvent(payload) {
    const folderName = slugify(payload.folder_name);
    return {
      kind: EVENT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["d", `voxvera:${folderName}`],
        ["t", "voxvera"],
        ["t", "flyer"],
        ["title", payload.headline || payload.title || folderName],
        ["language", payload.lang || "en"]
      ],
      content: JSON.stringify(payload)
    };
  }

  function flyerIdentifier(payload) {
    return `voxvera:${slugify(payload.folder_name)}`;
  }

  function buildNaddr(identity, payload, relays) {
    return nostrTools().nip19.naddrEncode({
      identifier: flyerIdentifier(payload),
      pubkey: identity.pubkey,
      kind: EVENT_KIND,
      relays
    });
  }

  function clientBaseUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function posterUrlForNaddr(naddr) {
    return `${clientBaseUrl()}?addr=${encodeURIComponent(naddr)}`;
  }

  function withPosterUrl(payload, identity, relays) {
    const naddr = buildNaddr(identity, payload, relays);
    return {
      payload: {
        ...payload,
        url: posterUrlForNaddr(naddr),
        qr_target: "flyer_url"
      },
      naddr,
      posterUrl: posterUrlForNaddr(naddr)
    };
  }

  function updatePosterAddressOutputs() {
    const naddrOutput = el("naddr-output");
    const posterUrlOutput = el("poster-url-output");
    if (!naddrOutput || !posterUrlOutput) return null;
    try {
      const relays = parseRelays(el("editor-relays").value);
      const identity = getOrCreateAnonIdentity(false);
      const payload = buildPayloadFromForm();
      const poster = withPosterUrl(payload, identity, relays);
      naddrOutput.textContent = poster.naddr;
      posterUrlOutput.textContent = poster.posterUrl;
      el("field-url").value = poster.posterUrl;
      return poster;
    } catch (_) {
      return null;
    }
  }

  async function signAndPublish(payload, relays) {
    const identity = getOrCreateAnonIdentity(false);
    const poster = withPosterUrl(payload, identity, relays);
    const signed = nostrTools().finalizeEvent(buildUnsignedEvent(poster.payload), identity.secretKey);
    el("author-npub-output").textContent = identity.npub;
    el("naddr-output").textContent = poster.naddr;
    el("poster-url-output").textContent = poster.posterUrl;
    el("field-url").value = poster.posterUrl;
    refreshIdentityState();
    if (!signed.id || !signed.sig) {
      throw new Error("Signer returned an event without id/sig.");
    }
    const results = await publishEvent(signed, relays);
    return { event: signed, results, naddr: poster.naddr, posterUrl: poster.posterUrl, payload: poster.payload };
  }

  function publishEvent(event, relays) {
    return Promise.all(relays.map((relay) => publishToRelay(event, relay)));
  }

  function publishToRelay(event, relay) {
    return new Promise((resolve) => {
      const ws = new WebSocket(relay);
      const timeout = setTimeout(() => {
        try { ws.close(); } catch (_) {}
        resolve({ relay, ok: false, message: "timeout" });
      }, 9000);

      ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
      ws.onmessage = (message) => {
        try {
          const data = JSON.parse(message.data);
          if (data[0] === "OK" && data[1] === event.id) {
            clearTimeout(timeout);
            ws.close();
            resolve({ relay, ok: Boolean(data[2]), message: data[3] || "" });
          }
        } catch (_) {}
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve({ relay, ok: false, message: "connection error" });
      };
    });
  }

  function fetchEvent(eventId, relays) {
    return new Promise((resolve, reject) => {
      const sub = `voxvera-${Math.random().toString(16).slice(2)}`;
      let found = null;
      let remaining = relays.length;
      const sockets = relays.map((relay) => {
        const ws = new WebSocket(relay);
        ws.onopen = () => ws.send(JSON.stringify(["REQ", sub, { ids: [eventId], kinds: [EVENT_KIND], limit: 1 }]));
        ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            if (data[0] === "EVENT" && data[2] && data[2].id === eventId && !found) {
              found = data[2];
              sockets.forEach((socket) => {
                try { socket.send(JSON.stringify(["CLOSE", sub])); socket.close(); } catch (_) {}
              });
              resolve(found);
            }
          } catch (_) {}
        };
        ws.onerror = () => {
          remaining -= 1;
          if (remaining <= 0 && !found) reject(new Error("No relay returned the event."));
        };
        return ws;
      });
      setTimeout(() => {
        if (!found) {
          sockets.forEach((socket) => {
            try { socket.close(); } catch (_) {}
          });
          reject(new Error("Timed out fetching event."));
        }
      }, 12000);
    });
  }

  function fetchReplaceable(address, relays) {
    return new Promise((resolve, reject) => {
      const sub = `voxvera-addr-${Math.random().toString(16).slice(2)}`;
      let best = null;
      let remaining = relays.length;
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        sockets.forEach((socket) => {
          try { socket.send(JSON.stringify(["CLOSE", sub])); socket.close(); } catch (_) {}
        });
        if (best) {
          resolve(best);
        } else {
          reject(new Error("No relay returned the addressed flyer."));
        }
      };

      const sockets = relays.map((relay) => {
        const ws = new WebSocket(relay);
        ws.onopen = () => ws.send(JSON.stringify(["REQ", sub, {
          authors: [address.pubkey],
          kinds: [address.kind],
          "#d": [address.identifier],
          limit: 1
        }]));
        ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            if (data[0] === "EVENT" && data[2]) {
              const event = data[2];
              const hasMatchingD = Array.isArray(event.tags) && event.tags.some((tag) => tag[0] === "d" && tag[1] === address.identifier);
              if (event.pubkey === address.pubkey && event.kind === address.kind && hasMatchingD && (!best || event.created_at > best.created_at)) {
                best = event;
              }
            }
            if (data[0] === "EOSE") {
              remaining -= 1;
              if (remaining <= 0) finish();
            }
          } catch (_) {}
        };
        ws.onerror = () => {
          remaining -= 1;
          if (remaining <= 0) finish();
        };
        return ws;
      });

      setTimeout(finish, 5000);
    });
  }

  function parseEventReference(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      const rawId = decoded.match(/\b[a-f0-9]{64}\b/i);
      if (rawId) return { type: "event", id: rawId[0].toLowerCase(), relays: [] };
      const nipMatch = decoded.match(/(?:nostr:)?((?:note1|nevent1|naddr1)[023456789acdefghjklmnpqrstuvwxyz]+)/i);
      if (!nipMatch) return null;
      const tools = nostrTools();
      const result = tools.nip19.decode(nipMatch[1].toLowerCase());
      if (result.type === "note") {
        return { type: "event", id: result.data, relays: [] };
      }
      if (result.type === "nevent") {
        return { type: "event", id: result.data.id, relays: result.data.relays || [] };
      }
      if (result.type === "naddr") {
        return {
          type: "address",
          address: result.data,
          relays: result.data.relays || []
        };
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function getUrlEventReference() {
    const search = new URLSearchParams(window.location.search);
    const params = ["addr", "naddr", "event", "id", "note", "nevent"];
    for (const param of params) {
      const value = search.get(param);
      const parsed = parseEventReference(value);
      if (parsed) return parsed;
    }

    const hash = window.location.hash.replace(/^#/, "");
    const hashParts = hash.split(/[?&/]/).filter(Boolean);
    for (const part of hashParts) {
      const parsed = parseEventReference(part);
      if (parsed) return parsed;
    }

    return parseEventReference(window.location.href);
  }

  function mergeRelayList(existingValue, extraRelays) {
    return parseRelays(`${existingValue}\n${(extraRelays || []).join("\n")}`).join("\n");
  }

  function payloadFromEvent(event) {
    if (!event || event.kind !== EVENT_KIND) throw new Error("Event kind is not a VoxVera source kind.");
    const hasTag = (name, value) => Array.isArray(event.tags) && event.tags.some((tag) => tag[0] === name && tag[1] === value);
    if (!hasTag("t", "voxvera") || !hasTag("t", "flyer")) throw new Error("Event is missing VoxVera flyer tags.");
    const payload = JSON.parse(event.content);
    validatePayload(payload);
    return payload;
  }

  function makeQrSvg(value) {
    if (!value) return "";
    if (typeof qrcode !== "function") {
      return '<span class="qr-error">QR unavailable</span>';
    }
    try {
      const qr = qrcode(0, "M");
      qr.addData(value);
      qr.make();
      return qr.createSvgTag({
        cellSize: 2,
        margin: 2,
        scalable: true
      });
    } catch (_) {
      return '<span class="qr-error">QR too long</span>';
    }
  }

  function renderPreview(config) {
    const flyerLang = supportedLang(config.lang || FALLBACK_LANG);
    const flyerLocale = localeData(flyerLang);
    const tearOff = config.tear_off_link || config.url || "";
    const contentQr = config.url || tearOff;
    const tearOffQrSvg = makeQrSvg(tearOff);
    const contentQrSvg = makeQrSvg(contentQr);
    const sheetClass = tearOff ? "container" : "container no-tear-offs";
    const tearOffHtml = Array.from({ length: 10 }).map(() => `
      <div class="tear-off">
        <div class="tear-off-text">
          Open this poster:<br>
          <a href="${escapeHtml(tearOff)}">${escapeHtml(tearOff)}</a><br>
          Share and reprint.
        </div>
        <div class="qr-code" aria-label="QR code for ${escapeHtml(tearOff)}">${tearOffQrSvg}</div>
      </div>
    `).join("");
    el("flyer-preview").innerHTML = `
      <div class="${sheetClass}" lang="${escapeHtml(flyerLang)}" dir="${escapeHtml((flyerLocale.meta && flyerLocale.meta.direction) || "ltr")}">
        <div class="left-tear-offs">${tearOffHtml}</div>
        <div class="content">
          <h1>${redactionToHtml(config.title)}</h1>
          <div class="distribute">${redactionToHtml(config.subtitle)}</div>
          <h1>${redactionToHtml(config.headline)}</h1>
          <hr>
          <div class="message">${redactionToHtml(config.content)}</div>
          <div class="qr-code-body">
            <div class="qr-code-url">
              <span class="url-message">${redactionToHtml(config.url_message)}</span><br><br>
              <a href="${escapeHtml(config.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(config.url)}</a>
            </div>
            <div class="qr-code main-qr" aria-label="QR code for ${escapeHtml(contentQr)}">${contentQrSvg}</div>
          </div>
          <hr>
          <div class="footer">
            <p class="credit">Built with <a href="https://github.com/PR0M3TH3AN/VoxVera">voxvera</a></p>
            <p class="binary">${redactionToHtml(config.footer_message)}</p>
          </div>
        </div>
      </div>
    `;
  }

  function formToPreview() {
    const payload = buildPayloadFromForm();
    const relays = parseRelays(el("editor-relays").value);
    const identity = getOrCreateAnonIdentity(false);
    const poster = withPosterUrl(payload, identity, relays);
    el("author-npub-output").textContent = identity.npub;
    el("naddr-output").textContent = poster.naddr;
    el("poster-url-output").textContent = poster.posterUrl;
    el("field-url").value = poster.posterUrl;
    refreshIdentityState();
    syncUiLanguage(poster.payload.lang);
    renderPreview(normalizePayload(poster.payload));
  }

  function setMode(mode) {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
    el("editor-panel").classList.toggle("active", mode === "editor");
    el("viewer-panel").classList.toggle("active", mode === "viewer");
    document.body.classList.toggle("mode-editor", mode === "editor");
    document.body.classList.toggle("mode-viewer", mode === "viewer");
    if (mode === "viewer") {
      closeViewerDrawer();
    }
    if (!window.location.hash || window.location.hash === "#editor" || window.location.hash === "#viewer") {
      history.replaceState(null, "", `#${mode}`);
    }
  }

  function openViewerDrawer() {
    el("viewer-panel").classList.add("drawer-open");
  }

  function closeViewerDrawer() {
    el("viewer-panel").classList.remove("drawer-open");
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderRelayResults(results) {
    return `<div class="relay-results">${results.map((item) => `
      <div>
        <span>${escapeHtml(item.relay)}:</span>
        <span class="${item.ok ? "relay-ok" : "relay-error"}">${item.ok ? "OK" : escapeHtml(item.message || "failed")}</span>
      </div>
    `).join("")}</div>`;
  }

  async function copyTextFromElement(targetId, button) {
    const value = el(targetId).textContent.trim();
    if (!value || value === "Not published" || value === "Not generated") return;
    await navigator.clipboard.writeText(value);
    const oldText = button.textContent;
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = oldText;
    }, 1200);
  }

  async function fetchAndRenderFromInput(eventInput, relaysValue, statusElement = el("viewer-status")) {
    const parsed = parseEventReference(eventInput);
    if (!parsed) throw new Error("Enter an naddr, event id, note1, or nevent1.");
    const relays = parseRelays(`${relaysValue}\n${(parsed.relays || []).join("\n")}`);
    if (!relays.length) throw new Error("Enter at least one wss:// relay.");
    el("viewer-event-id").value = eventInput;
    el("viewer-relays").value = relays.join("\n");
    statusElement.textContent = "Fetching...";
    const nostrEvent = parsed.type === "address"
      ? await fetchReplaceable(parsed.address, relays)
      : await fetchEvent(parsed.id, relays);
    const payload = payloadFromEvent(nostrEvent);
    const config = normalizePayload(payload);
    syncUiLanguage(config.lang);
    el("field-lang").value = config.lang;
    el("viewer-config-output").value = JSON.stringify(config, null, 2);
    renderPreview(config);
    statusElement.textContent = `Fetched ${parsed.type === "address" ? parsed.address.identifier : parsed.id}`;
    closeViewerDrawer();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setDefaultText(getStoredUiLang() || navigator.language.split("-")[0]);
    const urlEvent = getUrlEventReference();
    setMode(window.location.hash === "#editor" && !urlEvent ? "editor" : "viewer");
    if (urlEvent) {
      const urlInput = window.location.href;
      el("viewer-event-id").value = urlInput;
      el("viewer-relays").value = mergeRelayList(el("viewer-relays").value, urlEvent.relays);
      fetchAndRenderFromInput(urlInput, el("viewer-relays").value).catch((error) => {
        el("viewer-status").textContent = error.message;
        openViewerDrawer();
      });
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    });

    el("field-lang").addEventListener("change", () => {
      const lang = supportedLang(el("field-lang").value || FALLBACK_LANG);
      applyFlyerDefaults(lang);
      renderPreview(buildPayloadFromForm());
    });
    el("viewer-lang").addEventListener("change", () => {
      const lang = supportedLang(el("viewer-lang").value || FALLBACK_LANG);
      applyFlyerDefaults(lang);
      renderPreview(buildPayloadFromForm());
    });

    el("open-viewer-controls").addEventListener("click", openViewerDrawer);
    el("close-viewer-controls").addEventListener("click", closeViewerDrawer);
    el("viewer-editor").addEventListener("click", () => setMode("editor"));
    el("viewer-print").addEventListener("click", () => window.print());
    document.querySelectorAll(".copy-button").forEach((button) => {
      button.addEventListener("click", () => {
        copyTextFromElement(button.dataset.copyTarget, button).catch((error) => {
          el("publish-status").textContent = error.message;
        });
      });
    });
    el("generate-anon-identity").addEventListener("click", () => {
      try {
        const identity = getOrCreateAnonIdentity(true);
        el("author-npub-output").textContent = identity.npub;
        refreshIdentityState();
        el("publish-status").textContent = `Anonymous npub generated: ${identity.npub}`;
      } catch (error) {
        el("publish-status").textContent = error.message;
      }
    });

    el("preview-editor").addEventListener("click", () => {
      try {
        formToPreview();
        el("publish-status").textContent = "Preview updated.";
      } catch (error) {
        el("publish-status").textContent = error.message;
      }
    });

    el("export-event").addEventListener("click", () => {
      try {
        const payload = buildPayloadFromForm();
        const relays = parseRelays(el("editor-relays").value);
        const identity = getOrCreateAnonIdentity(false);
        const poster = withPosterUrl(payload, identity, relays);
        const event = buildUnsignedEvent(poster.payload);
        el("author-npub-output").textContent = identity.npub;
        el("naddr-output").textContent = poster.naddr;
        el("poster-url-output").textContent = poster.posterUrl;
        el("field-url").value = poster.posterUrl;
        el("event-json-output").value = JSON.stringify(event, null, 2);
        downloadJson(`${poster.payload.folder_name}-voxvera-event-unsigned.json`, event);
      } catch (error) {
        el("publish-status").textContent = error.message;
      }
    });

    el("editor-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const payload = buildPayloadFromForm();
        const relays = parseRelays(el("editor-relays").value);
        if (!relays.length) throw new Error("Enter at least one wss:// relay.");
        el("publish-status").textContent = "Signing and publishing...";
        const result = await signAndPublish(payload, relays);
        el("event-id-output").textContent = result.event.id;
        el("event-json-output").value = JSON.stringify(result.event, null, 2);
        el("viewer-event-id").value = result.naddr;
        el("publish-status").innerHTML = renderRelayResults(result.results);
        renderPreview(normalizePayload(result.payload));
      } catch (error) {
        el("publish-status").textContent = error.message;
      }
    });

    el("viewer-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await fetchAndRenderFromInput(el("viewer-event-id").value, el("viewer-relays").value);
      } catch (error) {
        el("viewer-status").textContent = error.message;
      }
    });

    el("copy-viewer-config").addEventListener("click", async () => {
      const value = el("viewer-config-output").value;
      if (!value) return;
      await navigator.clipboard.writeText(value);
      el("viewer-status").textContent = "Config copied.";
    });

    el("print-preview").addEventListener("click", () => window.print());
  });
})();
