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
  const LANGUAGE_SELECT_IDS = ["topbar-lang", "field-lang", "viewer-lang"];
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
    "label-title": "cli.init_title",
    "label-subtitle": "cli.init_subtitle",
    "label-headline": "cli.init_headline",
    "label-content": "cli.init_body",
    "label-url-message": "cli.url_message_label",
    "label-poster-url": "cli.url_label",
    "label-footer-message": "cli.footer_message_label",
    "label-viewer-relays": "cli.init_links"
  };
  const NOSTR_TEXT_LABELS = {
    "label-flyer-name": "flyer_name",
    "label-language": "language",
    "label-page-title": "page_title",
    "label-event-id": "event_id"
  };
  const BUTTON_LABELS = {
    "preview-editor": "preview",
    "export-event": "export_event",
    "publish-event": "publish_event",
    "copy-viewer-config": "copy_config",
    "print-preview": "print_preview",
    "open-viewer-controls": "load_event",
    "viewer-print": "print",
    "viewer-editor": "editor",
    "close-viewer-controls": "back",
    "generate-anon-identity": "generate_npub",
    "viewer-fetch-render": "fetch_render",
    "editor-tab": "editor",
    "viewer-tab": "viewer"
  };
  const HEADING_LABELS = {
    "editor-heading": "editor",
    "viewer-heading": "viewer",
    "published-event-heading": "published_event",
    "normalized-config-heading": "normalized_config",
    "preview-heading": "preview"
  };
  const NOSTR_UI = {
    ar: {
      back: "رجوع",
      copy_config: "نسخ JSON للإعداد",
      editor: "المحرر",
      event_id: "معرّف الحدث",
      export_event: "تصدير JSON الحدث",
      fetch_render: "جلب وعرض",
      flyer_name: "اسم المنشور",
      generate_npub: "إنشاء npub مجهول",
      language: "اللغة",
      load_event: "تحميل الحدث",
      normalized_config: "الإعداد الموحد",
      open_poster: "افتح هذا الملصق:",
      page_title: "عنوان الصفحة",
      preview: "معاينة",
      print: "اطبع المنشور",
      print_preview: "اطبع المعاينة",
      publish_event: "توقيع ونشر",
      published_event: "الحدث المنشور",
      share_reprint: "شارك وأعد الطباعة.",
      built_with: "بني بواسطة",
      viewer: "العارض"
    },
    de: {
      back: "Zurück",
      copy_config: "Konfig-JSON kopieren",
      editor: "Editor",
      event_id: "Event-ID",
      export_event: "Event-JSON exportieren",
      fetch_render: "Abrufen und anzeigen",
      flyer_name: "Flyername",
      generate_npub: "Anonymes npub erzeugen",
      language: "Sprache",
      load_event: "Event laden",
      normalized_config: "Normalisierte Konfiguration",
      open_poster: "Dieses Plakat öffnen:",
      page_title: "Seitentitel",
      preview: "Vorschau",
      print: "Flyer drucken",
      print_preview: "Vorschau drucken",
      publish_event: "Signieren und veröffentlichen",
      published_event: "Veröffentlichtes Event",
      share_reprint: "Teilen und neu drucken.",
      built_with: "Erstellt mit",
      viewer: "Viewer"
    },
    en: {
      back: "Back",
      copy_config: "Copy config JSON",
      editor: "Editor",
      event_id: "Event ID",
      export_event: "Export event JSON",
      fetch_render: "Fetch and render",
      flyer_name: "Flyer Name",
      generate_npub: "Generate anonymous npub",
      language: "Language",
      load_event: "Load Event",
      normalized_config: "Normalized Config",
      open_poster: "Open this poster:",
      page_title: "Page title",
      preview: "Preview",
      print: "Print this page",
      print_preview: "Print preview",
      publish_event: "Sign and publish",
      published_event: "Published Event",
      share_reprint: "Share and reprint.",
      built_with: "Built with",
      viewer: "Viewer"
    },
    es: {
      back: "Volver",
      copy_config: "Copiar JSON de config.",
      editor: "Editor",
      event_id: "ID del evento",
      export_event: "Exportar JSON del evento",
      fetch_render: "Buscar y renderizar",
      flyer_name: "Nombre del volante",
      generate_npub: "Generar npub anónimo",
      language: "Idioma",
      load_event: "Cargar evento",
      normalized_config: "Configuración normalizada",
      open_poster: "Abra este cartel:",
      page_title: "Título de la página",
      preview: "Vista previa",
      print: "Imprimir volante",
      print_preview: "Imprimir vista previa",
      publish_event: "Firmar y publicar",
      published_event: "Evento publicado",
      share_reprint: "Comparta y reimprima.",
      built_with: "Creado con",
      viewer: "Visor"
    },
    fa: {
      back: "بازگشت",
      copy_config: "کپی JSON پیکربندی",
      editor: "ویرایشگر",
      event_id: "شناسه رویداد",
      export_event: "خروجی JSON رویداد",
      fetch_render: "دریافت و نمایش",
      flyer_name: "نام اعلامیه",
      generate_npub: "ساخت npub ناشناس",
      language: "زبان",
      load_event: "بارگذاری رویداد",
      normalized_config: "پیکربندی عادی‌شده",
      open_poster: "این پوستر را باز کنید:",
      page_title: "عنوان صفحه",
      preview: "پیش‌نمایش",
      print: "چاپ اعلامیه",
      print_preview: "چاپ پیش‌نمایش",
      publish_event: "امضا و انتشار",
      published_event: "رویداد منتشرشده",
      share_reprint: "به اشتراک بگذارید و دوباره چاپ کنید.",
      built_with: "ساخته شده با",
      viewer: "نمایشگر"
    },
    fr: {
      back: "Retour",
      copy_config: "Copier le JSON config",
      editor: "Editeur",
      event_id: "ID d'evenement",
      export_event: "Exporter le JSON de l'evenement",
      fetch_render: "Charger et afficher",
      flyer_name: "Nom du flyer",
      generate_npub: "Generer un npub anonyme",
      language: "Langue",
      load_event: "Charger l'evenement",
      normalized_config: "Configuration normalisee",
      open_poster: "Ouvrez cette affiche :",
      page_title: "Titre de page",
      preview: "Apercu",
      print: "Imprimer le flyer",
      print_preview: "Imprimer l'apercu",
      publish_event: "Signer et publier",
      published_event: "Evenement publie",
      share_reprint: "Partagez et reimprimez.",
      built_with: "Cree avec",
      viewer: "Visionneuse"
    },
    he: {
      back: "חזרה",
      copy_config: "העתק JSON תצורה",
      editor: "עורך",
      event_id: "מזהה אירוע",
      export_event: "ייצוא JSON אירוע",
      fetch_render: "טען והצג",
      flyer_name: "שם הפלייר",
      generate_npub: "צור npub אנונימי",
      language: "שפה",
      load_event: "טען אירוע",
      normalized_config: "תצורה מנורמלת",
      open_poster: "פתח את הכרזה הזו:",
      page_title: "כותרת עמוד",
      preview: "תצוגה מקדימה",
      print: "הדפס פלייר",
      print_preview: "הדפס תצוגה מקדימה",
      publish_event: "חתום ופרסם",
      published_event: "אירוע שפורסם",
      share_reprint: "שתף והדפס מחדש.",
      built_with: "נבנה עם",
      viewer: "מציג"
    },
    hi: {
      back: "पीछे",
      copy_config: "कॉन्फिग JSON कॉपी करें",
      editor: "संपादक",
      event_id: "इवेंट ID",
      export_event: "इवेंट JSON निर्यात करें",
      fetch_render: "लाएं और दिखाएं",
      flyer_name: "फ्लायर नाम",
      generate_npub: "अनाम npub बनाएं",
      language: "भाषा",
      load_event: "इवेंट लोड करें",
      normalized_config: "सामान्यीकृत कॉन्फिग",
      open_poster: "यह पोस्टर खोलें:",
      page_title: "पृष्ठ शीर्षक",
      preview: "पूर्वावलोकन",
      print: "फ्लायर प्रिंट करें",
      print_preview: "पूर्वावलोकन प्रिंट करें",
      publish_event: "हस्ताक्षर कर प्रकाशित करें",
      published_event: "प्रकाशित इवेंट",
      share_reprint: "साझा करें और फिर से प्रिंट करें।",
      built_with: "इसके साथ बनाया गया",
      viewer: "दर्शक"
    },
    ja: {
      back: "戻る",
      copy_config: "設定JSONをコピー",
      editor: "エディター",
      event_id: "イベントID",
      export_event: "イベントJSONを書き出す",
      fetch_render: "取得して表示",
      flyer_name: "フライヤー名",
      generate_npub: "匿名npubを生成",
      language: "言語",
      load_event: "イベントを読み込む",
      normalized_config: "正規化設定",
      open_poster: "このポスターを開く:",
      page_title: "ページタイトル",
      preview: "プレビュー",
      print: "フライヤーを印刷",
      print_preview: "プレビューを印刷",
      publish_event: "署名して公開",
      published_event: "公開済みイベント",
      share_reprint: "共有して再印刷。",
      built_with: "作成:",
      viewer: "ビューア"
    },
    pt: {
      back: "Voltar",
      copy_config: "Copiar JSON de config.",
      editor: "Editor",
      event_id: "ID do evento",
      export_event: "Exportar JSON do evento",
      fetch_render: "Buscar e renderizar",
      flyer_name: "Nome do panfleto",
      generate_npub: "Gerar npub anonimo",
      language: "Idioma",
      load_event: "Carregar evento",
      normalized_config: "Configuracao normalizada",
      open_poster: "Abra este cartaz:",
      page_title: "Titulo da pagina",
      preview: "Previa",
      print: "Imprimir Panfleto",
      print_preview: "Imprimir previa",
      publish_event: "Assinar e publicar",
      published_event: "Evento publicado",
      share_reprint: "Compartilhe e reimprima.",
      built_with: "Criado com",
      viewer: "Visualizador"
    },
    ru: {
      back: "Назад",
      copy_config: "Копировать JSON конфигурации",
      editor: "Редактор",
      event_id: "ID события",
      export_event: "Экспорт JSON события",
      fetch_render: "Загрузить и отобразить",
      flyer_name: "Название листовки",
      generate_npub: "Создать анонимный npub",
      language: "Язык",
      load_event: "Загрузить событие",
      normalized_config: "Нормализованная конфигурация",
      open_poster: "Откройте этот плакат:",
      page_title: "Заголовок страницы",
      preview: "Предпросмотр",
      print: "Печать листовки",
      print_preview: "Печать предпросмотра",
      publish_event: "Подписать и опубликовать",
      published_event: "Опубликованное событие",
      share_reprint: "Поделитесь и распечатайте снова.",
      built_with: "Создано с помощью",
      viewer: "Просмотр"
    },
    sw: {
      back: "Rudi",
      copy_config: "Nakili JSON ya usanidi",
      editor: "Kihariri",
      event_id: "Kitambulisho cha tukio",
      export_event: "Hamisha JSON ya tukio",
      fetch_render: "Pakua na onyesha",
      flyer_name: "Jina la kipeperushi",
      generate_npub: "Tengeneza npub isiyojulikana",
      language: "Lugha",
      load_event: "Pakia tukio",
      normalized_config: "Usanidi uliorekebishwa",
      open_poster: "Fungua bango hili:",
      page_title: "Kichwa cha ukurasa",
      preview: "Hakiki",
      print: "Chapa Kipeperushi",
      print_preview: "Chapa hakiki",
      publish_event: "Saini na chapisha",
      published_event: "Tukio lililochapishwa",
      share_reprint: "Shiriki na uchapishe tena.",
      built_with: "Imejengwa na",
      viewer: "Kitazamaji"
    },
    tr: {
      back: "Geri",
      copy_config: "Yapılandırma JSON'unu kopyala",
      editor: "Düzenleyici",
      event_id: "Olay ID",
      export_event: "Olay JSON'unu dışa aktar",
      fetch_render: "Getir ve göster",
      flyer_name: "İlan adı",
      generate_npub: "Anonim npub oluştur",
      language: "Dil",
      load_event: "Olay yükle",
      normalized_config: "Normalleştirilmiş yapılandırma",
      open_poster: "Bu posteri açın:",
      page_title: "Sayfa başlığı",
      preview: "Önizleme",
      print: "İlanı Yazdır",
      print_preview: "Önizlemeyi yazdır",
      publish_event: "İmzala ve yayınla",
      published_event: "Yayınlanan olay",
      share_reprint: "Paylaşın ve yeniden yazdırın.",
      built_with: "İle yapıldı",
      viewer: "Görüntüleyici"
    },
    zh: {
      back: "返回",
      copy_config: "复制配置 JSON",
      editor: "编辑器",
      event_id: "事件 ID",
      export_event: "导出事件 JSON",
      fetch_render: "获取并渲染",
      flyer_name: "传单名称",
      generate_npub: "生成匿名 npub",
      language: "语言",
      load_event: "加载事件",
      normalized_config: "标准化配置",
      open_poster: "打开此海报：",
      page_title: "页面标题",
      preview: "预览",
      print: "打印传单",
      print_preview: "打印预览",
      publish_event: "签名并发布",
      published_event: "已发布事件",
      share_reprint: "分享并重新打印。",
      built_with: "构建自",
      viewer: "查看器"
    }
  };
  let flyerSource = "default";

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

  function htmlBreaksToNewlines(value) {
    return String(value || "").replace(/<br\s*\/?>/gi, "\n");
  }

  function nostrLabel(key, lang) {
    const selected = supportedLang(lang);
    return (NOSTR_UI[selected] && NOSTR_UI[selected][key])
      || (NOSTR_UI[FALLBACK_LANG] && NOSTR_UI[FALLBACK_LANG][key])
      || key;
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
      content: htmlBreaksToNewlines(landing.content || CONFIG_DEFAULTS.content),
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
    LANGUAGE_SELECT_IDS.forEach((selectId) => {
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
    Object.entries(NOSTR_TEXT_LABELS).forEach(([id, key]) => setText(id, nostrLabel(key, selected)));
    Object.entries(HEADING_LABELS).forEach(([id, key]) => setText(id, nostrLabel(key, selected)));
    Object.entries(BUTTON_LABELS).forEach(([id, key]) => setButtonText(id, nostrLabel(key, selected)));
    setButtonText("print-preview", translate("web.print_button", selected) || BUTTON_LABELS["print-preview"]);
    setButtonText("viewer-print", translate("web.print_button", selected) || BUTTON_LABELS["viewer-print"]);
    setButtonText("viewer-editor", translate("cli.manage_action_edit", selected) || BUTTON_LABELS["viewer-editor"]);
    setButtonText("close-viewer-controls", translate("cli.manage_action_back", selected) || BUTTON_LABELS["close-viewer-controls"]);

    LANGUAGE_SELECT_IDS.forEach((selectId) => {
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
    flyerSource = "default";
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

  function applyLanguageChange(lang) {
    const selected = supportedLang(lang);
    if (flyerSource === "default") {
      applyFlyerDefaults(selected);
      renderPreview(buildPayloadFromForm());
      return;
    }

    el("field-lang").value = selected;
    syncUiLanguage(selected);
    renderPreview(normalizePayload(buildPayloadFromForm()));
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
    return escapeHtml(value)
      .replace(/~~(.*?)~~/g, '<span style="text-decoration: line-through;">$1</span>')
      .replace(/\r?\n/g, "<br>");
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
      const htmlCheckValue = typeof value === "string" ? value.replace(/<br\s*\/?>/gi, "") : value;
      if (typeof value === "string" && key !== "url" && /<\s*\/?\s*[a-z][^>]*>|on[a-z]+\s*=/i.test(htmlCheckValue)) {
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
      content: htmlBreaksToNewlines(payload.content || CONFIG_DEFAULTS.content),
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
    const openPosterLabel = nostrLabel("open_poster", flyerLang);
    const shareReprintLabel = nostrLabel("share_reprint", flyerLang);
    const builtWithLabel = nostrLabel("built_with", flyerLang);
    const tearOffHtml = Array.from({ length: 10 }).map(() => `
      <div class="tear-off">
        <div class="tear-off-text">
          ${escapeHtml(openPosterLabel)}<br>
          <a href="${escapeHtml(tearOff)}">${escapeHtml(tearOff)}</a><br>
          ${escapeHtml(shareReprintLabel)}
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
            <p class="credit">${escapeHtml(builtWithLabel)} <a href="https://github.com/PR0M3TH3AN/VoxVera">voxvera</a></p>
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
    flyerSource = "event";
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

    LANGUAGE_SELECT_IDS.forEach((selectId) => {
      const select = el(selectId);
      if (!select) return;
      select.addEventListener("change", () => applyLanguageChange(select.value || FALLBACK_LANG));
    });

    [
      "field-folder-name",
      "field-name",
      "field-title",
      "field-subtitle",
      "field-headline",
      "field-content",
      "field-url-message",
      "field-footer-message"
    ].forEach((fieldId) => {
      const field = el(fieldId);
      if (!field) return;
      field.addEventListener("input", () => {
        flyerSource = "custom";
      });
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
