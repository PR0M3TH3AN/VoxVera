(function () {
  "use strict";

  // Standalone bulletin-board page. It reuses the vendored nostr-tools and the
  // shared locale data, but is independent of nostr-client.js (which is an IIFE
  // and exports nothing), so its UI strings live in BOARD_UI below.

  const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net"
  ];
  const EVENT_KIND = 30078;
  const UI_LANG_STORAGE_KEY = "voxvera_nostr_lang";
  const FALLBACK_LANG = "en";
  const LOCALES = window.VoxVeraLocales || {};

  const BOARD_UI = {
    en: { title: "Bulletin Board", subtitle: "Most recent flyers published to the relays.", col_title: "Title", col_link: "Link", col_author: "Posted by", col_language: "Language", col_date: "Posted", link_text: "link", loading: "Loading flyers…", empty: "No flyers found yet.", error: "Could not reach the relays.", back: "← Back to VoxVera" },
    es: { title: "Tablón de anuncios", subtitle: "Carteles más recientes publicados en los relés.", col_title: "Título", col_link: "Enlace", col_author: "Publicado por", col_language: "Idioma", col_date: "Publicado", link_text: "enlace", loading: "Cargando carteles…", empty: "Aún no se encontraron carteles.", error: "No se pudo conectar con los relés.", back: "← Volver a VoxVera" },
    de: { title: "Schwarzes Brett", subtitle: "Neueste auf den Relays veröffentlichte Plakate.", col_title: "Titel", col_link: "Link", col_author: "Veröffentlicht von", col_language: "Sprache", col_date: "Veröffentlicht", link_text: "Link", loading: "Plakate werden geladen…", empty: "Noch keine Plakate gefunden.", error: "Relays konnten nicht erreicht werden.", back: "← Zurück zu VoxVera" },
    fr: { title: "Tableau d'affichage", subtitle: "Affiches les plus récentes publiées sur les relais.", col_title: "Titre", col_link: "Lien", col_author: "Publié par", col_language: "Langue", col_date: "Publié", link_text: "lien", loading: "Chargement des affiches…", empty: "Aucune affiche trouvée pour l'instant.", error: "Impossible de joindre les relais.", back: "← Retour à VoxVera" },
    ru: { title: "Доска объявлений", subtitle: "Последние листовки, опубликованные на реле.", col_title: "Заголовок", col_link: "Ссылка", col_author: "Опубликовал", col_language: "Язык", col_date: "Опубликовано", link_text: "ссылка", loading: "Загрузка листовок…", empty: "Листовки пока не найдены.", error: "Не удалось подключиться к реле.", back: "← Назад в VoxVera" },
    he: { title: "לוח מודעות", subtitle: "הכרזות האחרונות שפורסמו לממסרים.", col_title: "כותרת", col_link: "קישור", col_author: "פורסם על ידי", col_language: "שפה", col_date: "פורסם", link_text: "קישור", loading: "טוען כרזות…", empty: "לא נמצאו כרזות עדיין.", error: "לא ניתן להתחבר לממסרים.", back: "← חזרה ל-VoxVera" },
    ar: { title: "لوحة الإعلانات", subtitle: "أحدث الملصقات المنشورة على المرحلات.", col_title: "العنوان", col_link: "رابط", col_author: "نُشر بواسطة", col_language: "اللغة", col_date: "تاريخ النشر", link_text: "رابط", loading: "جارٍ تحميل الملصقات…", empty: "لم يتم العثور على ملصقات بعد.", error: "تعذّر الوصول إلى المرحلات.", back: "← العودة إلى VoxVera" },
    fa: { title: "تابلوی اعلانات", subtitle: "جدیدترین پوسترهای منتشرشده روی رله‌ها.", col_title: "عنوان", col_link: "پیوند", col_author: "منتشرشده توسط", col_language: "زبان", col_date: "تاریخ انتشار", link_text: "پیوند", loading: "در حال بارگذاری پوسترها…", empty: "هنوز پوستری یافت نشد.", error: "اتصال به رله‌ها ممکن نشد.", back: "← بازگشت به VoxVera" },
    hi: { title: "बुलेटिन बोर्ड", subtitle: "रिले पर प्रकाशित सबसे हाल के पोस्टर।", col_title: "शीर्षक", col_link: "लिंक", col_author: "द्वारा पोस्ट किया गया", col_language: "भाषा", col_date: "पोस्ट किया गया", link_text: "लिंक", loading: "पोस्टर लोड हो रहे हैं…", empty: "अभी तक कोई पोस्टर नहीं मिला।", error: "रिले तक नहीं पहुँच सके।", back: "← VoxVera पर वापस" },
    ja: { title: "掲示板", subtitle: "リレーに公開された最新のちらし。", col_title: "タイトル", col_link: "リンク", col_author: "投稿者", col_language: "言語", col_date: "投稿日", link_text: "リンク", loading: "ちらしを読み込んでいます…", empty: "まだちらしが見つかりません。", error: "リレーに接続できませんでした。", back: "← VoxVera に戻る" },
    pt: { title: "Quadro de avisos", subtitle: "Panfletos mais recentes publicados nos relés.", col_title: "Título", col_link: "Link", col_author: "Publicado por", col_language: "Idioma", col_date: "Publicado", link_text: "link", loading: "Carregando panfletos…", empty: "Nenhum panfleto encontrado ainda.", error: "Não foi possível acessar os relés.", back: "← Voltar ao VoxVera" },
    sw: { title: "Ubao wa matangazo", subtitle: "Mabango ya hivi karibuni yaliyochapishwa kwenye relay.", col_title: "Kichwa", col_link: "Kiungo", col_author: "Imechapishwa na", col_language: "Lugha", col_date: "Imechapishwa", link_text: "kiungo", loading: "Inapakia mabango…", empty: "Hakuna mabango yaliyopatikana bado.", error: "Imeshindwa kufikia relay.", back: "← Rudi VoxVera" },
    tr: { title: "İlan panosu", subtitle: "Rölelere yayımlanan en yeni el ilanları.", col_title: "Başlık", col_link: "Bağlantı", col_author: "Yayımlayan", col_language: "Dil", col_date: "Yayımlandı", link_text: "bağlantı", loading: "El ilanları yükleniyor…", empty: "Henüz el ilanı bulunamadı.", error: "Rölelere ulaşılamadı.", back: "← VoxVera'ya dön" },
    zh: { title: "公告栏", subtitle: "发布到中继的最新传单。", col_title: "标题", col_link: "链接", col_author: "发布者", col_language: "语言", col_date: "发布时间", link_text: "链接", loading: "正在加载传单…", empty: "尚未找到传单。", error: "无法连接到中继。", back: "← 返回 VoxVera" }
  };

  function pickLang() {
    try {
      const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
      if (stored && BOARD_UI[stored]) return stored;
    } catch (_) {}
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ""];
    for (const tag of list) {
      const base = String(tag || "").split("-")[0];
      if (BOARD_UI[base]) return base;
    }
    return FALLBACK_LANG;
  }

  let currentLang = pickLang();
  function t(key) {
    return (BOARD_UI[currentLang] && BOARD_UI[currentLang][key]) || BOARD_UI[FALLBACK_LANG][key] || key;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function isSafeUrl(url) {
    try {
      const u = new URL(url, window.location.href);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch (_) {
      return false;
    }
  }

  function langLabel(code) {
    const meta = LOCALES[code] && LOCALES[code].meta;
    if (meta && meta.language_name) {
      return (meta.flag ? meta.flag + " " : "") + meta.language_name;
    }
    return code || "—";
  }

  function shortNpub(npub) {
    return npub && npub.length > 20 ? `${npub.slice(0, 12)}…${npub.slice(-6)}` : (npub || "—");
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      return new Date(ts * 1000).toLocaleString(currentLang);
    } catch (_) {
      return new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ");
    }
  }

  function dtagOf(tags) {
    const d = Array.isArray(tags) && tags.find((x) => x[0] === "d");
    return d ? d[1] : "";
  }

  function langFromTags(tags) {
    if (!Array.isArray(tags)) return "";
    const lt = tags.find((x) => x[0] === "language" && x[1]) || tags.find((x) => x[0] === "l" && x[1]);
    return lt ? lt[1] : "";
  }

  // Fetch recent VoxVera flyer events across the default relays. Resolves with
  // the collected raw events plus whether any relay connection opened (so we can
  // tell "no flyers" apart from "relays unreachable").
  function queryRelays(relays, timeoutMs) {
    return new Promise((resolve) => {
      const sub = "voxvera-board-" + Math.random().toString(16).slice(2);
      const events = new Map();
      let remaining = relays.length;
      let anyOpen = false;
      let settled = false;
      const sockets = [];
      const finish = () => {
        if (settled) return;
        settled = true;
        sockets.forEach((s) => {
          try { s.send(JSON.stringify(["CLOSE", sub])); s.close(); } catch (_) {}
        });
        resolve({ events: Array.from(events.values()), anyOpen });
      };
      relays.forEach((relay) => {
        let ws;
        try { ws = new WebSocket(relay); } catch (_) { remaining -= 1; if (remaining <= 0) finish(); return; }
        sockets.push(ws);
        ws.onopen = () => {
          anyOpen = true;
          ws.send(JSON.stringify(["REQ", sub, { kinds: [EVENT_KIND], "#t": ["voxvera"], limit: 200 }]));
        };
        ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            if (data[0] === "EVENT" && data[2] && data[2].id && !events.has(data[2].id)) {
              events.set(data[2].id, data[2]);
            } else if (data[0] === "EOSE") {
              remaining -= 1;
              if (remaining <= 0) finish();
            }
          } catch (_) {}
        };
        ws.onerror = () => { remaining -= 1; if (remaining <= 0) finish(); };
      });
      setTimeout(finish, timeoutMs || 6000);
    });
  }

  // Reduce raw events to the latest flyer per author+identifier (replaceable).
  function parseFlyers(events) {
    const tools = window.NostrTools;
    const byKey = new Map();
    events.forEach((e) => {
      if (!e || e.kind !== EVENT_KIND) return;
      const tags = e.tags || [];
      if (!tags.some((x) => x[0] === "t" && x[1] === "voxvera")) return;
      let payload;
      try { payload = JSON.parse(e.content); } catch (_) { return; }
      const key = e.pubkey + ":" + dtagOf(tags);
      const prev = byKey.get(key);
      if (prev && prev.created_at >= (e.created_at || 0)) return;
      let npub = e.pubkey;
      try { npub = tools.nip19.npubEncode(e.pubkey); } catch (_) {}
      byKey.set(key, {
        title: String(payload.title || "").trim(),
        link: String(payload.tear_off_link || payload.url || "").trim(),
        npub: npub,
        lang: payload.lang || langFromTags(tags) || "",
        created_at: e.created_at || 0
      });
    });
    return Array.from(byKey.values());
  }

  let rows = [];
  let sortKey = "date";
  let sortDir = "desc";
  let statusKey = "loading";

  const COLS = [
    { key: "title", label: () => t("col_title"),
      cell: (r) => `<span class="board-title">${escapeHtml(r.title || "—")}</span>`,
      cmp: (a, b) => (a.title || "").localeCompare(b.title || "") },
    { key: "link", label: () => t("col_link"),
      cell: (r) => isSafeUrl(r.link)
        ? `<a href="${escapeHtml(r.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("link_text"))}</a>`
        : "—",
      cmp: (a, b) => (a.link || "").localeCompare(b.link || "") },
    { key: "author", label: () => t("col_author"),
      cell: (r) => `<span class="board-npub" title="${escapeHtml(r.npub)}">${escapeHtml(shortNpub(r.npub))}</span>`,
      cmp: (a, b) => (a.npub || "").localeCompare(b.npub || "") },
    { key: "language", label: () => t("col_language"),
      cell: (r) => escapeHtml(langLabel(r.lang)),
      cmp: (a, b) => langLabel(a.lang).localeCompare(langLabel(b.lang)) },
    { key: "date", label: () => t("col_date"),
      cell: (r) => `<span class="board-date">${escapeHtml(fmtDate(r.created_at))}</span>`,
      cmp: (a, b) => (a.created_at || 0) - (b.created_at || 0) }
  ];

  function renderHead() {
    const head = document.getElementById("board-head");
    head.innerHTML = COLS.map((c) => {
      const ind = c.key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "";
      return `<th data-key="${c.key}">${escapeHtml(c.label())}<span class="sort-indicator">${ind}</span></th>`;
    }).join("");
    head.querySelectorAll("th").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.key;
        if (k === sortKey) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortKey = k;
          sortDir = k === "date" ? "desc" : "asc";
        }
        renderHead();
        renderBody();
      });
    });
  }

  function renderBody() {
    const col = COLS.find((c) => c.key === sortKey) || COLS[0];
    const sorted = rows.slice().sort((a, b) => {
      const r = col.cmp(a, b);
      return sortDir === "asc" ? r : -r;
    });
    document.getElementById("board-rows").innerHTML = sorted
      .map((r) => `<tr>${COLS.map((c) => `<td>${c.cell(r)}</td>`).join("")}</tr>`)
      .join("");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setStatus(key) {
    statusKey = key;
    const node = document.getElementById("board-status");
    if (!node) return;
    if (key) {
      node.hidden = false;
      node.textContent = t(key);
    } else {
      node.hidden = true;
    }
  }

  function populateLangSelect() {
    const sel = document.getElementById("board-lang");
    if (!sel || sel.options.length) return;
    Object.keys(LOCALES)
      .filter((code) => BOARD_UI[code])
      .sort((a, b) => {
        const an = (LOCALES[a].meta && LOCALES[a].meta.language_name) || a;
        const bn = (LOCALES[b].meta && LOCALES[b].meta.language_name) || b;
        return an.localeCompare(bn);
      })
      .forEach((code) => {
        const meta = LOCALES[code].meta || {};
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = (meta.flag ? meta.flag + " " : "") + (meta.language_name || code);
        sel.appendChild(opt);
      });
  }

  // Apply a UI language: persist it (same localStorage key as the main client,
  // so the choice carries across pages), flip direction, and re-localize the
  // chrome, column headers, rows, and status message.
  function applyLang(lang) {
    currentLang = BOARD_UI[lang] ? lang : FALLBACK_LANG;
    try { window.localStorage.setItem(UI_LANG_STORAGE_KEY, currentLang); } catch (_) {}
    document.documentElement.lang = currentLang;
    document.documentElement.dir =
      (LOCALES[currentLang] && LOCALES[currentLang].meta && LOCALES[currentLang].meta.direction) || "ltr";
    document.title = "VoxVera — " + t("title");
    setText("board-title", t("title"));
    setText("board-subtitle", t("subtitle"));
    setText("board-back", t("back"));
    const sel = document.getElementById("board-lang");
    if (sel) sel.value = currentLang;
    setStatus(statusKey);
    renderHead();
    renderBody();
  }

  async function init() {
    populateLangSelect();
    const sel = document.getElementById("board-lang");
    if (sel) sel.addEventListener("change", () => applyLang(sel.value || FALLBACK_LANG));
    applyLang(currentLang);

    if (!window.NostrTools) {
      setStatus("error");
      return;
    }

    const { events, anyOpen } = await queryRelays(DEFAULT_RELAYS, 6000);
    rows = parseFlyers(events);
    if (!rows.length) {
      setStatus(anyOpen ? "empty" : "error");
      return;
    }
    setStatus(null);
    renderBody();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
