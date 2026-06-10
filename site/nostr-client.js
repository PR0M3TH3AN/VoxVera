(function () {
  "use strict";

  const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://nos.lol",
    "wss://relay.primal.net"
  ];
  const ANON_SECRET_STORAGE_KEY = "voxvera_nostr_anon_secret_hex";
  // Publishing identity ("anon" | "nip07" | "nsec") and, for an nsec the user
  // chose to remember, its PIN-encrypted secret. The plaintext secret is never
  // stored for nsec — only this AES-GCM blob, decrypted in memory on unlock.
  const IDENTITY_MODE_STORAGE_KEY = "voxvera_identity_mode";
  const IDENTITY_ENC_STORAGE_KEY = "voxvera_identity_nsec_enc";
  const IDENTITY_NPUB_STORAGE_KEY = "voxvera_identity_npub";
  const PBKDF2_ITERATIONS = 600000;
  const UI_LANG_STORAGE_KEY = "voxvera_nostr_lang";
  const LOCALES = window.VoxVeraLocales || {};
  const FALLBACK_LANG = "en";
  const LANGUAGE_SELECT_IDS = ["topbar-lang", "field-lang", "viewer-lang"];
  const PAPER_SELECT_IDS = ["topbar-paper", "viewer-paper"];
  const PAPER_STORAGE_KEY = "voxvera_paper";
  // Print paper sizes. `css` is the CSS @page size keyword. The actual sheet
  // dimensions live in nostr-client.css (--sheet-w / --sheet-h per paper class).
  const PAPER_SIZES = {
    letter: { css: "Letter" },
    a4: { css: "A4" }
  };
  const DEFAULT_PAPER = "letter";
  // ISO 3166-1 alpha-2 regions whose default print paper is US Letter.
  // Everywhere else defaults to A4 (ISO 216), which is the global standard.
  const LETTER_REGIONS = new Set([
    "US", "CA", "MX", "CL", "CO", "CR", "GT", "DO", "PH", "VE", "PA", "NI", "SV", "HN", "BO", "EC", "PR"
  ]);
  const EVENT_KIND = 30078;
  // Per-script letter-spacing policy for flyer text. `letter-spacing` is not
  // script-neutral, so the flyer tightens tracking only where it is safe:
  //   "full" (Latin, Cyrillic, Hebrew): reduced positive tracking + slight
  //          negative on body/url to reclaim space per line.
  //   "cjk"  (Japanese, Chinese): tracking clamped to 0 — full-width glyphs
  //          must not overlap, so never negative.
  //   "none" (Arabic, Persian, Hindi): letter-spacing OFF. These are cursive
  //          or complex scripts where any tracking breaks the letter joins or
  //          detaches combining marks; neutralizing it also fixes rendering.
  // The values themselves live in nostr-client.css, keyed by the ls-* class.
  const LETTER_SPACING_POLICY = {
    ar: "none", fa: "none", hi: "none",
    ja: "cjk", zh: "cjk"
  };
  function trackingPolicy(lang) {
    return LETTER_SPACING_POLICY[supportedLang(lang)] || "full";
  }
  const FIELD_LIMITS = {
    folder_name: 64,
    name: 120,
    title: 80,
    subtitle: 120,
    headline: 160,
    content: 10000,
    url_message: 240,
    url: 2048,
    tear_off_link: 2048,
    footer_message: 240
  };
  const CONFIG_DEFAULTS = {
    name: "Vox Vera Printable Flyers",
    folder_name: "voxvera",
    lang: "en",
    title: "TOP SECRET",
    subtitle: "DO ~~NOT~~ DISTRIBUTE",
    headline: "OPERATION VOX VERA",
    content: `Break free from censorship with VoxVera. A Nostr-powered guerrilla marketing and message-spreading tool. Whether online or in the physical world, it helps you publish flyer content to decentralized relays and spread your ideas boldly without relying on a central server.

Use memetic power to share your ideas in your school, workplace, online communities, or even globally. VoxVera ensures your message resonates far and wide, with tear-off sections featuring unique URLs and QR codes for easy reprinting.

Resilience comes from Nostr. Flyer source events can be mirrored across relays, while any static or offline client can fetch, verify, and render the poster again.

Join us in a revolution that values truth and transparency. Together, we can build a network of informed citizens who are unafraid to speak out.`,
    url_message: "Follow this link to learn more.",
    url: "https://voxvera.org/",
    tear_off_link: "",
    footer_message: "0110010 0101011 0110010 0111101 0110100",
    attachment_path: "",
    attachment_filename: ""
  };
  const UI_LABELS = {
    "label-relays": "labels.relays",
    "label-title": "labels.title",
    "label-subtitle": "labels.subtitle",
    "label-headline": "labels.headline",
    "label-content": "labels.content",
    "label-url-message": "labels.url_message",
    "label-poster-url": "labels.poster_url",
    "label-footer-message": "labels.footer_message",
    "label-viewer-relays": "labels.relays"
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
    "connect-nip07": "connect_extension",
    "use-nsec-toggle": "use_nsec",
    "nsec-submit": "use_key",
    "unlock-key": "unlock",
    "forget-key": "forget_key",
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
  const STATIC_TEXT_LABELS = {
    "client-title": "client_title",
    "client-description": "client_description",
    "result-event-id-label": "event_id",
    "result-author-npub-label": "author_npub",
    "result-naddr-label": "nostr_address",
    "result-poster-url-label": "poster_url",
    "result-status-label": "status"
  };
  const EMPTY_OUTPUT_LABELS = {
    "event-id-output": "not_published",
    "author-npub-output": "not_generated",
    "naddr-output": "not_generated",
    "poster-url-output": "not_generated"
  };
  const TEXT_FIELD_IDS = [
    "field-folder-name",
    "field-name",
    "field-title",
    "field-subtitle",
    "field-headline",
    "field-content",
    "field-url-message",
    "field-url",
    "field-footer-message"
  ];
  const DISPLAY_FIT_TARGETS = {
    "field-title": ".content h1:nth-of-type(1)",
    "field-subtitle": ".distribute",
    "field-headline": ".content h1:nth-of-type(2)",
    "field-content": ".message",
    "field-url-message": ".url-message",
    "field-url": ".qr-code-url a",
    "field-footer-message": ".footer .binary"
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
      open_poster: "انقر لفتح هذا الملصق.",
      page_title: "عنوان الصفحة",
      preview: "معاينة",
      print: "اطبع المنشور",
      print_preview: "اطبع المعاينة",
      publish_event: "توقيع ونشر",
      published_event: "الحدث المنشور",
      share_reprint: "شارك وأعد الطباعة.",
      built_with: "بني بواسطة",
      viewer: "العارض",
      client_title: "عميل VoxVera Nostr",
      client_description: "محرر وعارض ثابت لأحداث مصدر المنشور اللامركزية.",
      author_npub: "npub المؤلف",
      nostr_address: "عنوان Nostr",
      poster_url: "رابط الملصق",
      status: "الحالة",
      copy: "نسخ",
      copied: "تم النسخ",
      not_published: "لم ينشر",
      not_generated: "لم ينشأ",
      idle: "خامل",
      checking_signer: "فحص الموقّع",
      checking_identity: "فحص الهوية",
      anon_signing_nip07: "التوقيع المجهول هو الافتراضي؛ تم اكتشاف NIP-07",
      anon_signing_ready: "التوقيع المجهول متاح؛ لا يلزم تسجيل دخول NIP-07",
      connect_extension: "ربط الإضافة",
      use_nsec: "استخدام مفتاح خاص (nsec)",
      use_key: "استخدام هذا المفتاح",
      remember_pin: "تذكُّر على هذا الجهاز (رمز PIN)",
      pin_prompt: "رمز PIN (4 أرقام أو أكثر)",
      unlock: "فتح القفل",
      forget_key: "نسيان",
      invalid_nsec: "لا يبدو هذا مفتاح nsec صالحًا.",
      pin_short: "يجب أن يتكون رمز PIN من 4 أرقام على الأقل.",
      pin_wrong: "رمز PIN غير صحيح. حاول مرة أخرى.",
      nip07_missing: "لم يتم العثور على إضافة NIP-07.",
      identity_locked: "الهوية المحفوظة مقفلة. أدخل رمز PIN لفتحها.",
      locked: "مقفل",
      signer_anon: "النشر بشكل مجهول",
      signer_nip07: "النشر بهوية الإضافة الخاصة بك",
      signer_nsec: "النشر بمفتاحك المستورد",
      no_anon_npub: "لا يوجد npub مجهول بعد",
      anon_npub_ready: "npub مجهول جاهز",
      npub_generated: "تم إنشاء npub مجهول:",
      preview_updated: "تم تحديث المعاينة.",
      signing_publishing: "جار التوقيع والنشر...",
      fetching: "جار الجلب...",
      fetched: "تم الجلب",
      loading_content: "جارٍ تحميل المحتوى...",
      load_failed: "تعذّر تحميل هذا الملصق.",
      paper_size: "حجم الورق",
      bulletin_board: "لوحة الإعلانات",
      published_title: "تم نشر الملصق",
      published_message: "انسخ هذا الرابط لرؤية ملصقك الجديد:",
      close: "إغلاق",
      paper_letter: "US Letter (8.5 × 11 بوصة)",
      paper_a4: "A4 (210 × 297 مم)",
      config_copied: "تم نسخ الإعداد.",
      lookup_placeholder: "naddr أو معرف حدث أو note1 أو nevent1 أو رابط nostr:",
      event_reference_required: "أدخل naddr أو معرف حدث أو note1 أو nevent1.",
      relay_required: "أدخل رابط relay واحد على الأقل يبدأ بـ wss://.",
      failed: "فشل",
      timeout: "انتهت المهلة",
      connection_error: "خطأ في الاتصال"
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
      open_poster: "Klicken Sie, um dieses Plakat zu öffnen.",
      page_title: "Seitentitel",
      preview: "Vorschau",
      print: "Flyer drucken",
      print_preview: "Vorschau drucken",
      publish_event: "Signieren und veröffentlichen",
      published_event: "Veröffentlichtes Event",
      share_reprint: "Teilen und neu drucken.",
      built_with: "Erstellt mit",
      viewer: "Viewer",
      client_title: "VoxVera Nostr-Client",
      client_description: "Statischer Editor und Viewer für dezentrale Flyer-Quellereignisse.",
      author_npub: "Autor-npub",
      nostr_address: "Nostr-Adresse",
      poster_url: "Poster-URL",
      status: "Status",
      copy: "Kopieren",
      copied: "Kopiert",
      not_published: "Nicht veröffentlicht",
      not_generated: "Nicht erzeugt",
      idle: "Bereit",
      checking_signer: "Signer prüfen",
      checking_identity: "Identität prüfen",
      anon_signing_nip07: "Anonymes Signieren ist Standard; NIP-07 erkannt",
      anon_signing_ready: "Anonymes Signieren verfügbar; kein NIP-07-Login nötig",
      connect_extension: "Erweiterung verbinden",
      use_nsec: "Privaten Schlüssel (nsec) verwenden",
      use_key: "Diesen Schlüssel verwenden",
      remember_pin: "Auf diesem Gerät merken (PIN)",
      pin_prompt: "PIN (mind. 4 Ziffern)",
      unlock: "Entsperren",
      forget_key: "Verwerfen",
      invalid_nsec: "Das sieht nicht nach einem gültigen nsec-Schlüssel aus.",
      pin_short: "Die PIN muss mindestens 4 Ziffern haben.",
      pin_wrong: "Falsche PIN. Bitte erneut versuchen.",
      nip07_missing: "Keine NIP-07-Erweiterung gefunden.",
      identity_locked: "Gespeicherte Identität ist gesperrt. Gib deine PIN ein, um sie zu entsperren.",
      locked: "Gesperrt",
      signer_anon: "Anonym veröffentlichen",
      signer_nip07: "Veröffentlichung mit deiner Erweiterungs-Identität",
      signer_nsec: "Veröffentlichung mit deinem importierten Schlüssel",
      no_anon_npub: "Noch kein anonymes npub",
      anon_npub_ready: "Anonymes npub bereit",
      npub_generated: "Anonymes npub erzeugt:",
      preview_updated: "Vorschau aktualisiert.",
      signing_publishing: "Signieren und veröffentlichen...",
      fetching: "Abrufen...",
      fetched: "Abgerufen",
      loading_content: "Inhalt wird geladen...",
      load_failed: "Dieses Plakat konnte nicht geladen werden.",
      paper_size: "Papierformat",
      bulletin_board: "Schwarzes Brett",
      published_title: "Plakat veröffentlicht",
      published_message: "Kopiere diese URL, um dein neues Plakat zu sehen:",
      close: "Schließen",
      paper_letter: "US Letter (8,5 × 11 Zoll)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Konfiguration kopiert.",
      lookup_placeholder: "naddr, Event-ID, note1, nevent1 oder nostr:-URL",
      event_reference_required: "Geben Sie naddr, Event-ID, note1 oder nevent1 ein.",
      relay_required: "Geben Sie mindestens ein wss://-Relay ein.",
      failed: "fehlgeschlagen",
      timeout: "Zeitüberschreitung",
      connection_error: "Verbindungsfehler"
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
      open_poster: "Click to open this poster.",
      page_title: "Page title",
      preview: "Preview",
      print: "Print this page",
      print_preview: "Print preview",
      publish_event: "Sign and publish",
      published_event: "Published Event",
      share_reprint: "Share and reprint.",
      built_with: "Built with",
      viewer: "Viewer",
      client_title: "VoxVera Nostr Client",
      client_description: "Static editor and viewer for decentralized flyer source events.",
      author_npub: "Author npub",
      nostr_address: "Nostr address",
      poster_url: "Poster URL",
      status: "Status",
      copy: "Copy",
      copied: "Copied",
      not_published: "Not published",
      not_generated: "Not generated",
      idle: "Idle",
      checking_signer: "Checking signer",
      checking_identity: "Checking identity",
      anon_signing_nip07: "Anonymous signing is default; NIP-07 detected",
      anon_signing_ready: "Anonymous signing available; no NIP-07 login required",
      connect_extension: "Connect extension",
      use_nsec: "Use a private key (nsec)",
      use_key: "Use this key",
      remember_pin: "Remember on this device (PIN)",
      pin_prompt: "PIN (4+ digits)",
      unlock: "Unlock",
      forget_key: "Forget",
      invalid_nsec: "That doesn't look like a valid nsec key.",
      pin_short: "PIN must be at least 4 digits.",
      pin_wrong: "Wrong PIN. Try again.",
      nip07_missing: "No NIP-07 extension found.",
      identity_locked: "Saved identity is locked. Enter your PIN to unlock it.",
      locked: "Locked",
      signer_anon: "Publishing anonymously",
      signer_nip07: "Publishing as your extension identity",
      signer_nsec: "Publishing as your imported key",
      no_anon_npub: "No anonymous npub yet",
      anon_npub_ready: "Anonymous npub ready",
      npub_generated: "Anonymous npub generated:",
      preview_updated: "Preview updated.",
      signing_publishing: "Signing and publishing...",
      fetching: "Fetching...",
      fetched: "Fetched",
      loading_content: "Loading content...",
      load_failed: "Could not load this flyer.",
      paper_size: "Paper size",
      bulletin_board: "Bulletin board",
      published_title: "Flyer published",
      published_message: "Copy this URL to see your new flyer:",
      close: "Close",
      paper_letter: "US Letter (8.5 × 11 in)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Config copied.",
      lookup_placeholder: "naddr, event id, note1, nevent1, or nostr: URL",
      event_reference_required: "Enter an naddr, event id, note1, or nevent1.",
      relay_required: "Enter at least one wss:// relay.",
      failed: "failed",
      timeout: "timeout",
      connection_error: "connection error",
      field_too_long: "That field is too long for the printable flyer:"
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
      open_poster: "Haga clic para abrir este cartel.",
      page_title: "Título de la página",
      preview: "Vista previa",
      print: "Imprimir volante",
      print_preview: "Imprimir vista previa",
      publish_event: "Firmar y publicar",
      published_event: "Evento publicado",
      share_reprint: "Comparta y reimprima.",
      built_with: "Creado con",
      viewer: "Visor",
      client_title: "Cliente Nostr de VoxVera",
      client_description: "Editor y visor estático para eventos fuente descentralizados de volantes.",
      author_npub: "npub del autor",
      nostr_address: "Dirección Nostr",
      poster_url: "URL del cartel",
      status: "Estado",
      copy: "Copiar",
      copied: "Copiado",
      not_published: "No publicado",
      not_generated: "No generado",
      idle: "Inactivo",
      checking_signer: "Comprobando firmante",
      checking_identity: "Comprobando identidad",
      anon_signing_nip07: "La firma anónima es predeterminada; NIP-07 detectado",
      anon_signing_ready: "Firma anónima disponible; no se requiere inicio de sesión NIP-07",
      connect_extension: "Conectar extensión",
      use_nsec: "Usar una clave privada (nsec)",
      use_key: "Usar esta clave",
      remember_pin: "Recordar en este dispositivo (PIN)",
      pin_prompt: "PIN (4 o más dígitos)",
      unlock: "Desbloquear",
      forget_key: "Olvidar",
      invalid_nsec: "Eso no parece una clave nsec válida.",
      pin_short: "El PIN debe tener al menos 4 dígitos.",
      pin_wrong: "PIN incorrecto. Inténtalo de nuevo.",
      nip07_missing: "No se encontró ninguna extensión NIP-07.",
      identity_locked: "La identidad guardada está bloqueada. Introduce tu PIN para desbloquearla.",
      locked: "Bloqueada",
      signer_anon: "Publicando de forma anónima",
      signer_nip07: "Publicando con la identidad de tu extensión",
      signer_nsec: "Publicando con tu clave importada",
      no_anon_npub: "Aún no hay npub anónimo",
      anon_npub_ready: "npub anónimo listo",
      npub_generated: "npub anónimo generado:",
      preview_updated: "Vista previa actualizada.",
      signing_publishing: "Firmando y publicando...",
      fetching: "Buscando...",
      fetched: "Recuperado",
      loading_content: "Cargando contenido...",
      load_failed: "No se pudo cargar este cartel.",
      paper_size: "Tamaño de papel",
      bulletin_board: "Tablón de anuncios",
      published_title: "Cartel publicado",
      published_message: "Copia esta URL para ver tu nuevo cartel:",
      close: "Cerrar",
      paper_letter: "US Letter (8,5 × 11 in)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Configuración copiada.",
      lookup_placeholder: "naddr, ID de evento, note1, nevent1 o URL nostr:",
      event_reference_required: "Ingrese un naddr, ID de evento, note1 o nevent1.",
      relay_required: "Ingrese al menos un relay wss://.",
      failed: "falló",
      timeout: "tiempo agotado",
      connection_error: "error de conexión"
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
      open_poster: "برای باز کردن این پوستر کلیک کنید.",
      page_title: "عنوان صفحه",
      preview: "پیش‌نمایش",
      print: "چاپ اعلامیه",
      print_preview: "چاپ پیش‌نمایش",
      publish_event: "امضا و انتشار",
      published_event: "رویداد منتشرشده",
      share_reprint: "به اشتراک بگذارید و دوباره چاپ کنید.",
      built_with: "ساخته شده با",
      viewer: "نمایشگر",
      client_title: "کلاینت Nostr VoxVera",
      client_description: "ویرایشگر و نمایشگر ایستا برای رویدادهای منبع اعلامیه غیرمتمرکز.",
      author_npub: "npub نویسنده",
      nostr_address: "نشانی Nostr",
      poster_url: "URL پوستر",
      status: "وضعیت",
      copy: "کپی",
      copied: "کپی شد",
      not_published: "منتشر نشده",
      not_generated: "ساخته نشده",
      idle: "آماده",
      checking_signer: "بررسی امضاکننده",
      checking_identity: "بررسی هویت",
      anon_signing_nip07: "امضای ناشناس پیش‌فرض است؛ NIP-07 شناسایی شد",
      anon_signing_ready: "امضای ناشناس آماده است؛ ورود NIP-07 لازم نیست",
      connect_extension: "اتصال افزونه",
      use_nsec: "استفاده از کلید خصوصی (nsec)",
      use_key: "استفاده از این کلید",
      remember_pin: "روی این دستگاه به خاطر بسپار (PIN)",
      pin_prompt: "PIN (۴ رقم یا بیشتر)",
      unlock: "باز کردن قفل",
      forget_key: "فراموش کردن",
      invalid_nsec: "این یک کلید nsec معتبر به نظر نمی‌رسد.",
      pin_short: "PIN باید حداقل ۴ رقم باشد.",
      pin_wrong: "PIN نادرست است. دوباره تلاش کنید.",
      nip07_missing: "هیچ افزونه NIP-07 یافت نشد.",
      identity_locked: "هویت ذخیره‌شده قفل است. برای باز کردن آن PIN خود را وارد کنید.",
      locked: "قفل‌شده",
      signer_anon: "انتشار به‌صورت ناشناس",
      signer_nip07: "انتشار با هویت افزونه شما",
      signer_nsec: "انتشار با کلید واردشده شما",
      no_anon_npub: "هنوز npub ناشناس وجود ندارد",
      anon_npub_ready: "npub ناشناس آماده است",
      npub_generated: "npub ناشناس ساخته شد:",
      preview_updated: "پیش‌نمایش به‌روزرسانی شد.",
      signing_publishing: "در حال امضا و انتشار...",
      fetching: "در حال دریافت...",
      fetched: "دریافت شد",
      loading_content: "در حال بارگذاری محتوا...",
      load_failed: "بارگذاری این پوستر ممکن نشد.",
      paper_size: "اندازه کاغذ",
      bulletin_board: "تابلوی اعلانات",
      published_title: "پوستر منتشر شد",
      published_message: "این نشانی را کپی کنید تا پوستر جدید خود را ببینید:",
      close: "بستن",
      paper_letter: "US Letter (8.5 × 11 اینچ)",
      paper_a4: "A4 (210 × 297 میلی‌متر)",
      config_copied: "پیکربندی کپی شد.",
      lookup_placeholder: "naddr، شناسه رویداد، note1، nevent1 یا URL nostr:",
      event_reference_required: "یک naddr، شناسه رویداد، note1 یا nevent1 وارد کنید.",
      relay_required: "حداقل یک رله wss:// وارد کنید.",
      failed: "ناموفق",
      timeout: "پایان مهلت",
      connection_error: "خطای اتصال"
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
      open_poster: "Cliquez pour ouvrir cette affiche.",
      page_title: "Titre de page",
      preview: "Apercu",
      print: "Imprimer le flyer",
      print_preview: "Imprimer l'apercu",
      publish_event: "Signer et publier",
      published_event: "Evenement publie",
      share_reprint: "Partagez et reimprimez.",
      built_with: "Cree avec",
      viewer: "Visionneuse",
      client_title: "Client Nostr VoxVera",
      client_description: "Editeur et visionneuse statiques pour les evenements source decentralises de flyers.",
      author_npub: "npub de l'auteur",
      nostr_address: "Adresse Nostr",
      poster_url: "URL de l'affiche",
      status: "Statut",
      copy: "Copier",
      copied: "Copie",
      not_published: "Non publie",
      not_generated: "Non genere",
      idle: "Inactif",
      checking_signer: "Verification du signataire",
      checking_identity: "Verification de l'identite",
      anon_signing_nip07: "La signature anonyme est par defaut; NIP-07 detecte",
      anon_signing_ready: "Signature anonyme disponible; aucune connexion NIP-07 requise",
      connect_extension: "Connecter l'extension",
      use_nsec: "Utiliser une clé privée (nsec)",
      use_key: "Utiliser cette clé",
      remember_pin: "Se souvenir sur cet appareil (PIN)",
      pin_prompt: "PIN (4 chiffres ou plus)",
      unlock: "Déverrouiller",
      forget_key: "Oublier",
      invalid_nsec: "Cela ne ressemble pas à une clé nsec valide.",
      pin_short: "Le PIN doit comporter au moins 4 chiffres.",
      pin_wrong: "PIN incorrect. Veuillez réessayer.",
      nip07_missing: "Aucune extension NIP-07 trouvée.",
      identity_locked: "L'identité enregistrée est verrouillée. Saisissez votre PIN pour la déverrouiller.",
      locked: "Verrouillée",
      signer_anon: "Publication anonyme",
      signer_nip07: "Publication avec l'identité de votre extension",
      signer_nsec: "Publication avec votre clé importée",
      no_anon_npub: "Aucun npub anonyme pour le moment",
      anon_npub_ready: "npub anonyme pret",
      npub_generated: "npub anonyme genere :",
      preview_updated: "Apercu mis a jour.",
      signing_publishing: "Signature et publication...",
      fetching: "Chargement...",
      fetched: "Charge",
      loading_content: "Chargement du contenu...",
      load_failed: "Impossible de charger cette affiche.",
      paper_size: "Format du papier",
      bulletin_board: "Tableau d'affichage",
      published_title: "Affiche publiée",
      published_message: "Copiez cette URL pour voir votre nouvelle affiche :",
      close: "Fermer",
      paper_letter: "US Letter (8,5 × 11 po)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Configuration copiee.",
      lookup_placeholder: "naddr, ID d'evenement, note1, nevent1 ou URL nostr:",
      event_reference_required: "Saisissez un naddr, ID d'evenement, note1 ou nevent1.",
      relay_required: "Saisissez au moins un relais wss://.",
      failed: "echec",
      timeout: "delai depasse",
      connection_error: "erreur de connexion"
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
      open_poster: "לחץ כדי לפתוח כרזה זו.",
      page_title: "כותרת עמוד",
      preview: "תצוגה מקדימה",
      print: "הדפס פלייר",
      print_preview: "הדפס תצוגה מקדימה",
      publish_event: "חתום ופרסם",
      published_event: "אירוע שפורסם",
      share_reprint: "שתף והדפס מחדש.",
      built_with: "נבנה עם",
      viewer: "מציג",
      client_title: "לקוח Nostr של VoxVera",
      client_description: "עורך ומציג סטטיים לאירועי מקור פלייר מבוזרים.",
      author_npub: "npub המחבר",
      nostr_address: "כתובת Nostr",
      poster_url: "כתובת הכרזה",
      status: "מצב",
      copy: "העתק",
      copied: "הועתק",
      not_published: "לא פורסם",
      not_generated: "לא נוצר",
      idle: "ממתין",
      checking_signer: "בודק חותם",
      checking_identity: "בודק זהות",
      anon_signing_nip07: "חתימה אנונימית היא ברירת המחדל; NIP-07 זוהה",
      anon_signing_ready: "חתימה אנונימית זמינה; אין צורך בהתחברות NIP-07",
      connect_extension: "חבר תוסף",
      use_nsec: "השתמש במפתח פרטי (nsec)",
      use_key: "השתמש במפתח זה",
      remember_pin: "זכור במכשיר זה (PIN)",
      pin_prompt: "PIN (4 ספרות או יותר)",
      unlock: "בטל נעילה",
      forget_key: "שכח",
      invalid_nsec: "זה לא נראה כמו מפתח nsec תקין.",
      pin_short: "ה-PIN חייב להכיל לפחות 4 ספרות.",
      pin_wrong: "PIN שגוי. נסה שוב.",
      nip07_missing: "לא נמצא תוסף NIP-07.",
      identity_locked: "הזהות השמורה נעולה. הזן את ה-PIN שלך כדי לבטל את הנעילה.",
      locked: "נעול",
      signer_anon: "מפרסם באופן אנונימי",
      signer_nip07: "מפרסם עם זהות התוסף שלך",
      signer_nsec: "מפרסם עם המפתח המיובא שלך",
      no_anon_npub: "עדיין אין npub אנונימי",
      anon_npub_ready: "npub אנונימי מוכן",
      npub_generated: "npub אנונימי נוצר:",
      preview_updated: "התצוגה המקדימה עודכנה.",
      signing_publishing: "חותם ומפרסם...",
      fetching: "טוען...",
      fetched: "נטען",
      loading_content: "טוען תוכן...",
      load_failed: "לא ניתן לטעון כרזה זו.",
      paper_size: "גודל נייר",
      bulletin_board: "לוח מודעות",
      published_title: "הכרזה פורסמה",
      published_message: "העתק כתובת זו כדי לראות את הכרזה החדשה שלך:",
      close: "סגור",
      paper_letter: "US Letter (8.5 × 11 אינץ׳)",
      paper_a4: "A4 (210 × 297 מ״מ)",
      config_copied: "התצורה הועתקה.",
      lookup_placeholder: "naddr, מזהה אירוע, note1, nevent1 או כתובת nostr:",
      event_reference_required: "הזן naddr, מזהה אירוע, note1 או nevent1.",
      relay_required: "הזן לפחות relay אחד מסוג wss://.",
      failed: "נכשל",
      timeout: "פג הזמן",
      connection_error: "שגיאת חיבור"
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
      open_poster: "इस पोस्टर को खोलने के लिए क्लिक करें।",
      page_title: "पृष्ठ शीर्षक",
      preview: "पूर्वावलोकन",
      print: "फ्लायर प्रिंट करें",
      print_preview: "पूर्वावलोकन प्रिंट करें",
      publish_event: "हस्ताक्षर कर प्रकाशित करें",
      published_event: "प्रकाशित इवेंट",
      share_reprint: "साझा करें और फिर से प्रिंट करें।",
      built_with: "इसके साथ बनाया गया",
      viewer: "दर्शक",
      client_title: "VoxVera Nostr क्लाइंट",
      client_description: "विकेंद्रीकृत फ्लायर स्रोत इवेंट के लिए स्थिर संपादक और दर्शक।",
      author_npub: "लेखक npub",
      nostr_address: "Nostr पता",
      poster_url: "पोस्टर URL",
      status: "स्थिति",
      copy: "कॉपी करें",
      copied: "कॉपी किया गया",
      not_published: "प्रकाशित नहीं",
      not_generated: "बनाया नहीं गया",
      idle: "निष्क्रिय",
      checking_signer: "हस्ताक्षरकर्ता जांच रहे हैं",
      checking_identity: "पहचान जांच रहे हैं",
      anon_signing_nip07: "अनाम हस्ताक्षर डिफ़ॉल्ट है; NIP-07 मिला",
      anon_signing_ready: "अनाम हस्ताक्षर उपलब्ध; NIP-07 लॉगिन आवश्यक नहीं",
      connect_extension: "एक्सटेंशन कनेक्ट करें",
      use_nsec: "निजी कुंजी (nsec) का उपयोग करें",
      use_key: "इस कुंजी का उपयोग करें",
      remember_pin: "इस डिवाइस पर याद रखें (PIN)",
      pin_prompt: "PIN (4+ अंक)",
      unlock: "अनलॉक करें",
      forget_key: "भूल जाएँ",
      invalid_nsec: "यह एक मान्य nsec कुंजी नहीं लगती।",
      pin_short: "PIN कम से कम 4 अंकों का होना चाहिए।",
      pin_wrong: "गलत PIN। पुनः प्रयास करें।",
      nip07_missing: "कोई NIP-07 एक्सटेंशन नहीं मिला।",
      identity_locked: "सहेजी गई पहचान लॉक है। इसे अनलॉक करने के लिए अपना PIN दर्ज करें।",
      locked: "लॉक",
      signer_anon: "अनाम रूप से प्रकाशित किया जा रहा है",
      signer_nip07: "आपकी एक्सटेंशन पहचान से प्रकाशित किया जा रहा है",
      signer_nsec: "आपकी आयातित कुंजी से प्रकाशित किया जा रहा है",
      no_anon_npub: "अभी कोई अनाम npub नहीं",
      anon_npub_ready: "अनाम npub तैयार",
      npub_generated: "अनाम npub बनाया गया:",
      preview_updated: "पूर्वावलोकन अपडेट हुआ.",
      signing_publishing: "हस्ताक्षर और प्रकाशन...",
      fetching: "लाया जा रहा है...",
      fetched: "लाया गया",
      loading_content: "सामग्री लोड हो रही है...",
      load_failed: "यह पोस्टर लोड नहीं हो सका।",
      paper_size: "कागज़ का आकार",
      bulletin_board: "बुलेटिन बोर्ड",
      published_title: "पोस्टर प्रकाशित",
      published_message: "अपना नया पोस्टर देखने के लिए यह URL कॉपी करें:",
      close: "बंद करें",
      paper_letter: "US Letter (8.5 × 11 इंच)",
      paper_a4: "A4 (210 × 297 मिमी)",
      config_copied: "कॉन्फिग कॉपी हुआ.",
      lookup_placeholder: "naddr, इवेंट ID, note1, nevent1, या nostr: URL",
      event_reference_required: "naddr, इवेंट ID, note1, या nevent1 दर्ज करें.",
      relay_required: "कम से कम एक wss:// relay दर्ज करें.",
      failed: "विफल",
      timeout: "समय समाप्त",
      connection_error: "कनेक्शन त्रुटि"
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
      open_poster: "クリックしてこのポスターを開く。",
      page_title: "ページタイトル",
      preview: "プレビュー",
      print: "フライヤーを印刷",
      print_preview: "プレビューを印刷",
      publish_event: "署名して公開",
      published_event: "公開済みイベント",
      share_reprint: "共有して再印刷。",
      built_with: "作成:",
      viewer: "ビューア",
      client_title: "VoxVera Nostr クライアント",
      client_description: "分散型フライヤーソースイベント用の静的エディターとビューア。",
      author_npub: "作者 npub",
      nostr_address: "Nostr アドレス",
      poster_url: "ポスター URL",
      status: "状態",
      copy: "コピー",
      copied: "コピーしました",
      not_published: "未公開",
      not_generated: "未生成",
      idle: "待機中",
      checking_signer: "署名者を確認中",
      checking_identity: "IDを確認中",
      anon_signing_nip07: "匿名署名が標準です; NIP-07を検出しました",
      anon_signing_ready: "匿名署名を利用できます; NIP-07ログインは不要です",
      connect_extension: "拡張機能を接続",
      use_nsec: "秘密鍵 (nsec) を使う",
      use_key: "この鍵を使う",
      remember_pin: "このデバイスで記憶する (PIN)",
      pin_prompt: "PIN（4桁以上）",
      unlock: "ロック解除",
      forget_key: "破棄",
      invalid_nsec: "有効な nsec 鍵ではないようです。",
      pin_short: "PIN は4桁以上にしてください。",
      pin_wrong: "PIN が違います。もう一度お試しください。",
      nip07_missing: "NIP-07 拡張機能が見つかりません。",
      identity_locked: "保存された ID はロックされています。PIN を入力して解除してください。",
      locked: "ロック中",
      signer_anon: "匿名で公開します",
      signer_nip07: "拡張機能の ID で公開します",
      signer_nsec: "インポートした鍵で公開します",
      no_anon_npub: "匿名npubはまだありません",
      anon_npub_ready: "匿名npub準備完了",
      npub_generated: "匿名npubを生成しました:",
      preview_updated: "プレビューを更新しました。",
      signing_publishing: "署名して公開中...",
      fetching: "取得中...",
      fetched: "取得しました",
      loading_content: "コンテンツを読み込んでいます...",
      load_failed: "このちらしを読み込めませんでした。",
      paper_size: "用紙サイズ",
      bulletin_board: "掲示板",
      published_title: "ちらしを公開しました",
      published_message: "新しいちらしを見るにはこの URL をコピーしてください:",
      close: "閉じる",
      paper_letter: "US レター (8.5 × 11 インチ)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "設定をコピーしました。",
      lookup_placeholder: "naddr、イベントID、note1、nevent1、または nostr: URL",
      event_reference_required: "naddr、イベントID、note1、またはnevent1を入力してください。",
      relay_required: "少なくとも1つの wss:// リレーを入力してください。",
      failed: "失敗",
      timeout: "タイムアウト",
      connection_error: "接続エラー"
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
      open_poster: "Clique para abrir este cartaz.",
      page_title: "Titulo da pagina",
      preview: "Previa",
      print: "Imprimir Panfleto",
      print_preview: "Imprimir previa",
      publish_event: "Assinar e publicar",
      published_event: "Evento publicado",
      share_reprint: "Compartilhe e reimprima.",
      built_with: "Criado com",
      viewer: "Visualizador",
      client_title: "Cliente Nostr VoxVera",
      client_description: "Editor e visualizador estatico para eventos-fonte descentralizados de panfletos.",
      author_npub: "npub do autor",
      nostr_address: "Endereco Nostr",
      poster_url: "URL do cartaz",
      status: "Status",
      copy: "Copiar",
      copied: "Copiado",
      not_published: "Nao publicado",
      not_generated: "Nao gerado",
      idle: "Ocioso",
      checking_signer: "Verificando assinante",
      checking_identity: "Verificando identidade",
      anon_signing_nip07: "Assinatura anonima e o padrao; NIP-07 detectado",
      anon_signing_ready: "Assinatura anonima disponivel; login NIP-07 nao necessario",
      connect_extension: "Conectar extensão",
      use_nsec: "Usar uma chave privada (nsec)",
      use_key: "Usar esta chave",
      remember_pin: "Lembrar neste dispositivo (PIN)",
      pin_prompt: "PIN (4 ou mais dígitos)",
      unlock: "Desbloquear",
      forget_key: "Esquecer",
      invalid_nsec: "Isso não parece uma chave nsec válida.",
      pin_short: "O PIN deve ter pelo menos 4 dígitos.",
      pin_wrong: "PIN incorreto. Tente novamente.",
      nip07_missing: "Nenhuma extensão NIP-07 encontrada.",
      identity_locked: "A identidade salva está bloqueada. Digite seu PIN para desbloqueá-la.",
      locked: "Bloqueada",
      signer_anon: "Publicando anonimamente",
      signer_nip07: "Publicando com a identidade da sua extensão",
      signer_nsec: "Publicando com sua chave importada",
      no_anon_npub: "Ainda nao ha npub anonimo",
      anon_npub_ready: "npub anonimo pronto",
      npub_generated: "npub anonimo gerado:",
      preview_updated: "Previa atualizada.",
      signing_publishing: "Assinando e publicando...",
      fetching: "Buscando...",
      fetched: "Buscado",
      loading_content: "Carregando conteúdo...",
      load_failed: "Não foi possível carregar este panfleto.",
      paper_size: "Tamanho do papel",
      bulletin_board: "Quadro de avisos",
      published_title: "Panfleto publicado",
      published_message: "Copie este URL para ver seu novo panfleto:",
      close: "Fechar",
      paper_letter: "US Letter (8,5 × 11 pol)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Configuracao copiada.",
      lookup_placeholder: "naddr, ID do evento, note1, nevent1 ou URL nostr:",
      event_reference_required: "Insira um naddr, ID do evento, note1 ou nevent1.",
      relay_required: "Insira pelo menos um relay wss://.",
      failed: "falhou",
      timeout: "tempo esgotado",
      connection_error: "erro de conexao"
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
      open_poster: "Нажмите, чтобы открыть этот плакат.",
      page_title: "Заголовок страницы",
      preview: "Предпросмотр",
      print: "Печать листовки",
      print_preview: "Печать предпросмотра",
      publish_event: "Подписать и опубликовать",
      published_event: "Опубликованное событие",
      share_reprint: "Поделитесь и распечатайте снова.",
      built_with: "Создано с помощью",
      viewer: "Просмотр",
      client_title: "Клиент VoxVera Nostr",
      client_description: "Статический редактор и просмотрщик для децентрализованных исходных событий листовок.",
      author_npub: "npub автора",
      nostr_address: "Адрес Nostr",
      poster_url: "URL плаката",
      status: "Статус",
      copy: "Копировать",
      copied: "Скопировано",
      not_published: "Не опубликовано",
      not_generated: "Не создано",
      idle: "Ожидание",
      checking_signer: "Проверка подписанта",
      checking_identity: "Проверка личности",
      anon_signing_nip07: "Анонимная подпись используется по умолчанию; обнаружен NIP-07",
      anon_signing_ready: "Анонимная подпись доступна; вход NIP-07 не требуется",
      connect_extension: "Подключить расширение",
      use_nsec: "Использовать приватный ключ (nsec)",
      use_key: "Использовать этот ключ",
      remember_pin: "Запомнить на этом устройстве (PIN)",
      pin_prompt: "PIN (не менее 4 цифр)",
      unlock: "Разблокировать",
      forget_key: "Забыть",
      invalid_nsec: "Это не похоже на действительный ключ nsec.",
      pin_short: "PIN должен содержать не менее 4 цифр.",
      pin_wrong: "Неверный PIN. Попробуйте снова.",
      nip07_missing: "Расширение NIP-07 не найдено.",
      identity_locked: "Сохранённая личность заблокирована. Введите PIN, чтобы разблокировать её.",
      locked: "Заблокировано",
      signer_anon: "Публикация анонимно",
      signer_nip07: "Публикация под личностью вашего расширения",
      signer_nsec: "Публикация вашим импортированным ключом",
      no_anon_npub: "Анонимного npub пока нет",
      anon_npub_ready: "Анонимный npub готов",
      npub_generated: "Анонимный npub создан:",
      preview_updated: "Предпросмотр обновлен.",
      signing_publishing: "Подписание и публикация...",
      fetching: "Загрузка...",
      fetched: "Загружено",
      loading_content: "Загрузка содержимого...",
      load_failed: "Не удалось загрузить эту листовку.",
      paper_size: "Размер бумаги",
      bulletin_board: "Доска объявлений",
      published_title: "Листовка опубликована",
      published_message: "Скопируйте этот URL, чтобы увидеть свою листовку:",
      close: "Закрыть",
      paper_letter: "US Letter (8,5 × 11 дюйма)",
      paper_a4: "A4 (210 × 297 мм)",
      config_copied: "Конфигурация скопирована.",
      lookup_placeholder: "naddr, ID события, note1, nevent1 или URL nostr:",
      event_reference_required: "Введите naddr, ID события, note1 или nevent1.",
      relay_required: "Введите хотя бы один relay wss://.",
      failed: "сбой",
      timeout: "тайм-аут",
      connection_error: "ошибка соединения"
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
      open_poster: "Bofya kufungua bango hili.",
      page_title: "Kichwa cha ukurasa",
      preview: "Hakiki",
      print: "Chapa Kipeperushi",
      print_preview: "Chapa hakiki",
      publish_event: "Saini na chapisha",
      published_event: "Tukio lililochapishwa",
      share_reprint: "Shiriki na uchapishe tena.",
      built_with: "Imejengwa na",
      viewer: "Kitazamaji",
      client_title: "Mteja wa VoxVera Nostr",
      client_description: "Kihariri na kitazamaji tuli kwa matukio chanzo ya vipeperushi vilivyogatuliwa.",
      author_npub: "npub ya mwandishi",
      nostr_address: "Anwani ya Nostr",
      poster_url: "URL ya bango",
      status: "Hali",
      copy: "Nakili",
      copied: "Imenakiliwa",
      not_published: "Haijachapishwa",
      not_generated: "Haijatengenezwa",
      idle: "Tayari",
      checking_signer: "Inakagua mtia saini",
      checking_identity: "Inakagua utambulisho",
      anon_signing_nip07: "Utiaji saini usiojulikana ndio chaguo msingi; NIP-07 imegunduliwa",
      anon_signing_ready: "Utiaji saini usiojulikana unapatikana; hakuna kuingia kwa NIP-07 kunakohitajika",
      connect_extension: "Unganisha kiendelezi",
      use_nsec: "Tumia ufunguo wa faragha (nsec)",
      use_key: "Tumia ufunguo huu",
      remember_pin: "Kumbuka kwenye kifaa hiki (PIN)",
      pin_prompt: "PIN (tarakimu 4 au zaidi)",
      unlock: "Fungua",
      forget_key: "Sahau",
      invalid_nsec: "Huu hauonekani kama ufunguo halali wa nsec.",
      pin_short: "PIN lazima iwe na tarakimu nne au zaidi.",
      pin_wrong: "PIN si sahihi. Jaribu tena.",
      nip07_missing: "Hakuna kiendelezi cha NIP-07 kilichopatikana.",
      identity_locked: "Kitambulisho kilichohifadhiwa kimefungwa. Weka PIN yako kukifungua.",
      locked: "Imefungwa",
      signer_anon: "Inachapisha bila kujulikana",
      signer_nip07: "Inachapisha kwa kitambulisho cha kiendelezi chako",
      signer_nsec: "Inachapisha kwa ufunguo wako ulioingizwa",
      no_anon_npub: "Hakuna npub isiyojulikana bado",
      anon_npub_ready: "npub isiyojulikana iko tayari",
      npub_generated: "npub isiyojulikana imetengenezwa:",
      preview_updated: "Hakiki imesasishwa.",
      signing_publishing: "Inatia saini na kuchapisha...",
      fetching: "Inapakua...",
      fetched: "Imepakuliwa",
      loading_content: "Inapakia maudhui...",
      load_failed: "Imeshindwa kupakia bango hili.",
      paper_size: "Ukubwa wa karatasi",
      bulletin_board: "Ubao wa matangazo",
      published_title: "Bango limechapishwa",
      published_message: "Nakili URL hii ili kuona bango lako jipya:",
      close: "Funga",
      paper_letter: "US Letter (8.5 × 11 inchi)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Usanidi umenakiliwa.",
      lookup_placeholder: "naddr, kitambulisho cha tukio, note1, nevent1 au URL ya nostr:",
      event_reference_required: "Weka naddr, kitambulisho cha tukio, note1 au nevent1.",
      relay_required: "Weka angalau relay moja ya wss://.",
      failed: "imeshindwa",
      timeout: "muda umeisha",
      connection_error: "hitilafu ya muunganisho"
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
      open_poster: "Bu posteri açmak için tıklayın.",
      page_title: "Sayfa başlığı",
      preview: "Önizleme",
      print: "İlanı Yazdır",
      print_preview: "Önizlemeyi yazdır",
      publish_event: "İmzala ve yayınla",
      published_event: "Yayınlanan olay",
      share_reprint: "Paylaşın ve yeniden yazdırın.",
      built_with: "İle yapıldı",
      viewer: "Görüntüleyici",
      client_title: "VoxVera Nostr İstemcisi",
      client_description: "Merkeziyetsiz ilan kaynak olayları için statik düzenleyici ve görüntüleyici.",
      author_npub: "Yazar npub",
      nostr_address: "Nostr adresi",
      poster_url: "Poster URL'si",
      status: "Durum",
      copy: "Kopyala",
      copied: "Kopyalandı",
      not_published: "Yayınlanmadı",
      not_generated: "Oluşturulmadı",
      idle: "Boşta",
      checking_signer: "İmzalayan kontrol ediliyor",
      checking_identity: "Kimlik kontrol ediliyor",
      anon_signing_nip07: "Anonim imzalama varsayılandır; NIP-07 algılandı",
      anon_signing_ready: "Anonim imzalama hazır; NIP-07 girişi gerekmez",
      connect_extension: "Uzantıyı bağla",
      use_nsec: "Özel anahtar (nsec) kullan",
      use_key: "Bu anahtarı kullan",
      remember_pin: "Bu cihazda hatırla (PIN)",
      pin_prompt: "PIN (4+ rakam)",
      unlock: "Kilidi aç",
      forget_key: "Unut",
      invalid_nsec: "Bu geçerli bir nsec anahtarı gibi görünmüyor.",
      pin_short: "PIN en az 4 rakam olmalıdır.",
      pin_wrong: "Yanlış PIN. Tekrar deneyin.",
      nip07_missing: "NIP-07 uzantısı bulunamadı.",
      identity_locked: "Kayıtlı kimlik kilitli. Kilidini açmak için PIN'inizi girin.",
      locked: "Kilitli",
      signer_anon: "Anonim olarak yayımlanıyor",
      signer_nip07: "Uzantı kimliğinizle yayımlanıyor",
      signer_nsec: "İçe aktardığınız anahtarla yayımlanıyor",
      no_anon_npub: "Henüz anonim npub yok",
      anon_npub_ready: "Anonim npub hazır",
      npub_generated: "Anonim npub oluşturuldu:",
      preview_updated: "Önizleme güncellendi.",
      signing_publishing: "İmzalanıyor ve yayınlanıyor...",
      fetching: "Getiriliyor...",
      fetched: "Getirildi",
      loading_content: "İçerik yükleniyor...",
      load_failed: "Bu el ilanı yüklenemedi.",
      paper_size: "Kağıt boyutu",
      bulletin_board: "İlan panosu",
      published_title: "El ilanı yayımlandı",
      published_message: "Yeni el ilanınızı görmek için bu URL'yi kopyalayın:",
      close: "Kapat",
      paper_letter: "US Letter (8,5 × 11 inç)",
      paper_a4: "A4 (210 × 297 mm)",
      config_copied: "Yapılandırma kopyalandı.",
      lookup_placeholder: "naddr, olay ID, note1, nevent1 veya nostr: URL",
      event_reference_required: "Bir naddr, olay ID, note1 veya nevent1 girin.",
      relay_required: "En az bir wss:// relay girin.",
      failed: "başarısız",
      timeout: "zaman aşımı",
      connection_error: "bağlantı hatası"
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
      open_poster: "点击打开此海报。",
      page_title: "页面标题",
      preview: "预览",
      print: "打印传单",
      print_preview: "打印预览",
      publish_event: "签名并发布",
      published_event: "已发布事件",
      share_reprint: "分享并重新打印。",
      built_with: "构建自",
      viewer: "查看器",
      client_title: "VoxVera Nostr 客户端",
      client_description: "用于去中心化传单源事件的静态编辑器和查看器。",
      author_npub: "作者 npub",
      nostr_address: "Nostr 地址",
      poster_url: "海报 URL",
      status: "状态",
      copy: "复制",
      copied: "已复制",
      not_published: "未发布",
      not_generated: "未生成",
      idle: "空闲",
      checking_signer: "正在检查签名器",
      checking_identity: "正在检查身份",
      anon_signing_nip07: "默认使用匿名签名；检测到 NIP-07",
      anon_signing_ready: "匿名签名可用；无需 NIP-07 登录",
      connect_extension: "连接扩展",
      use_nsec: "使用私钥 (nsec)",
      use_key: "使用此密钥",
      remember_pin: "在此设备上记住 (PIN)",
      pin_prompt: "PIN（4位以上）",
      unlock: "解锁",
      forget_key: "忘记",
      invalid_nsec: "这看起来不是有效的 nsec 密钥。",
      pin_short: "PIN 至少需要 4 位数字。",
      pin_wrong: "PIN 错误。请重试。",
      nip07_missing: "未找到 NIP-07 扩展。",
      identity_locked: "已保存的身份已锁定。请输入 PIN 解锁。",
      locked: "已锁定",
      signer_anon: "正在匿名发布",
      signer_nip07: "正在以你的扩展身份发布",
      signer_nsec: "正在使用你导入的密钥发布",
      no_anon_npub: "还没有匿名 npub",
      anon_npub_ready: "匿名 npub 已就绪",
      npub_generated: "已生成匿名 npub:",
      preview_updated: "预览已更新。",
      signing_publishing: "正在签名并发布...",
      fetching: "正在获取...",
      fetched: "已获取",
      loading_content: "正在加载内容...",
      load_failed: "无法加载此传单。",
      paper_size: "纸张大小",
      bulletin_board: "公告栏",
      published_title: "传单已发布",
      published_message: "复制此网址以查看您的新传单：",
      close: "关闭",
      paper_letter: "US Letter (8.5 × 11 英寸)",
      paper_a4: "A4 (210 × 297 毫米)",
      config_copied: "配置已复制。",
      lookup_placeholder: "naddr、事件 ID、note1、nevent1 或 nostr: URL",
      event_reference_required: "请输入 naddr、事件 ID、note1 或 nevent1。",
      relay_required: "请输入至少一个 wss:// relay。",
      failed: "失败",
      timeout: "超时",
      connection_error: "连接错误"
    }
  };
  let flyerSource = "default";
  let loadedEventConfig = null;
  let loadedEventId = "";
  const lastAcceptedFieldValues = {};

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

  function currentUiLang() {
    return supportedLang((el("field-lang") && el("field-lang").value) || getStoredUiLang() || FALLBACK_LANG);
  }

  function setLocalizedText(id, key, lang = currentUiLang()) {
    const node = el(id);
    if (!node) return;
    node.dataset.i18nKey = key;
    node.textContent = nostrLabel(key, lang);
  }

  function setEmptyOutput(id, key, lang = currentUiLang()) {
    const node = el(id);
    if (!node) return;
    node.dataset.emptyKey = key;
    node.textContent = nostrLabel(key, lang);
  }

  function setRealOutput(id, value) {
    const node = el(id);
    if (!node) return;
    delete node.dataset.emptyKey;
    node.textContent = value;
  }

  function isEmptyOutput(node) {
    return Boolean(node && node.dataset.emptyKey);
  }

  // The "too long" warning is shown inline under the offending field (so the
  // issue is visible without scrolling to a single shared status line). The
  // message element is created lazily inside the field's <label>.
  function fieldErrorElement(fieldId) {
    const field = el(fieldId);
    const label = field ? field.closest("label") : null;
    if (!label) return null;
    let node = label.querySelector(".field-error");
    if (!node) {
      node = document.createElement("p");
      node.className = "field-error";
      node.setAttribute("role", "alert");
      node.hidden = true;
      label.appendChild(node);
    }
    return node;
  }

  function setFieldError(fieldId, message) {
    const node = fieldErrorElement(fieldId);
    if (node) {
      node.textContent = message || "";
      node.hidden = !message;
    }
    const field = el(fieldId);
    if (field) {
      if (message) field.setAttribute("aria-invalid", "true");
      else field.removeAttribute("aria-invalid");
    }
  }

  function clearAllFieldErrors() {
    document.querySelectorAll("#editor-form .field-error").forEach((node) => {
      node.textContent = "";
      node.hidden = true;
    });
    TEXT_FIELD_IDS.forEach((fieldId) => {
      const field = el(fieldId);
      if (field) field.removeAttribute("aria-invalid");
    });
  }

  function syncAcceptedFieldValues() {
    TEXT_FIELD_IDS.forEach((fieldId) => {
      const field = el(fieldId);
      if (field) lastAcceptedFieldValues[fieldId] = field.value;
    });
  }

  function fillEditorFromConfig(config) {
    const normalized = config && config.type === "voxvera_flyer" ? normalizePayload(config) : {
      ...CONFIG_DEFAULTS,
      ...config,
      folder_name: slugify(config && config.folder_name),
      lang: supportedLang((config && config.lang) || FALLBACK_LANG),
      content: htmlBreaksToNewlines((config && config.content) || CONFIG_DEFAULTS.content)
    };
    el("field-lang").value = normalized.lang;
    el("field-folder-name").value = normalized.folder_name;
    el("field-name").value = normalized.name;
    el("field-title").value = normalized.title;
    el("field-subtitle").value = normalized.subtitle;
    el("field-headline").value = normalized.headline;
    el("field-content").value = normalized.content;
    el("field-url-message").value = normalized.url_message;
    el("field-url").value = normalized.url;
    el("field-footer-message").value = normalized.footer_message;
    syncUiLanguage(normalized.lang);
    syncAcceptedFieldValues();
    clearAllFieldErrors();
  }

  function printableTitle() {
    const source = (el("field-name") && el("field-name").value) || CONFIG_DEFAULTS.name;
    return String(source || CONFIG_DEFAULTS.name)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, FIELD_LIMITS.name) || CONFIG_DEFAULTS.name;
  }

  function printWithPageTitle() {
    const previousTitle = document.title;
    document.title = printableTitle();
    const restoreTitle = () => {
      document.title = nostrLabel("client_title", currentUiLang()) || previousTitle;
      window.removeEventListener("focus", restoreTitle);
    };
    window.addEventListener("focus", restoreTitle, { once: true });
    window.print();
    window.setTimeout(restoreTitle, 1500);
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
    document.title = nostrLabel("client_title", selected);
    try {
      window.localStorage.setItem(UI_LANG_STORAGE_KEY, selected);
    } catch (_) {}

    Object.entries(UI_LABELS).forEach(([id, path]) => {
      const translated = translate(path, selected);
      if (translated) setText(id, translated);
    });
    Object.entries(NOSTR_TEXT_LABELS).forEach(([id, key]) => setText(id, nostrLabel(key, selected)));
    Object.entries(HEADING_LABELS).forEach(([id, key]) => setText(id, nostrLabel(key, selected)));
    Object.entries(STATIC_TEXT_LABELS).forEach(([id, key]) => setText(id, nostrLabel(key, selected)));
    Object.entries(BUTTON_LABELS).forEach(([id, key]) => setButtonText(id, nostrLabel(key, selected)));
    setButtonText("print-preview", translate("web.print_button", selected) || nostrLabel("print_preview", selected));
    setButtonText("viewer-print", translate("web.print_button", selected) || nostrLabel("print", selected));
    setButtonText("viewer-editor", nostrLabel("editor", selected));
    setButtonText("close-viewer-controls", nostrLabel("back", selected));
    document.querySelectorAll(".copy-button").forEach((button) => {
      button.textContent = nostrLabel("copy", selected);
    });
    Object.entries(EMPTY_OUTPUT_LABELS).forEach(([id, key]) => {
      const node = el(id);
      if (!node) return;
      if (!node.dataset.emptyKey && ["Not published", "Not generated"].includes(node.textContent.trim())) {
        node.dataset.emptyKey = key;
      }
      if (isEmptyOutput(node)) setEmptyOutput(id, node.dataset.emptyKey, selected);
    });
    document.querySelectorAll("[data-i18n-key]").forEach((node) => {
      node.textContent = nostrLabel(node.dataset.i18nKey, selected);
    });
    const viewerEventInput = el("viewer-event-id");
    if (viewerEventInput) viewerEventInput.placeholder = nostrLabel("lookup_placeholder", selected);
    ["nsec-pin", "unlock-pin"].forEach((id) => {
      const node = el(id);
      if (node) node.placeholder = nostrLabel("pin_prompt", selected);
    });

    LANGUAGE_SELECT_IDS.forEach((selectId) => {
      const select = el(selectId);
      if (select) select.value = selected;
    });
    PAPER_SELECT_IDS.forEach((selectId) => {
      const select = el(selectId);
      if (!select) return;
      select.setAttribute("aria-label", nostrLabel("paper_size", selected));
      Array.from(select.options).forEach((opt) => {
        opt.textContent = nostrLabel(`paper_${opt.value}`, selected);
      });
    });
  }

  function setDefaultText(lang) {
    const relayText = DEFAULT_RELAYS.join("\n");
    el("editor-relays").value = relayText;
    el("viewer-relays").value = relayText;
    populateLanguageOptions();
    populatePaperOptions();
    const defaultLang = supportedLang(lang || getStoredUiLang() || preferredBrowserLang());
    applyFlyerDefaults(defaultLang);
    applyPaperSize(getStoredPaper() || preferredPaperSize());
    Object.entries(EMPTY_OUTPUT_LABELS).forEach(([id, key]) => setEmptyOutput(id, key, defaultLang));
    setLocalizedText("publish-status", "idle", defaultLang);
    setLocalizedText("viewer-status", "idle", defaultLang);
    setLocalizedText("signer-state", "checking_signer", defaultLang);
    setLocalizedText("identity-state", "checking_identity", defaultLang);
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

  // Walk the browser's full ordered preference list (navigator.languages),
  // not just the single top choice, and return the first base language we
  // actually support. This honors a user's secondary preference (e.g. prefers
  // Dutch, then German) instead of jumping straight to the English fallback.
  function preferredBrowserLang() {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ""];
    for (const tag of list) {
      const base = String(tag || "").split("-")[0];
      if (base && LOCALES[base]) return base;
    }
    return "";
  }

  function supportedPaper(paper) {
    return PAPER_SIZES[paper] ? paper : DEFAULT_PAPER;
  }

  function getStoredPaper() {
    try {
      const stored = window.localStorage.getItem(PAPER_STORAGE_KEY);
      return stored && PAPER_SIZES[stored] ? stored : "";
    } catch (_) {
      return "";
    }
  }

  // "By location" without geolocation: read the region subtag of the browser's
  // locale list (the "GB" in "en-GB") and pick the paper that country prints on.
  // Same signal we use for language, no permission prompt. Falls back to
  // DEFAULT_PAPER only when no locale carries a region at all.
  function preferredPaperSize() {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || ""];
    for (const tag of list) {
      const parts = String(tag || "").split("-");
      const region = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "";
      if (/^[A-Z]{2}$/.test(region)) {
        return LETTER_REGIONS.has(region) ? "letter" : "a4";
      }
    }
    return DEFAULT_PAPER;
  }

  function ensurePageSizeStyle() {
    let style = document.getElementById("voxvera-page-size");
    if (!style) {
      style = document.createElement("style");
      style.id = "voxvera-page-size";
      document.head.appendChild(style);
    }
    return style;
  }

  // Paper size is a local print/view preference — it is never written into the
  // Nostr event, so a flyer authored on Letter reprints on A4 for a European
  // viewer without changing the source event.
  function applyPaperSize(paper) {
    const selected = supportedPaper(paper);
    const root = document.documentElement;
    root.classList.remove("paper-letter", "paper-a4");
    root.classList.add(`paper-${selected}`);
    // @page size cannot read CSS custom properties reliably across engines, so
    // drive it from an injected stylesheet that we rewrite on each change.
    ensurePageSizeStyle().textContent =
      `@media print { @page { size: ${PAPER_SIZES[selected].css} portrait; margin: 0; } }`;
    try {
      window.localStorage.setItem(PAPER_STORAGE_KEY, selected);
    } catch (_) {}
    PAPER_SELECT_IDS.forEach((id) => {
      const sel = el(id);
      if (sel) sel.value = selected;
    });
    updatePreviewScale();
  }

  function populatePaperOptions() {
    PAPER_SELECT_IDS.forEach((id) => {
      const sel = el(id);
      if (!sel || sel.options.length) return;
      Object.keys(PAPER_SIZES).forEach((key) => {
        const opt = document.createElement("option");
        opt.value = key;
        sel.appendChild(opt);
      });
    });
  }

  function applyFlyerDefaults(lang) {
    const defaults = localeDefaults(lang);
    flyerSource = "default";
    loadedEventId = "";
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
    syncAcceptedFieldValues();
    clearAllFieldErrors();
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
    renderPreview({ ...normalizePayload(buildPayloadFromForm()), event_id: loadedEventId });
  }

  function refreshSignerState() {
    const state = el("signer-state");
    if (!state) return;
    const key = identityMode === "nip07" ? "signer_nip07"
      : identityMode === "nsec" ? "signer_nsec"
      : "signer_anon";
    setLocalizedText("signer-state", key);
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

  // ---- Publishing identity (anon / NIP-07 / imported nsec) ----------------
  // Flyers are signed under one of three identities. "anon" is the per-device
  // key (default, unchanged). "nip07" signs via the browser extension. "nsec"
  // signs with a key the user imported; its secret lives only in memory unless
  // they choose to remember it, in which case it is PIN-encrypted at rest.
  let identityMode = "anon";    // "anon" | "nip07" | "nsec"
  let nip07Pubkey = null;       // hex, when mode === "nip07"
  let importedSecretHex = null; // hex, in-memory only, when mode === "nsec"
  let importedPubkey = null;    // hex, when mode === "nsec"
  let lockedNpub = null;        // npub of a stored-but-locked nsec identity

  function npubFromHex(pubkeyHex) {
    try { return nostrTools().nip19.npubEncode(pubkeyHex); } catch (_) { return pubkeyHex; }
  }

  // The identity flyers are currently published under: { mode, pubkey, npub }
  // (never the secret). Falls back to the device anon key.
  function activeIdentity() {
    if (identityMode === "nip07" && nip07Pubkey) {
      return { mode: "nip07", pubkey: nip07Pubkey, npub: npubFromHex(nip07Pubkey) };
    }
    if (identityMode === "nsec" && importedPubkey) {
      return { mode: "nsec", pubkey: importedPubkey, npub: npubFromHex(importedPubkey) };
    }
    const anon = getOrCreateAnonIdentity(false);
    return { mode: "anon", pubkey: anon.pubkey, npub: anon.npub };
  }

  // Sign an unsigned event with the active identity (extension or local key).
  async function signActiveEvent(unsigned) {
    const tools = nostrTools();
    if (identityMode === "nip07") {
      if (!(window.nostr && typeof window.nostr.signEvent === "function")) {
        throw new Error(nostrLabel("nip07_missing", currentUiLang()));
      }
      return await window.nostr.signEvent({ ...unsigned, pubkey: nip07Pubkey });
    }
    if (identityMode === "nsec") {
      if (!importedSecretHex) throw new Error(nostrLabel("identity_locked", currentUiLang()));
      return tools.finalizeEvent(unsigned, hexToBytes(importedSecretHex));
    }
    return tools.finalizeEvent(unsigned, getOrCreateAnonIdentity(false).secretKey);
  }

  function setIdentityError(messageKey) {
    const node = el("identity-error");
    if (!node) return;
    if (messageKey) {
      node.hidden = false;
      node.textContent = nostrLabel(messageKey, currentUiLang());
    } else {
      node.hidden = true;
      node.textContent = "";
    }
  }

  function persistMode(mode) {
    try {
      window.localStorage.setItem(IDENTITY_MODE_STORAGE_KEY, mode);
      if (mode === "anon") {
        window.localStorage.removeItem(IDENTITY_NPUB_STORAGE_KEY);
      } else {
        window.localStorage.setItem(IDENTITY_NPUB_STORAGE_KEY, activeIdentity().npub);
      }
    } catch (_) {}
  }

  // --- WebCrypto PIN encryption for a remembered nsec (PBKDF2 -> AES-GCM) ---
  function b64encode(bytes) {
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return window.btoa(bin);
  }
  function b64decode(text) {
    const bin = window.atob(text);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function deriveAesKey(pin, salt, usage) {
    const subtle = window.crypto.subtle;
    const material = await subtle.importKey(
      "raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]
    );
    return subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, usage
    );
  }
  async function encryptSecretHex(secretHex, pin) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveAesKey(pin, salt, ["encrypt"]);
    const ct = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, key, new TextEncoder().encode(secretHex)
    );
    return {
      v: 1, iters: PBKDF2_ITERATIONS,
      salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(new Uint8Array(ct))
    };
  }
  async function decryptSecretHex(blob, pin) {
    const salt = b64decode(blob.salt);
    const iv = b64decode(blob.iv);
    const key = await deriveAesKey(pin, salt, ["decrypt"]);
    const pt = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, b64decode(blob.ct));
    const hex = new TextDecoder().decode(pt).trim();
    if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("bad plaintext");
    return hex.toLowerCase();
  }
  function getStoredEnc() {
    try {
      const raw = window.localStorage.getItem(IDENTITY_ENC_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function showLockedRow(show) {
    const row = el("identity-locked-row");
    if (row) row.hidden = !show;
  }

  // --- Identity actions wired to the controls ---
  function chooseAnonIdentity() {
    identityMode = "anon";
    nip07Pubkey = null;
    setIdentityError(null);
    const imp = el("nsec-import");
    if (imp) imp.hidden = true;
    persistMode("anon");
    refreshSignerState();
    refreshIdentityState();
  }

  async function connectNip07Identity() {
    setIdentityError(null);
    if (!(window.nostr && typeof window.nostr.getPublicKey === "function")) {
      setIdentityError("nip07_missing");
      return;
    }
    try {
      const pk = await window.nostr.getPublicKey();
      if (!/^[0-9a-f]{64}$/i.test(String(pk || ""))) throw new Error("bad pubkey");
      nip07Pubkey = String(pk).toLowerCase();
      identityMode = "nip07";
      const imp = el("nsec-import");
      if (imp) imp.hidden = true;
      persistMode("nip07");
      refreshSignerState();
      refreshIdentityState();
    } catch (_) {
      setIdentityError("nip07_missing");
    }
  }

  function toggleNsecImport() {
    setIdentityError(null);
    showLockedRow(false);
    const row = el("nsec-import");
    if (!row) return;
    row.hidden = !row.hidden;
    if (!row.hidden) { const i = el("nsec-input"); if (i) i.focus(); }
  }

  async function submitNsecImport() {
    setIdentityError(null);
    const tools = nostrTools();
    const input = el("nsec-input");
    const raw = String((input && input.value) || "").trim();
    let secretBytes;
    let pubkey;
    try {
      const decoded = tools.nip19.decode(raw);
      if (decoded.type !== "nsec") throw new Error("not an nsec");
      secretBytes = decoded.data;
      pubkey = tools.getPublicKey(secretBytes);
    } catch (_) {
      setIdentityError("invalid_nsec");
      return;
    }
    const remember = Boolean(el("nsec-remember") && el("nsec-remember").checked);
    if (remember) {
      const pin = String((el("nsec-pin") && el("nsec-pin").value) || "");
      if (!/^[0-9]{4,}$/.test(pin)) { setIdentityError("pin_short"); return; }
      try {
        const blob = await encryptSecretHex(bytesToHex(secretBytes), pin);
        window.localStorage.setItem(IDENTITY_ENC_STORAGE_KEY, JSON.stringify(blob));
      } catch (_) {
        setIdentityError("invalid_nsec");
        return;
      }
    } else {
      try { window.localStorage.removeItem(IDENTITY_ENC_STORAGE_KEY); } catch (_) {}
    }
    importedSecretHex = bytesToHex(secretBytes);
    importedPubkey = String(pubkey).toLowerCase();
    lockedNpub = npubFromHex(importedPubkey);
    identityMode = "nsec";
    if (input) input.value = "";
    if (el("nsec-pin")) el("nsec-pin").value = "";
    if (el("nsec-import")) el("nsec-import").hidden = true;
    // Remembered keys persist mode "nsec" (locked on reload); session-only keys
    // persist "anon" so a reload returns cleanly to anonymous, not a dead lock.
    persistMode(remember ? "nsec" : "anon");
    refreshSignerState();
    refreshIdentityState();
  }

  async function unlockIdentity() {
    setIdentityError(null);
    const blob = getStoredEnc();
    if (!blob) { showLockedRow(false); chooseAnonIdentity(); return; }
    const pin = String((el("unlock-pin") && el("unlock-pin").value) || "");
    let hex;
    try {
      hex = await decryptSecretHex(blob, pin);
    } catch (_) {
      setIdentityError("pin_wrong");
      return;
    }
    importedSecretHex = hex;
    importedPubkey = nostrTools().getPublicKey(hexToBytes(hex));
    lockedNpub = npubFromHex(importedPubkey);
    identityMode = "nsec";
    if (el("unlock-pin")) el("unlock-pin").value = "";
    showLockedRow(false);
    persistMode("nsec");
    refreshSignerState();
    refreshIdentityState();
  }

  function forgetStoredIdentity() {
    try {
      window.localStorage.removeItem(IDENTITY_ENC_STORAGE_KEY);
      window.localStorage.removeItem(IDENTITY_NPUB_STORAGE_KEY);
    } catch (_) {}
    importedSecretHex = null;
    importedPubkey = null;
    lockedNpub = null;
    showLockedRow(false);
    chooseAnonIdentity();
  }

  // Restore the chosen identity on load (called from the DOMContentLoaded init).
  function restoreIdentity() {
    let mode = "anon";
    try { mode = window.localStorage.getItem(IDENTITY_MODE_STORAGE_KEY) || "anon"; } catch (_) {}
    try { lockedNpub = window.localStorage.getItem(IDENTITY_NPUB_STORAGE_KEY) || null; } catch (_) {}
    if (mode === "nip07") {
      identityMode = "nip07";
      if (window.nostr && typeof window.nostr.getPublicKey === "function") {
        window.nostr.getPublicKey().then((pk) => {
          if (/^[0-9a-f]{64}$/i.test(String(pk || ""))) {
            nip07Pubkey = String(pk).toLowerCase();
            refreshSignerState();
            refreshIdentityState();
          }
        }).catch(() => {});
      }
    } else if (mode === "nsec" && getStoredEnc()) {
      identityMode = "nsec"; // locked until the PIN is entered
      showLockedRow(true);
    } else {
      identityMode = "anon";
    }
    refreshSignerState();
    refreshIdentityState();
  }

  function refreshIdentityState() {
    const state = el("identity-state");
    const output = el("author-npub-output");
    if (!state || !output) return;
    try {
      // nsec mode but no secret in memory yet → it is stored and locked.
      if (identityMode === "nsec" && !importedPubkey) {
        setLocalizedText("identity-state", "locked");
        state.style.color = "#8a4d00";
        if (lockedNpub) setRealOutput("author-npub-output", lockedNpub);
        else setEmptyOutput("author-npub-output", "not_generated");
        return;
      }
      if (identityMode === "anon" && !getStoredAnonSecret()) {
        setLocalizedText("identity-state", "no_anon_npub");
        state.style.color = "#8a4d00";
        setEmptyOutput("author-npub-output", "not_generated");
        return;
      }
      const id = activeIdentity();
      const key = id.mode === "nip07" ? "signer_nip07"
        : id.mode === "nsec" ? "signer_nsec"
        : "anon_npub_ready";
      setLocalizedText("identity-state", key);
      state.style.color = "#1d6b3a";
      setRealOutput("author-npub-output", id.npub);
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

  function rawPayloadFromForm() {
    const lang = supportedLang(el("field-lang").value || FALLBACK_LANG);
    return {
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
  }

  function buildPayloadFromForm() {
    const payload = rawPayloadFromForm();
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
    ["url", "tear_off_link"].forEach((key) => {
      if (payload[key]) {
        const parsed = new URL(payload[key]);
        if (!["http:", "https:", "nostr:"].includes(parsed.protocol)) {
          throw new Error(`Unsupported URL scheme: ${parsed.protocol}`);
        }
      }
    });
  }

  // Untrusted fetched URLs: only http(s)/nostr may become a clickable href.
  // Anything else (javascript:, data:, …) is blanked so it renders inert. The
  // renderer escapes the rest of the content, so this is the one piece of
  // sanitization the view path still needs.
  function safeViewUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const parsed = new URL(raw);
      return ["http:", "https:", "nostr:"].includes(parsed.protocol) ? raw : "";
    } catch (_) {
      return "";
    }
  }

  // Shape a payload for rendering. This is the VIEW path and is intentionally
  // lenient: it does NOT run the strict authoring validation (length caps,
  // raw-HTML rejection, version), because the renderer escapes every text field
  // and unsafe URL schemes are neutralized below. Refusing to display an
  // already-published flyer just because a field is over the authoring cap or
  // contains "<"/">" is the bug that let the board show flyers the viewer could
  // not open. Authoring still validates strictly via buildPayloadFromForm.
  function normalizePayload(payload) {
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
      url: payload.url ? safeViewUrl(payload.url) : CONFIG_DEFAULTS.url,
      tear_off_link: payload.tear_off_link ? safeViewUrl(payload.tear_off_link) : CONFIG_DEFAULTS.tear_off_link,
      footer_message: payload.footer_message || CONFIG_DEFAULTS.footer_message,
      attachment_path: "",
      attachment_filename: ""
    };
  }

  function buildUnsignedEvent(payload) {
    const folderName = slugify(payload.folder_name);
    const lang = supportedLang(payload.lang || FALLBACK_LANG);
    return {
      kind: EVENT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ["d", `voxvera:${folderName}`],
        ["t", "voxvera"],
        ["t", "flyer"],
        ["title", payload.headline || payload.title || folderName],
        ["language", lang],
        ["L", "ISO-639-1"],
        ["l", lang, "ISO-639-1"]
      ],
      content: JSON.stringify(payload)
    };
  }

  function flyerIdentifier(payload) {
    return `voxvera:${slugify(payload.folder_name)}`;
  }

  // The naddr carries a single relay hint (the primary configured relay) rather
  // than the full relay list. This keeps the poster URL short and its tear-off
  // QR easy to scan (~171 chars vs ~233 for the old full-list URL) while still
  // pointing a fresh viewer at a relay that has the event. Viewers also fall
  // back to DEFAULT_RELAYS. Older relay-bearing naddr URLs still decode and
  // resolve unchanged.
  function buildNaddr(identity, payload, relays) {
    const relayHints = Array.isArray(relays) ? relays.slice(0, 1) : [];
    return nostrTools().nip19.naddrEncode({
      identifier: flyerIdentifier(payload),
      pubkey: identity.pubkey,
      kind: EVENT_KIND,
      relays: relayHints
    });
  }

  function clientBaseUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function posterUrlForNaddr(naddr) {
    // The naddr is carried in the URL fragment (#) rather than a ?addr= query
    // param: it is shorter (less QR clutter), needs no URL-encoding (naddr is
    // bech32, URL-safe), and never reaches the static host. The viewer reads
    // both forms, so older ?addr= URLs and QR codes still resolve.
    return `${clientBaseUrl()}#${naddr}`;
  }

  function withPosterUrl(payload, identity, relays) {
    const naddr = buildNaddr(identity, payload, relays);
    return {
      payload: {
        ...payload,
        tear_off_link: posterUrlForNaddr(naddr),
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
      const identity = activeIdentity();
      const payload = buildPayloadFromForm();
      const poster = withPosterUrl(payload, identity, relays);
      setRealOutput("naddr-output", poster.naddr);
      setRealOutput("poster-url-output", poster.posterUrl);
      return poster;
    } catch (_) {
      return null;
    }
  }

  async function signAndPublish(payload, relays) {
    const identity = activeIdentity();
    const poster = withPosterUrl(payload, identity, relays);
    const signed = await signActiveEvent(buildUnsignedEvent(poster.payload));
    setRealOutput("author-npub-output", identity.npub);
    setRealOutput("naddr-output", poster.naddr);
    setRealOutput("poster-url-output", poster.posterUrl);
    refreshIdentityState();
    if (!signed || !signed.id || !signed.sig) {
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
        resolve({ relay, ok: false, message: nostrLabel("timeout", currentUiLang()) });
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
        resolve({ relay, ok: false, message: nostrLabel("connection_error", currentUiLang()) });
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

      const consider = (event) => {
        if (!event || event.pubkey !== address.pubkey || event.kind !== address.kind) return;
        const hasMatchingD = Array.isArray(event.tags)
          && event.tags.some((tag) => tag[0] === "d" && tag[1] === address.identifier);
        if (hasMatchingD && (!best || (event.created_at || 0) > (best.created_at || 0))) {
          best = event;
        }
      };

      // Query by author + kind and match the d-tag to the naddr identifier
      // in-page, rather than relying on a relay-side "#d" filter. Some relays do
      // not honor the #d filter for addressable events yet still return the event
      // for a broader query — which is exactly how the bulletin board finds it.
      // This makes the viewer resolve any flyer the board can list.
      const sockets = relays.map((relay) => {
        const ws = new WebSocket(relay);
        ws.onopen = () => ws.send(JSON.stringify(["REQ", sub, {
          authors: [address.pubkey],
          kinds: [address.kind],
          limit: 100
        }]));
        ws.onmessage = (message) => {
          try {
            const data = JSON.parse(message.data);
            if (data[0] === "EVENT") {
              consider(data[2]);
            } else if (data[0] === "EOSE") {
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

      setTimeout(finish, 8000);
    });
  }

  function parseEventReference(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    try {
      const decoded = decodeURIComponent(raw);
      // A 64-char hex event id is often copied with whitespace or a line break
      // in the middle (e.g. the two-line event ID printed on a tear-off tab, or
      // a label like "Event ID: ..."), so match against the input with inner
      // whitespace removed.
      const rawId = decoded.replace(/\s+/g, "").match(/\b[a-f0-9]{64}\b/i);
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
    // Match the bulletin board's acceptance: a VoxVera flyer is any kind-30078
    // event tagged t=voxvera whose content parses as a voxvera_flyer payload.
    // (The t=flyer tag is no longer required, so a flyer the board lists always
    // opens in the viewer.)
    if (!hasTag("t", "voxvera")) throw new Error("Event is missing the VoxVera tag.");
    const payload = JSON.parse(event.content);
    if (!payload || payload.type !== "voxvera_flyer") throw new Error("Event is not a VoxVera flyer payload.");
    const taggedLang = languageFromTags(event.tags);
    if (!payload.lang && taggedLang) {
      payload.lang = taggedLang;
    }
    // No strict validatePayload here — the flyer is rendered defensively
    // (normalizePayload neutralizes unsafe URLs, renderPreview escapes all text),
    // so we display what was published rather than refusing over authoring caps.
    return payload;
  }

  function languageFromTags(tags) {
    if (!Array.isArray(tags)) return "";
    const languageTag = tags.find((tag) => Array.isArray(tag) && tag[0] === "language" && tag[1]);
    const labelTag = tags.find((tag) => Array.isArray(tag) && tag[0] === "l" && tag[1]);
    return supportedLang((languageTag && languageTag[1]) || (labelTag && labelTag[1]) || "");
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

  function renderStatusPreview(message, lang) {
    const flyerLang = supportedLang(lang || FALLBACK_LANG);
    const flyerLocale = localeData(flyerLang);
    const dir = (flyerLocale.meta && flyerLocale.meta.direction) || "ltr";
    const sheetClass = `container no-tear-offs ls-${trackingPolicy(flyerLang)}`;
    el("flyer-preview").innerHTML = `
      <div class="${sheetClass}" lang="${escapeHtml(flyerLang)}" dir="${escapeHtml(dir)}">
        <div class="content">
          <p class="flyer-status-message">${escapeHtml(message)}</p>
        </div>
      </div>
    `;
    updatePreviewScale();
  }

  function renderPreview(config) {
    const flyerLang = supportedLang(config.lang || FALLBACK_LANG);
    const flyerLocale = localeData(flyerLang);
    const tearOff = config.tear_off_link || config.url || "";
    const contentQr = config.url || tearOff;
    const tearOffQrSvg = makeQrSvg(tearOff);
    const contentQrSvg = makeQrSvg(contentQr);
    const sheetClass = `${tearOff ? "container" : "container no-tear-offs"} ls-${trackingPolicy(flyerLang)}`;
    const openPosterLabel = nostrLabel("open_poster", flyerLang);
    const shareReprintLabel = nostrLabel("share_reprint", flyerLang);
    const builtWithLabel = nostrLabel("built_with", flyerLang);
    const eventIdLabel = nostrLabel("event_id", flyerLang);
    const eventId = String(config.event_id || "").trim();
    const tearOffStatement = [openPosterLabel, shareReprintLabel]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .map((part) => escapeHtml(part))
      .join("<br>");
    const eventIdValueHtml = eventId.length > 32
      ? `${escapeHtml(eventId.slice(0, 32))}<br>${escapeHtml(eventId.slice(32))}`
      : escapeHtml(eventId);
    const eventIdHtml = eventId
      ? `<div class="tear-off-event-id">${escapeHtml(eventIdLabel)}:<br><span class="tear-off-event-id-value">${eventIdValueHtml}</span></div>`
      : "";
    const tearOffHtml = Array.from({ length: 10 }).map(() => `
      <div class="tear-off">
        <div class="tear-off-text">
          <a href="${escapeHtml(tearOff)}" title="${escapeHtml(tearOff)}">${tearOffStatement}</a>
          ${eventIdHtml}
        </div>
        <div class="qr-code" aria-label="QR code for ${escapeHtml(tearOff)}">${tearOffQrSvg}</div>
      </div>
    `).join("");
    el("flyer-preview").innerHTML = `
      <div class="${sheetClass}" lang="${escapeHtml(flyerLang)}" dir="${escapeHtml((flyerLocale.meta && flyerLocale.meta.direction) || "ltr")}">
        <div class="left-tear-offs">${tearOffHtml}</div>
        <div class="content">
          <h1 data-fit-field="field-title">${redactionToHtml(config.title)}</h1>
          <div class="distribute" data-fit-field="field-subtitle">${redactionToHtml(config.subtitle)}</div>
          <h1 data-fit-field="field-headline">${redactionToHtml(config.headline)}</h1>
          <hr>
          <div class="message" data-fit-field="field-content">${redactionToHtml(config.content)}</div>
          <div class="qr-code-body">
            <div class="qr-code-url">
              <span class="url-message" data-fit-field="field-url-message">${redactionToHtml(config.url_message)}</span><br><br>
              <a href="${escapeHtml(config.url)}" target="_blank" rel="noopener noreferrer" data-fit-field="field-url">${escapeHtml(config.url)}</a>
            </div>
            <div class="qr-code main-qr" aria-label="QR code for ${escapeHtml(contentQr)}">${contentQrSvg}</div>
          </div>
          <hr>
          <div class="footer">
            <p class="binary" data-fit-field="field-footer-message">${redactionToHtml(config.footer_message)}</p>
            <p class="credit">${escapeHtml(builtWithLabel)} <a href="https://github.com/PR0M3TH3AN/VoxVera">voxvera</a></p>
          </div>
        </div>
      </div>
    `;
    updatePreviewScale();
  }

  function updatePreviewScale() {
    const preview = el("flyer-preview");
    const sheet = preview && preview.querySelector(".container");
    if (!preview || !sheet) return;
    if (!window.matchMedia("(max-width: 900px)").matches) {
      preview.style.removeProperty("--flyer-preview-scale");
      preview.style.removeProperty("--flyer-preview-height");
      preview.style.removeProperty("--flyer-preview-collapse");
      return;
    }
    const availableWidth = Math.max(0, preview.clientWidth);
    const sheetWidth = Math.max(1, sheet.offsetWidth);
    const sheetHeight = Math.max(1, sheet.offsetHeight);
    const scale = Math.min(1, Math.max(0.32, availableWidth / sheetWidth));
    preview.style.setProperty("--flyer-preview-scale", scale.toFixed(4));
    preview.style.setProperty("--flyer-preview-height", `${Math.ceil(sheetHeight * scale)}px`);
    preview.style.setProperty("--flyer-preview-collapse", `${Math.ceil(sheetHeight * scale) - sheetHeight}px`);
  }

  function elementOverflows(node) {
    if (!node) return false;
    const tolerance = 1;
    return node.scrollWidth > node.clientWidth + tolerance || node.scrollHeight > node.clientHeight + tolerance;
  }

  function fieldDisplayFits(fieldId) {
    const selector = DISPLAY_FIT_TARGETS[fieldId];
    if (!selector) return true;
    const target = el("flyer-preview").querySelector(`[data-fit-field="${fieldId}"]`);
    if (elementOverflows(target)) return false;
    const sheet = el("flyer-preview").querySelector(".container");
    return !elementOverflows(sheet);
  }

  function renderFormPreviewForEditing() {
    const payload = rawPayloadFromForm();
    const relays = parseRelays(el("editor-relays").value);
    const identity = getOrCreateAnonIdentity(false);
    const poster = withPosterUrl(payload, identity, relays);
    setRealOutput("author-npub-output", identity.npub);
    setRealOutput("naddr-output", poster.naddr);
    setRealOutput("poster-url-output", poster.posterUrl);
    renderPreview({
      ...CONFIG_DEFAULTS,
      ...poster.payload
    });
  }

  function handleTextFieldInput(fieldId) {
    const field = el(fieldId);
    if (!field) return;
    flyerSource = "custom";
    loadedEventId = "";
    renderFormPreviewForEditing();
    if (!fieldDisplayFits(fieldId)) {
      field.value = lastAcceptedFieldValues[fieldId] || "";
      renderFormPreviewForEditing();
      setFieldError(fieldId, nostrLabel("field_too_long", currentUiLang()).replace(/[:：]\s*$/, ""));
      return;
    }
    lastAcceptedFieldValues[fieldId] = field.value;
    setFieldError(fieldId, "");
  }

  function formToPreview() {
    const payload = buildPayloadFromForm();
    const relays = parseRelays(el("editor-relays").value);
    const identity = getOrCreateAnonIdentity(false);
    const poster = withPosterUrl(payload, identity, relays);
    setRealOutput("author-npub-output", identity.npub);
    setRealOutput("naddr-output", poster.naddr);
    setRealOutput("poster-url-output", poster.posterUrl);
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
    window.requestAnimationFrame(updatePreviewScale);
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
        <span class="${item.ok ? "relay-ok" : "relay-error"}">${item.ok ? "OK" : escapeHtml(item.message || nostrLabel("failed", currentUiLang()))}</span>
      </div>
    `).join("")}</div>`;
  }

  async function copyTextFromElement(targetId, button) {
    const value = el(targetId).textContent.trim();
    const target = el(targetId);
    if (!value || isEmptyOutput(target)) return;
    await navigator.clipboard.writeText(value);
    const oldText = button.textContent;
    button.textContent = nostrLabel("copied", currentUiLang());
    setTimeout(() => {
      button.textContent = oldText;
    }, 1200);
  }

  // Confirmation modal shown after a successful publish, so the author knows
  // the flyer is live and can copy the URL to view/share it.
  function openPublishModal(url) {
    const modal = el("publish-modal");
    const input = el("publish-modal-url");
    if (!modal || !input) return;
    input.value = url || "";
    const copyBtn = el("publish-modal-copy");
    if (copyBtn) copyBtn.textContent = nostrLabel("copy", currentUiLang());
    modal.hidden = false;
    input.focus();
    input.select();
  }

  function closePublishModal() {
    const modal = el("publish-modal");
    if (modal) modal.hidden = true;
  }

  async function fetchAndRenderFromInput(eventInput, relaysValue, statusElement = el("viewer-status")) {
    const parsed = parseEventReference(eventInput);
    if (!parsed) throw new Error(nostrLabel("event_reference_required", currentUiLang()));
    const relays = parseRelays(`${relaysValue}\n${(parsed.relays || []).join("\n")}`);
    if (!relays.length) throw new Error(nostrLabel("relay_required", currentUiLang()));
    el("viewer-event-id").value = eventInput;
    el("viewer-relays").value = relays.join("\n");
    statusElement.textContent = nostrLabel("fetching", currentUiLang());
    const nostrEvent = parsed.type === "address"
      ? await fetchReplaceable(parsed.address, relays)
      : await fetchEvent(parsed.id, relays);
    const payload = payloadFromEvent(nostrEvent);
    const config = normalizePayload(payload);
    flyerSource = "event";
    loadedEventConfig = config;
    loadedEventId = (nostrEvent && nostrEvent.id) || "";
    fillEditorFromConfig(config);
    el("viewer-config-output").value = JSON.stringify(config, null, 2);
    renderPreview({ ...config, event_id: loadedEventId });
    statusElement.textContent = `${nostrLabel("fetched", config.lang)} ${parsed.type === "address" ? parsed.address.identifier : parsed.id}`;
    closeViewerDrawer();
  }

  document.addEventListener("DOMContentLoaded", () => {
    setDefaultText();
    if (window.ResizeObserver) {
      new ResizeObserver(updatePreviewScale).observe(el("flyer-preview"));
    } else {
      window.addEventListener("resize", updatePreviewScale);
    }
    const urlEvent = getUrlEventReference();
    setMode(window.location.hash === "#editor" && !urlEvent ? "editor" : "viewer");
    if (urlEvent) {
      const urlInput = window.location.href;
      const loadingLang = currentUiLang();
      el("viewer-event-id").value = urlInput;
      el("viewer-relays").value = mergeRelayList(el("viewer-relays").value, urlEvent.relays);
      // A viewer arriving via an event-lookup URL should never see the default
      // placeholder flyer. Show a localized loading state until the real event
      // resolves (or a load-failed state if it does not).
      renderStatusPreview(nostrLabel("loading_content", loadingLang), loadingLang);
      fetchAndRenderFromInput(urlInput, el("viewer-relays").value).catch((error) => {
        renderStatusPreview(nostrLabel("load_failed", loadingLang), loadingLang);
        el("viewer-status").textContent = error.message;
        openViewerDrawer();
      });
    }

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => setMode(button.dataset.mode));
    });

    el("publish-modal-close").addEventListener("click", closePublishModal);
    el("publish-modal").addEventListener("click", (event) => {
      if (event.target === el("publish-modal")) closePublishModal();
    });
    el("publish-modal-copy").addEventListener("click", async () => {
      const input = el("publish-modal-url");
      if (!input.value) return;
      const button = el("publish-modal-copy");
      try {
        await navigator.clipboard.writeText(input.value);
        button.textContent = nostrLabel("copied", currentUiLang());
        setTimeout(() => { button.textContent = nostrLabel("copy", currentUiLang()); }, 1200);
      } catch (_) {
        input.focus();
        input.select();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePublishModal();
    });

    LANGUAGE_SELECT_IDS.forEach((selectId) => {
      const select = el(selectId);
      if (!select) return;
      select.addEventListener("change", () => applyLanguageChange(select.value || FALLBACK_LANG));
    });

    PAPER_SELECT_IDS.forEach((selectId) => {
      const select = el(selectId);
      if (!select) return;
      select.addEventListener("change", () => applyPaperSize(select.value || DEFAULT_PAPER));
    });

    TEXT_FIELD_IDS.forEach((fieldId) => {
      const field = el(fieldId);
      if (!field) return;
      field.addEventListener("input", () => handleTextFieldInput(fieldId));
    });

    el("open-viewer-controls").addEventListener("click", openViewerDrawer);
    el("close-viewer-controls").addEventListener("click", closeViewerDrawer);
    el("viewer-editor").addEventListener("click", () => {
      if (loadedEventConfig) fillEditorFromConfig(loadedEventConfig);
      setMode("editor");
    });
    el("viewer-print").addEventListener("click", printWithPageTitle);
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
        identityMode = "anon";
        nip07Pubkey = null;
        persistMode("anon");
        setRealOutput("author-npub-output", identity.npub);
        refreshSignerState();
        refreshIdentityState();
        el("publish-status").textContent = `${nostrLabel("npub_generated", currentUiLang())} ${identity.npub}`;
      } catch (error) {
        el("publish-status").textContent = error.message;
      }
    });

    // Identity mode controls.
    el("connect-nip07").addEventListener("click", () => {
      connectNip07Identity().catch(() => setIdentityError("nip07_missing"));
    });
    el("use-nsec-toggle").addEventListener("click", toggleNsecImport);
    el("nsec-remember").addEventListener("change", () => {
      const pin = el("nsec-pin");
      if (pin) pin.hidden = !el("nsec-remember").checked;
    });
    el("nsec-submit").addEventListener("click", () => {
      submitNsecImport().catch(() => setIdentityError("invalid_nsec"));
    });
    el("nsec-input").addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); el("nsec-submit").click(); }
    });
    el("unlock-key").addEventListener("click", () => {
      unlockIdentity().catch(() => setIdentityError("pin_wrong"));
    });
    el("unlock-pin").addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); el("unlock-key").click(); }
    });
    el("forget-key").addEventListener("click", forgetStoredIdentity);

    restoreIdentity();

    el("preview-editor").addEventListener("click", () => {
      try {
        formToPreview();
        el("publish-status").textContent = nostrLabel("preview_updated", currentUiLang());
      } catch (error) {
        el("publish-status").textContent = error.message;
      }
    });

    el("export-event").addEventListener("click", () => {
      try {
        const payload = buildPayloadFromForm();
        const relays = parseRelays(el("editor-relays").value);
        const identity = activeIdentity();
        const poster = withPosterUrl(payload, identity, relays);
        const event = buildUnsignedEvent(poster.payload);
        setRealOutput("author-npub-output", identity.npub);
        setRealOutput("naddr-output", poster.naddr);
        setRealOutput("poster-url-output", poster.posterUrl);
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
        if (!relays.length) throw new Error(nostrLabel("relay_required", currentUiLang()));
        el("publish-status").textContent = nostrLabel("signing_publishing", currentUiLang());
        const result = await signAndPublish(payload, relays);
        loadedEventId = result.event.id || "";
        setRealOutput("event-id-output", result.event.id);
        el("event-json-output").value = JSON.stringify(result.event, null, 2);
        el("viewer-event-id").value = result.naddr;
        el("publish-status").innerHTML = renderRelayResults(result.results);
        renderPreview({ ...normalizePayload(result.payload), event_id: loadedEventId });
        openPublishModal(result.posterUrl);
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
      el("viewer-status").textContent = nostrLabel("config_copied", currentUiLang());
    });

    el("print-preview").addEventListener("click", printWithPageTitle);
  });
})();
