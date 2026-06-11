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
  // Shared with the main client: the connected viewer's pubkey (hex). The board
  // is gated on having a connected Nostr identity (NIP-07). The data on relays
  // is public regardless, so this is not access control — it supplies the
  // viewer's identity for a later web-of-trust filter (see docs/roadmap.md).
  const NPUB_STORAGE_KEY = "voxvera_connected_pubkey";
  // Shared with the main client: this device's anonymous secret key (hex). The
  // "Create a new key" flow reuses it if present (so it doesn't orphan an
  // identity already used in the editor) or generates and stores one.
  const ANON_SECRET_STORAGE_KEY = "voxvera_nostr_anon_secret_hex";
  // Per-device blocklist of author pubkeys (local "hide this author"), separate
  // from the web-of-trust filter; blocked authors are always hidden.
  const BLOCKED_STORAGE_KEY = "voxvera_blocked_pubkeys";
  // Bootstrap trust anchor (hex pubkey for
  // npub15jnttpymeytm80hatjqcvhhqhzrhx6gxp8pq0wn93rhnu8s9h9dsha32lx). When a
  // connected viewer has no NIP-02 follow list of their own (a fresh key), the
  // board seeds its web-of-trust filter from this account's follows, so a new
  // viewer still gets a curated board instead of the unmoderated firehose.
  const FALLBACK_CURATOR_PUBKEY = "a4a6b5849bc917b3befd5c81865ee0b88773690609c207ba6588ef3e1e05b95b";
  const FALLBACK_LANG = "en";
  const LOCALES = window.VoxVeraLocales || {};

  const BOARD_UI = {
    en: { title: "Bulletin Board", subtitle: "Most recent flyers published to the relays.", col_title: "Title", col_link: "Link", col_author: "Posted by", col_language: "Language", col_date: "Posted", col_event_id: "Event ID", act_edit: "Edit", act_delete: "Delete", act_rebroadcast: "Re-broadcast", act_block: "Block", delete_title: "Delete this flyer?", delete_message: "This requests deletion from the relays and replaces it with a deletion marker so VoxVera hides it. Deletion can't be guaranteed across every relay.", delete_confirm: "Delete", cancel: "Cancel", deleted_done: "Deletion requested.", rebroadcast_done: "Re-broadcast to the relays.", sign_unavailable: "To delete from here, connect with a browser extension or a generated key — or delete from the editor.", unblock_all: "Clear blocked",link_text: "link", loading: "Loading flyers…", empty: "No flyers found yet.", error: "Could not reach the relays.", back: "← Back to VoxVera", gate_title: "Connect to view the board", gate_body: "The bulletin board is visible to people who connect a Nostr identity. Choose how to connect below.", connect: "Connect", connecting: "Connecting…", no_extension: "No Nostr extension found. Install a NIP-07 browser extension to view the board.", connect_failed: "Connection cancelled or failed. Please try again.", disconnect: "Disconnect", filter_following: "Showing flyers from people you follow.", filter_seeded: "You don't follow anyone yet — showing a curated set from VoxVera's trust network.", filter_all: "Showing all flyers on the relays (unfiltered).", filter_unavailable: "Couldn't load a trust network — showing all flyers.", filter_empty: "No flyers from your trust network yet. Turn on “Show all” to see everything.", show_all_label: "Show all flyers", connect_extension: "Browser extension (NIP-07)", connect_nsec: "Use a private key (nsec)", connect_generate: "Create a new key", key_note: "Your key stays in this browser and is only used to read your follow list — it is never sent anywhere.", invalid_nsec: "That doesn't look like a valid nsec key.", gen_warning: "This is your new secret key. Anyone who has it controls this identity — save it somewhere safe, because VoxVera can't recover it.", copy: "Copy", copied: "Copied", continue_label: "Continue" },
    es: { title: "Tablón de anuncios", subtitle: "Carteles más recientes publicados en los relés.", col_title: "Título", col_link: "Enlace", col_author: "Publicado por", col_language: "Idioma", col_date: "Publicado", col_event_id: "ID del evento", act_edit: "Editar", act_delete: "Eliminar", act_rebroadcast: "Reemitir", act_block: "Bloquear", delete_title: "¿Eliminar este cartel?", delete_message: "Esto solicita la eliminación a los relés y lo reemplaza por una marca de eliminación para que VoxVera lo oculte. No se puede garantizar la eliminación en todos los relés.", delete_confirm: "Eliminar", cancel: "Cancelar", deleted_done: "Eliminación solicitada.", rebroadcast_done: "Reemitido a los relés.", sign_unavailable: "Para eliminar desde aquí, conéctate con una extensión del navegador o una clave generada, o elimínalo desde el editor.", unblock_all: "Borrar bloqueados", link_text: "enlace", loading: "Cargando carteles…", empty: "Aún no se encontraron carteles.", error: "No se pudo conectar con los relés.", back: "← Volver a VoxVera", gate_title: "Conéctate para ver el tablón", gate_body: "El tablón de anuncios es visible para quienes conectan una identidad Nostr. Elige abajo cómo conectarte.", connect: "Conectar", connecting: "Conectando…", no_extension: "No se encontró ninguna extensión Nostr. Instala una extensión de navegador NIP-07 para ver el tablón.", connect_failed: "Conexión cancelada o fallida. Inténtalo de nuevo.", disconnect: "Desconectar", filter_following: "Mostrando carteles de las personas que sigues.", filter_seeded: "Aún no sigues a nadie: mostramos un conjunto curado de la red de confianza de VoxVera.", filter_all: "Mostrando todos los carteles de los relés (sin filtrar).", filter_unavailable: "No se pudo cargar una red de confianza: mostrando todos los carteles.", filter_empty: "Aún no hay carteles de tu red de confianza. Activa «Mostrar todos» para verlo todo.", show_all_label: "Mostrar todos los carteles", connect_extension: "Extensión del navegador (NIP-07)", connect_nsec: "Usar una clave privada (nsec)", connect_generate: "Crear una clave nueva", key_note: "Tu clave permanece en este navegador y solo se usa para leer tu lista de seguidos; nunca se envía a ningún sitio.", invalid_nsec: "Eso no parece una clave nsec válida.", gen_warning: "Esta es tu nueva clave secreta. Cualquiera que la tenga controla esta identidad: guárdala en un lugar seguro, porque VoxVera no puede recuperarla.", copy: "Copiar", copied: "Copiado", continue_label: "Continuar" },
    de: { title: "Schwarzes Brett", subtitle: "Neueste auf den Relays veröffentlichte Plakate.", col_title: "Titel", col_link: "Link", col_author: "Veröffentlicht von", col_language: "Sprache", col_date: "Veröffentlicht", col_event_id: "Event-ID", act_edit: "Bearbeiten", act_delete: "Löschen", act_rebroadcast: "Erneut senden", act_block: "Blockieren", delete_title: "Dieses Plakat löschen?", delete_message: "Dies fordert die Löschung von den Relays an und ersetzt es durch eine Löschmarkierung, sodass VoxVera es ausblendet. Eine Löschung über alle Relays hinweg kann nicht garantiert werden.", delete_confirm: "Löschen", cancel: "Abbrechen", deleted_done: "Löschung angefordert.", rebroadcast_done: "Erneut an die Relays gesendet.", sign_unavailable: "Zum Löschen hier mit einer Browser-Erweiterung oder einem generierten Schlüssel verbinden – oder im Editor löschen.", unblock_all: "Blockierte löschen",link_text: "Link", loading: "Plakate werden geladen…", empty: "Noch keine Plakate gefunden.", error: "Relays konnten nicht erreicht werden.", back: "← Zurück zu VoxVera", gate_title: "Verbinden, um das Brett zu sehen", gate_body: "Das Schwarze Brett ist für Personen sichtbar, die eine Nostr-Identität verbinden. Wähle unten, wie du dich verbinden möchtest.", connect: "Verbinden", connecting: "Verbindung…", no_extension: "Keine Nostr-Erweiterung gefunden. Installiere eine NIP-07-Browsererweiterung, um das Brett zu sehen.", connect_failed: "Verbindung abgebrochen oder fehlgeschlagen. Bitte erneut versuchen.", disconnect: "Trennen", filter_following: "Plakate von Personen, denen du folgst.", filter_seeded: "Du folgst noch niemandem – wir zeigen eine kuratierte Auswahl aus dem Vertrauensnetz von VoxVera.", filter_all: "Alle Plakate auf den Relays (ungefiltert).", filter_unavailable: "Vertrauensnetz konnte nicht geladen werden – alle Plakate werden angezeigt.", filter_empty: "Noch keine Plakate aus deinem Vertrauensnetz. Aktiviere „Alle anzeigen“, um alles zu sehen.", show_all_label: "Alle Plakate anzeigen", connect_extension: "Browser-Erweiterung (NIP-07)", connect_nsec: "Privaten Schlüssel (nsec) verwenden", connect_generate: "Neuen Schlüssel erstellen", key_note: "Dein Schlüssel bleibt in diesem Browser und wird nur zum Lesen deiner Folgeliste verwendet – er wird nirgendwohin gesendet.", invalid_nsec: "Das sieht nicht nach einem gültigen nsec-Schlüssel aus.", gen_warning: "Das ist dein neuer geheimer Schlüssel. Wer ihn hat, kontrolliert diese Identität – bewahre ihn sicher auf, denn VoxVera kann ihn nicht wiederherstellen.", copy: "Kopieren", copied: "Kopiert", continue_label: "Weiter" },
    fr: { title: "Tableau d'affichage", subtitle: "Affiches les plus récentes publiées sur les relais.", col_title: "Titre", col_link: "Lien", col_author: "Publié par", col_language: "Langue", col_date: "Publié", col_event_id: "ID de l'événement", act_edit: "Modifier", act_delete: "Supprimer", act_rebroadcast: "Rediffuser", act_block: "Bloquer", delete_title: "Supprimer cette affiche ?", delete_message: "Cela demande la suppression aux relais et la remplace par un marqueur de suppression pour que VoxVera la masque. La suppression ne peut pas être garantie sur tous les relais.", delete_confirm: "Supprimer", cancel: "Annuler", deleted_done: "Suppression demandée.", rebroadcast_done: "Rediffusée aux relais.", sign_unavailable: "Pour supprimer ici, connectez-vous avec une extension de navigateur ou une clé générée — ou supprimez depuis l'éditeur.", unblock_all: "Effacer les blocages",link_text: "lien", loading: "Chargement des affiches…", empty: "Aucune affiche trouvée pour l'instant.", error: "Impossible de joindre les relais.", back: "← Retour à VoxVera", gate_title: "Connectez-vous pour voir le tableau", gate_body: "Le tableau d'affichage est visible par les personnes qui connectent une identité Nostr. Choisissez ci-dessous comment vous connecter.", connect: "Se connecter", connecting: "Connexion…", no_extension: "Aucune extension Nostr trouvée. Installez une extension de navigateur NIP-07 pour voir le tableau.", connect_failed: "Connexion annulée ou échouée. Veuillez réessayer.", disconnect: "Se déconnecter", filter_following: "Affiches des personnes que vous suivez.", filter_seeded: "Vous ne suivez encore personne – voici une sélection issue du réseau de confiance de VoxVera.", filter_all: "Toutes les affiches sur les relais (non filtrées).", filter_unavailable: "Impossible de charger un réseau de confiance – toutes les affiches sont affichées.", filter_empty: "Aucune affiche de votre réseau de confiance pour l'instant. Activez « Tout afficher » pour tout voir.", show_all_label: "Afficher toutes les affiches", connect_extension: "Extension de navigateur (NIP-07)", connect_nsec: "Utiliser une clé privée (nsec)", connect_generate: "Créer une nouvelle clé", key_note: "Votre clé reste dans ce navigateur et ne sert qu'à lire votre liste d'abonnements ; elle n'est jamais envoyée nulle part.", invalid_nsec: "Cela ne ressemble pas à une clé nsec valide.", gen_warning: "Voici votre nouvelle clé secrète. Quiconque la possède contrôle cette identité — conservez-la en lieu sûr, car VoxVera ne peut pas la récupérer.", copy: "Copier", copied: "Copié", continue_label: "Continuer" },
    ru: { title: "Доска объявлений", subtitle: "Последние листовки, опубликованные на реле.", col_title: "Заголовок", col_link: "Ссылка", col_author: "Опубликовал", col_language: "Язык", col_date: "Опубликовано", col_event_id: "ID события", act_edit: "Изменить", act_delete: "Удалить", act_rebroadcast: "Переслать", act_block: "Заблокировать", delete_title: "Удалить эту листовку?", delete_message: "Это запросит удаление у реле и заменит её маркером удаления, чтобы VoxVera её скрыл. Удаление на всех реле не гарантируется.", delete_confirm: "Удалить", cancel: "Отмена", deleted_done: "Запрошено удаление.", rebroadcast_done: "Переслано на реле.", sign_unavailable: "Чтобы удалить отсюда, подключитесь через расширение браузера или сгенерированный ключ — или удалите в редакторе.", unblock_all: "Очистить заблокированных",link_text: "ссылка", loading: "Загрузка листовок…", empty: "Листовки пока не найдены.", error: "Не удалось подключиться к реле.", back: "← Назад в VoxVera", gate_title: "Подключитесь, чтобы увидеть доску", gate_body: "Доска объявлений видна тем, кто подключил идентификацию Nostr. Выберите способ подключения ниже.", connect: "Подключить", connecting: "Подключение…", no_extension: "Расширение Nostr не найдено. Установите расширение браузера NIP-07, чтобы увидеть доску.", connect_failed: "Подключение отменено или не удалось. Повторите попытку.", disconnect: "Отключить", filter_following: "Показаны листовки от тех, на кого вы подписаны.", filter_seeded: "Вы пока ни на кого не подписаны — показываем подборку из сети доверия VoxVera.", filter_all: "Показаны все листовки на реле (без фильтра).", filter_unavailable: "Не удалось загрузить сеть доверия — показаны все листовки.", filter_empty: "Пока нет листовок из вашей сети доверия. Включите «Показать все», чтобы увидеть всё.", show_all_label: "Показать все листовки", connect_extension: "Расширение браузера (NIP-07)", connect_nsec: "Использовать приватный ключ (nsec)", connect_generate: "Создать новый ключ", key_note: "Ваш ключ остаётся в этом браузере и используется только для чтения вашего списка подписок — он никуда не отправляется.", invalid_nsec: "Это не похоже на действительный ключ nsec.", gen_warning: "Это ваш новый секретный ключ. Любой, у кого он есть, управляет этой личностью — сохраните его в надёжном месте, потому что VoxVera не сможет его восстановить.", copy: "Копировать", copied: "Скопировано", continue_label: "Продолжить" },
    he: { title: "לוח מודעות", subtitle: "הכרזות האחרונות שפורסמו לממסרים.", col_title: "כותרת", col_link: "קישור", col_author: "פורסם על ידי", col_language: "שפה", col_date: "פורסם", col_event_id: "מזהה אירוע", act_edit: "ערוך", act_delete: "מחק", act_rebroadcast: "שדר מחדש", act_block: "חסום", delete_title: "למחוק את הכרזה הזו?", delete_message: "פעולה זו מבקשת מחיקה מהממסרים ומחליפה אותה בסימן מחיקה כך ש-VoxVera יסתיר אותה. לא ניתן להבטיח מחיקה בכל הממסרים.", delete_confirm: "מחק", cancel: "ביטול", deleted_done: "התבקשה מחיקה.", rebroadcast_done: "שודר מחדש לממסרים.", sign_unavailable: "כדי למחוק מכאן, התחבר עם תוסף דפדפן או מפתח שנוצר — או מחק מהעורך.", unblock_all: "נקה חסומים",link_text: "קישור", loading: "טוען כרזות…", empty: "לא נמצאו כרזות עדיין.", error: "לא ניתן להתחבר לממסרים.", back: "← חזרה ל-VoxVera", gate_title: "התחבר כדי לראות את הלוח", gate_body: "לוח המודעות גלוי למי שמחבר זהות Nostr. בחר למטה כיצד להתחבר.", connect: "התחבר", connecting: "מתחבר…", no_extension: "לא נמצא תוסף Nostr. התקן תוסף דפדפן NIP-07 כדי לראות את הלוח.", connect_failed: "ההתחברות בוטלה או נכשלה. נסה שוב.", disconnect: "התנתק", filter_following: "מציג כרזות מאנשים שאתה עוקב אחריהם.", filter_seeded: "אינך עוקב עדיין אחר אף אחד — מוצגת בחירה מרשת האמון של VoxVera.", filter_all: "מציג את כל הכרזות בממסרים (ללא סינון).", filter_unavailable: "לא ניתן לטעון רשת אמון — מוצגות כל הכרזות.", filter_empty: "אין עדיין כרזות מרשת האמון שלך. הפעל «הצג הכול» כדי לראות הכול.", show_all_label: "הצג את כל הכרזות", connect_extension: "תוסף דפדפן (NIP-07)", connect_nsec: "השתמש במפתח פרטי (nsec)", connect_generate: "צור מפתח חדש", key_note: "המפתח שלך נשאר בדפדפן זה ומשמש רק לקריאת רשימת העוקבים שלך — הוא לעולם לא נשלח לשום מקום.", invalid_nsec: "זה לא נראה כמו מפתח nsec תקין.", gen_warning: "זהו המפתח הסודי החדש שלך. כל מי שיש לו אותו שולט בזהות הזו — שמור אותו במקום בטוח, מכיוון ש-VoxVera אינה יכולה לשחזר אותו.", copy: "העתק", copied: "הועתק", continue_label: "המשך" },
    ar: { title: "لوحة الإعلانات", subtitle: "أحدث الملصقات المنشورة على المرحلات.", col_title: "العنوان", col_link: "رابط", col_author: "نُشر بواسطة", col_language: "اللغة", col_date: "تاريخ النشر", col_event_id: "معرّف الحدث", act_edit: "تعديل", act_delete: "حذف", act_rebroadcast: "إعادة بث", act_block: "حظر", delete_title: "حذف هذا الملصق؟", delete_message: "يطلب هذا الحذف من المرحلات ويستبدله بعلامة حذف حتى يخفيه VoxVera. لا يمكن ضمان الحذف عبر كل مرحل.", delete_confirm: "حذف", cancel: "إلغاء", deleted_done: "تم طلب الحذف.", rebroadcast_done: "أُعيد بثه إلى المرحلات.", sign_unavailable: "للحذف من هنا، اتصل بإضافة متصفح أو مفتاح مُنشأ — أو احذف من المحرر.", unblock_all: "مسح المحظورين",link_text: "رابط", loading: "جارٍ تحميل الملصقات…", empty: "لم يتم العثور على ملصقات بعد.", error: "تعذّر الوصول إلى المرحلات.", back: "← العودة إلى VoxVera", gate_title: "اتصل لعرض اللوحة", gate_body: "لوحة الإعلانات مرئية لمن يربط هوية Nostr. اختر أدناه كيفية الاتصال.", connect: "اتصال", connecting: "جارٍ الاتصال…", no_extension: "لم يتم العثور على إضافة Nostr. ثبّت إضافة متصفح NIP-07 لعرض اللوحة.", connect_failed: "تم إلغاء الاتصال أو فشل. يرجى المحاولة مرة أخرى.", disconnect: "قطع الاتصال", filter_following: "عرض الملصقات من الأشخاص الذين تتابعهم.", filter_seeded: "أنت لا تتابع أحدًا بعد — نعرض مجموعة مختارة من شبكة الثقة في VoxVera.", filter_all: "عرض جميع الملصقات على المرحلات (دون تصفية).", filter_unavailable: "تعذّر تحميل شبكة ثقة — يتم عرض جميع الملصقات.", filter_empty: "لا توجد ملصقات من شبكة الثقة الخاصة بك بعد. فعّل «عرض الكل» لرؤية كل شيء.", show_all_label: "عرض جميع الملصقات", connect_extension: "إضافة المتصفح (NIP-07)", connect_nsec: "استخدام مفتاح خاص (nsec)", connect_generate: "إنشاء مفتاح جديد", key_note: "يبقى مفتاحك في هذا المتصفح ويُستخدم فقط لقراءة قائمة متابَعاتك — ولا يُرسل إلى أي مكان أبدًا.", invalid_nsec: "لا يبدو هذا مفتاح nsec صالحًا.", gen_warning: "هذا مفتاحك السري الجديد. أي شخص يملكه يتحكم في هذه الهوية — احفظه في مكان آمن، لأن VoxVera لا يمكنها استعادته.", copy: "نسخ", copied: "تم النسخ", continue_label: "متابعة" },
    fa: { title: "تابلوی اعلانات", subtitle: "جدیدترین پوسترهای منتشرشده روی رله‌ها.", col_title: "عنوان", col_link: "پیوند", col_author: "منتشرشده توسط", col_language: "زبان", col_date: "تاریخ انتشار", col_event_id: "شناسه رویداد", act_edit: "ویرایش", act_delete: "حذف", act_rebroadcast: "بازپخش", act_block: "مسدود کردن", delete_title: "این پوستر حذف شود؟", delete_message: "این از رله‌ها درخواست حذف می‌کند و آن را با یک نشان حذف جایگزین می‌کند تا VoxVera آن را پنهان کند. حذف در همه رله‌ها تضمین نمی‌شود.", delete_confirm: "حذف", cancel: "لغو", deleted_done: "درخواست حذف ارسال شد.", rebroadcast_done: "به رله‌ها بازپخش شد.", sign_unavailable: "برای حذف از اینجا، با افزونه مرورگر یا کلید ساخته‌شده متصل شوید — یا از ویرایشگر حذف کنید.", unblock_all: "پاک کردن مسدودها",link_text: "پیوند", loading: "در حال بارگذاری پوسترها…", empty: "هنوز پوستری یافت نشد.", error: "اتصال به رله‌ها ممکن نشد.", back: "← بازگشت به VoxVera", gate_title: "برای مشاهده تابلو متصل شوید", gate_body: "تابلوی اعلانات برای کسانی که هویت Nostr را متصل می‌کنند قابل مشاهده است. در زیر نحوه اتصال را انتخاب کنید.", connect: "اتصال", connecting: "در حال اتصال…", no_extension: "هیچ افزونه Nostr یافت نشد. برای مشاهده تابلو یک افزونه مرورگر NIP-07 نصب کنید.", connect_failed: "اتصال لغو شد یا ناموفق بود. لطفاً دوباره تلاش کنید.", disconnect: "قطع اتصال", filter_following: "نمایش پوسترها از افرادی که دنبال می‌کنید.", filter_seeded: "هنوز کسی را دنبال نمی‌کنید — مجموعه‌ای منتخب از شبکه اعتماد VoxVera نمایش داده می‌شود.", filter_all: "نمایش همه پوسترها روی رله‌ها (بدون فیلتر).", filter_unavailable: "بارگذاری شبکه اعتماد ممکن نشد — همه پوسترها نمایش داده می‌شوند.", filter_empty: "هنوز پوستری از شبکه اعتماد شما نیست. «نمایش همه» را روشن کنید تا همه را ببینید.", show_all_label: "نمایش همه پوسترها", connect_extension: "افزونه مرورگر (NIP-07)", connect_nsec: "استفاده از کلید خصوصی (nsec)", connect_generate: "ایجاد کلید جدید", key_note: "کلید شما در همین مرورگر می‌ماند و فقط برای خواندن فهرست دنبال‌شده‌های شما استفاده می‌شود — هرگز به جایی ارسال نمی‌شود.", invalid_nsec: "این یک کلید nsec معتبر به نظر نمی‌رسد.", gen_warning: "این کلید مخفی جدید شماست. هر کسی آن را داشته باشد این هویت را کنترل می‌کند — آن را جایی امن ذخیره کنید، زیرا VoxVera نمی‌تواند آن را بازیابی کند.", copy: "کپی", copied: "کپی شد", continue_label: "ادامه" },
    hi: { title: "बुलेटिन बोर्ड", subtitle: "रिले पर प्रकाशित सबसे हाल के पोस्टर।", col_title: "शीर्षक", col_link: "लिंक", col_author: "द्वारा पोस्ट किया गया", col_language: "भाषा", col_date: "पोस्ट किया गया", col_event_id: "इवेंट ID", act_edit: "संपादित करें", act_delete: "हटाएँ", act_rebroadcast: "पुनः प्रसारित करें", act_block: "ब्लॉक करें", delete_title: "इस पोस्टर को हटाएँ?", delete_message: "यह रिले से हटाने का अनुरोध करता है और इसे एक विलोपन चिह्न से बदल देता है ताकि VoxVera इसे छिपा दे। हर रिले पर विलोपन की गारंटी नहीं दी जा सकती।", delete_confirm: "हटाएँ", cancel: "रद्द करें", deleted_done: "विलोपन का अनुरोध किया गया।", rebroadcast_done: "रिले पर पुनः प्रसारित किया गया।", sign_unavailable: "यहाँ से हटाने के लिए, ब्राउज़र एक्सटेंशन या जेनरेट की गई कुंजी से कनेक्ट करें — या संपादक से हटाएँ।", unblock_all: "ब्लॉक किए गए साफ़ करें",link_text: "लिंक", loading: "पोस्टर लोड हो रहे हैं…", empty: "अभी तक कोई पोस्टर नहीं मिला।", error: "रिले तक नहीं पहुँच सके।", back: "← VoxVera पर वापस", gate_title: "बोर्ड देखने के लिए कनेक्ट करें", gate_body: "बुलेटिन बोर्ड उन लोगों को दिखता है जो Nostr पहचान कनेक्ट करते हैं। नीचे चुनें कि कैसे कनेक्ट करना है।", connect: "कनेक्ट करें", connecting: "कनेक्ट हो रहा है…", no_extension: "कोई Nostr एक्सटेंशन नहीं मिला। बोर्ड देखने के लिए NIP-07 ब्राउज़र एक्सटेंशन इंस्टॉल करें।", connect_failed: "कनेक्शन रद्द या विफल। कृपया पुनः प्रयास करें।", disconnect: "डिस्कनेक्ट करें", filter_following: "उन लोगों के पोस्टर दिखा रहे हैं जिन्हें आप फ़ॉलो करते हैं।", filter_seeded: "आप अभी किसी को फ़ॉलो नहीं करते — VoxVera के विश्वास नेटवर्क से चुनिंदा पोस्टर दिखा रहे हैं।", filter_all: "रिले पर सभी पोस्टर दिखा रहे हैं (बिना फ़िल्टर)।", filter_unavailable: "विश्वास नेटवर्क लोड नहीं हो सका — सभी पोस्टर दिखा रहे हैं।", filter_empty: "आपके विश्वास नेटवर्क से अभी कोई पोस्टर नहीं। सब कुछ देखने के लिए “सभी दिखाएँ” चालू करें।", show_all_label: "सभी पोस्टर दिखाएँ", connect_extension: "ब्राउज़र एक्सटेंशन (NIP-07)", connect_nsec: "निजी कुंजी (nsec) का उपयोग करें", connect_generate: "नई कुंजी बनाएँ", key_note: "आपकी कुंजी इसी ब्राउज़र में रहती है और केवल आपकी फ़ॉलो सूची पढ़ने के लिए उपयोग होती है — इसे कहीं नहीं भेजा जाता।", invalid_nsec: "यह एक मान्य nsec कुंजी नहीं लगती।", gen_warning: "यह आपकी नई गुप्त कुंजी है। जिसके पास यह होगी वह इस पहचान को नियंत्रित कर सकता है — इसे सुरक्षित जगह सहेजें, क्योंकि VoxVera इसे पुनर्प्राप्त नहीं कर सकता।", copy: "कॉपी करें", copied: "कॉपी किया गया", continue_label: "जारी रखें" },
    ja: { title: "掲示板", subtitle: "リレーに公開された最新のちらし。", col_title: "タイトル", col_link: "リンク", col_author: "投稿者", col_language: "言語", col_date: "投稿日", col_event_id: "イベントID", act_edit: "編集", act_delete: "削除", act_rebroadcast: "再配信", act_block: "ブロック", delete_title: "このちらしを削除しますか？", delete_message: "リレーに削除を要求し、削除マーカーに置き換えて VoxVera で非表示にします。すべてのリレーでの削除は保証できません。", delete_confirm: "削除", cancel: "キャンセル", deleted_done: "削除を要求しました。", rebroadcast_done: "リレーに再配信しました。", sign_unavailable: "ここから削除するには、ブラウザ拡張機能または生成した鍵で接続してください。またはエディターから削除してください。", unblock_all: "ブロックを消去",link_text: "リンク", loading: "ちらしを読み込んでいます…", empty: "まだちらしが見つかりません。", error: "リレーに接続できませんでした。", back: "← VoxVera に戻る", gate_title: "掲示板を見るには接続してください", gate_body: "掲示板はNostr IDを接続した人に表示されます。下で接続方法を選んでください。", connect: "接続", connecting: "接続中…", no_extension: "Nostr拡張機能が見つかりません。掲示板を見るにはNIP-07ブラウザ拡張機能をインストールしてください。", connect_failed: "接続がキャンセルされたか失敗しました。もう一度お試しください。", disconnect: "切断", filter_following: "フォローしている人のちらしを表示しています。", filter_seeded: "まだ誰もフォローしていません。VoxVera の信頼ネットワークから厳選したものを表示しています。", filter_all: "リレー上のすべてのちらしを表示しています（フィルターなし）。", filter_unavailable: "信頼ネットワークを読み込めませんでした。すべてのちらしを表示しています。", filter_empty: "あなたの信頼ネットワークのちらしはまだありません。「すべて表示」をオンにするとすべて表示されます。", show_all_label: "すべてのちらしを表示", connect_extension: "ブラウザ拡張機能 (NIP-07)", connect_nsec: "秘密鍵 (nsec) を使う", connect_generate: "新しい鍵を作成", key_note: "鍵はこのブラウザ内に留まり、フォローリストの読み取りにのみ使用されます。どこにも送信されません。", invalid_nsec: "有効な nsec 鍵ではないようです。", gen_warning: "これはあなたの新しい秘密鍵です。これを持つ人は誰でもこの ID を操作できます。VoxVera は復元できないので、安全な場所に保存してください。", copy: "コピー", copied: "コピーしました", continue_label: "続行" },
    pt: { title: "Quadro de avisos", subtitle: "Panfletos mais recentes publicados nos relés.", col_title: "Título", col_link: "Link", col_author: "Publicado por", col_language: "Idioma", col_date: "Publicado", col_event_id: "ID do evento", act_edit: "Editar", act_delete: "Excluir", act_rebroadcast: "Retransmitir", act_block: "Bloquear", delete_title: "Excluir este panfleto?", delete_message: "Isso solicita a exclusão aos relés e o substitui por um marcador de exclusão para que o VoxVera o oculte. A exclusão não pode ser garantida em todos os relés.", delete_confirm: "Excluir", cancel: "Cancelar", deleted_done: "Exclusão solicitada.", rebroadcast_done: "Retransmitido aos relés.", sign_unavailable: "Para excluir aqui, conecte-se com uma extensão de navegador ou uma chave gerada — ou exclua no editor.", unblock_all: "Limpar bloqueados", link_text: "link", loading: "Carregando panfletos…", empty: "Nenhum panfleto encontrado ainda.", error: "Não foi possível acessar os relés.", back: "← Voltar ao VoxVera", gate_title: "Conecte-se para ver o quadro", gate_body: "O quadro de avisos é visível para quem conecta uma identidade Nostr. Escolha abaixo como se conectar.", connect: "Conectar", connecting: "Conectando…", no_extension: "Nenhuma extensão Nostr encontrada. Instale uma extensão de navegador NIP-07 para ver o quadro.", connect_failed: "Conexão cancelada ou falhou. Tente novamente.", disconnect: "Desconectar", filter_following: "Mostrando panfletos de pessoas que você segue.", filter_seeded: "Você ainda não segue ninguém — mostrando uma seleção da rede de confiança da VoxVera.", filter_all: "Mostrando todos os panfletos nos relés (sem filtro).", filter_unavailable: "Não foi possível carregar uma rede de confiança — mostrando todos os panfletos.", filter_empty: "Ainda não há panfletos da sua rede de confiança. Ative “Mostrar todos” para ver tudo.", show_all_label: "Mostrar todos os panfletos", connect_extension: "Extensão do navegador (NIP-07)", connect_nsec: "Usar uma chave privada (nsec)", connect_generate: "Criar uma nova chave", key_note: "Sua chave permanece neste navegador e é usada apenas para ler sua lista de seguidos — nunca é enviada para lugar algum.", invalid_nsec: "Isso não parece uma chave nsec válida.", gen_warning: "Esta é sua nova chave secreta. Qualquer pessoa que a tenha controla esta identidade — guarde-a em local seguro, pois o VoxVera não pode recuperá-la.", copy: "Copiar", copied: "Copiado", continue_label: "Continuar" },
    sw: { title: "Ubao wa matangazo", subtitle: "Mabango ya hivi karibuni yaliyochapishwa kwenye relay.", col_title: "Kichwa", col_link: "Kiungo", col_author: "Imechapishwa na", col_language: "Lugha", col_date: "Imechapishwa", col_event_id: "Kitambulisho cha tukio", act_edit: "Hariri", act_delete: "Futa", act_rebroadcast: "Tangaza tena", act_block: "Zuia", delete_title: "Futa bango hili?", delete_message: "Hii inaomba kufuta kutoka relay na kulibadilisha na alama ya kufuta ili VoxVera ilifiche. Kufuta hakuwezi kuhakikishwa kwenye kila relay.", delete_confirm: "Futa", cancel: "Ghairi", deleted_done: "Kufuta kumeombwa.", rebroadcast_done: "Limetangazwa tena kwenye relay.", sign_unavailable: "Ili kufuta hapa, unganisha kwa kiendelezi cha kivinjari au ufunguo uliotengenezwa — au futa kutoka kwa kihariri.", unblock_all: "Futa walizuiliwa",link_text: "kiungo", loading: "Inapakia mabango…", empty: "Hakuna mabango yaliyopatikana bado.", error: "Imeshindwa kufikia relay.", back: "← Rudi VoxVera", gate_title: "Unganisha ili kuona ubao", gate_body: "Ubao wa matangazo unaonekana kwa wale wanaounganisha kitambulisho cha Nostr. Chagua hapa chini jinsi ya kuunganisha.", connect: "Unganisha", connecting: "Inaunganisha…", no_extension: "Hakuna kiendelezi cha Nostr kilichopatikana. Sakinisha kiendelezi cha kivinjari cha NIP-07 ili kuona ubao.", connect_failed: "Muunganisho umeghairiwa au umeshindwa. Tafadhali jaribu tena.", disconnect: "Tenganisha", filter_following: "Inaonyesha mabango kutoka kwa watu unaowafuata.", filter_seeded: "Bado hufuati mtu yeyote — tunaonyesha mkusanyiko uliochaguliwa kutoka mtandao wa kuaminiana wa VoxVera.", filter_all: "Inaonyesha mabango yote kwenye relay (bila kuchuja).", filter_unavailable: "Imeshindwa kupakia mtandao wa kuaminiana — inaonyesha mabango yote.", filter_empty: "Bado hakuna mabango kutoka mtandao wako wa kuaminiana. Washa “Onyesha yote” kuona yote.", show_all_label: "Onyesha mabango yote", connect_extension: "Kiendelezi cha kivinjari (NIP-07)", connect_nsec: "Tumia ufunguo wa faragha (nsec)", connect_generate: "Tengeneza ufunguo mpya", key_note: "Ufunguo wako unabaki katika kivinjari hiki na hutumika tu kusoma orodha yako ya unaowafuata — haupelekwi popote.", invalid_nsec: "Huu hauonekani kama ufunguo halali wa nsec.", gen_warning: "Huu ndio ufunguo wako mpya wa siri. Yeyote aliye nao anadhibiti utambulisho huu — uhifadhi mahali salama, kwa sababu VoxVera haiwezi kuurejesha.", copy: "Nakili", copied: "Imenakiliwa", continue_label: "Endelea" },
    tr: { title: "İlan panosu", subtitle: "Rölelere yayımlanan en yeni el ilanları.", col_title: "Başlık", col_link: "Bağlantı", col_author: "Yayımlayan", col_language: "Dil", col_date: "Yayımlandı", col_event_id: "Olay ID", act_edit: "Düzenle", act_delete: "Sil", act_rebroadcast: "Yeniden yayınla", act_block: "Engelle", delete_title: "Bu el ilanı silinsin mi?", delete_message: "Bu, rölelerden silmeyi ister ve VoxVera'nın gizlemesi için bir silme işaretiyle değiştirir. Silme her rölede garanti edilemez.", delete_confirm: "Sil", cancel: "İptal", deleted_done: "Silme istendi.", rebroadcast_done: "Rölelere yeniden yayınlandı.", sign_unavailable: "Buradan silmek için bir tarayıcı uzantısı veya oluşturulmuş bir anahtarla bağlan — ya da düzenleyiciden sil.", unblock_all: "Engellenenleri temizle",link_text: "bağlantı", loading: "El ilanları yükleniyor…", empty: "Henüz el ilanı bulunamadı.", error: "Rölelere ulaşılamadı.", back: "← VoxVera'ya dön", gate_title: "Panoyu görmek için bağlanın", gate_body: "İlan panosu, bir Nostr kimliği bağlayanlara görünür. Aşağıdan nasıl bağlanacağını seç.", connect: "Bağlan", connecting: "Bağlanıyor…", no_extension: "Nostr uzantısı bulunamadı. Panoyu görmek için bir NIP-07 tarayıcı uzantısı kurun.", connect_failed: "Bağlantı iptal edildi veya başarısız oldu. Lütfen tekrar deneyin.", disconnect: "Bağlantıyı kes", filter_following: "Takip ettiğin kişilerin el ilanları gösteriliyor.", filter_seeded: "Henüz kimseyi takip etmiyorsun — VoxVera'nın güven ağından seçilmiş bir küme gösteriliyor.", filter_all: "Rölelerdeki tüm el ilanları gösteriliyor (filtresiz).", filter_unavailable: "Güven ağı yüklenemedi — tüm el ilanları gösteriliyor.", filter_empty: "Güven ağından henüz el ilanı yok. Her şeyi görmek için “Tümünü göster”i aç.", show_all_label: "Tüm el ilanlarını göster", connect_extension: "Tarayıcı uzantısı (NIP-07)", connect_nsec: "Özel anahtar (nsec) kullan", connect_generate: "Yeni anahtar oluştur", key_note: "Anahtarın bu tarayıcıda kalır ve yalnızca takip listeni okumak için kullanılır — hiçbir yere gönderilmez.", invalid_nsec: "Bu geçerli bir nsec anahtarı gibi görünmüyor.", gen_warning: "Bu senin yeni gizli anahtarın. Ona sahip olan herkes bu kimliği kontrol eder — güvenli bir yerde sakla, çünkü VoxVera onu kurtaramaz.", copy: "Kopyala", copied: "Kopyalandı", continue_label: "Devam et" },
    zh: { title: "公告栏", subtitle: "发布到中继的最新传单。", col_title: "标题", col_link: "链接", col_author: "发布者", col_language: "语言", col_date: "发布时间", col_event_id: "事件 ID", act_edit: "编辑", act_delete: "删除", act_rebroadcast: "重新广播", act_block: "屏蔽", delete_title: "删除此传单？", delete_message: "这将请求中继删除它，并用删除标记替换它，使 VoxVera 将其隐藏。无法保证在每个中继上都删除。", delete_confirm: "删除", cancel: "取消", deleted_done: "已请求删除。", rebroadcast_done: "已重新广播到中继。", sign_unavailable: "若要在此删除，请使用浏览器扩展或生成的密钥连接——或在编辑器中删除。", unblock_all: "清除屏蔽",link_text: "链接", loading: "正在加载传单…", empty: "尚未找到传单。", error: "无法连接到中继。", back: "← 返回 VoxVera", gate_title: "连接以查看公告栏", gate_body: "公告栏对连接了 Nostr 身份的人可见。请在下方选择连接方式。", connect: "连接", connecting: "正在连接…", no_extension: "未找到 Nostr 扩展。请安装 NIP-07 浏览器扩展以查看公告栏。", connect_failed: "连接已取消或失败。请重试。", disconnect: "断开连接", filter_following: "正在显示你关注的人的传单。", filter_seeded: "你还没有关注任何人——正在显示来自 VoxVera 信任网络的精选内容。", filter_all: "正在显示中继上的所有传单（未过滤）。", filter_unavailable: "无法加载信任网络——正在显示所有传单。", filter_empty: "你的信任网络暂时没有传单。开启“显示全部”以查看所有内容。", show_all_label: "显示所有传单", connect_extension: "浏览器扩展 (NIP-07)", connect_nsec: "使用私钥 (nsec)", connect_generate: "创建新密钥", key_note: "你的密钥保留在此浏览器中，仅用于读取你的关注列表——绝不会发送到任何地方。", invalid_nsec: "这看起来不是有效的 nsec 密钥。", gen_warning: "这是你的新私钥。拥有它的任何人都能控制此身份——请妥善保存，因为 VoxVera 无法恢复它。", copy: "复制", copied: "已复制", continue_label: "继续" }
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

  // Run a single REQ with the given filter across the default relays. Resolves
  // with the collected raw events plus whether any relay connection opened (so
  // we can tell "nothing found" apart from "relays unreachable").
  function queryRelays(relays, filter, timeoutMs) {
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
          ws.send(JSON.stringify(["REQ", sub, filter]));
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

  // A tombstone is the deletion marker a flyer is replaced with (same d-tag):
  // payload.deleted, or a ["deleted"] tag. The latest version winning means a
  // tombstone hides the flyer even on relays that ignore NIP-09 deletions.
  function isTombstone(event, payload) {
    if (payload && payload.deleted === true) return true;
    const tags = (event && event.tags) || [];
    return tags.some((x) => x[0] === "deleted");
  }

  // Reduce raw events to the latest flyer per author+identifier (replaceable).
  // Keep the newest event per key first (including tombstones), then drop any
  // key whose newest version is a deletion — so a delete can't be undone by an
  // older copy that happens to arrive after it.
  function parseFlyers(events) {
    const tools = window.NostrTools;
    const latest = new Map();
    events.forEach((e) => {
      if (!e || e.kind !== EVENT_KIND) return;
      const tags = e.tags || [];
      if (!tags.some((x) => x[0] === "t" && x[1] === "voxvera")) return;
      const key = e.pubkey + ":" + dtagOf(tags);
      const prev = latest.get(key);
      if (!prev || (e.created_at || 0) > (prev.created_at || 0)) latest.set(key, e);
    });
    const out = [];
    latest.forEach((e) => {
      let payload;
      try { payload = JSON.parse(e.content); } catch (_) { return; }
      if (isTombstone(e, payload)) return;
      const tags = e.tags || [];
      let npub = e.pubkey;
      try { npub = tools.nip19.npubEncode(e.pubkey); } catch (_) {}
      out.push({
        title: String(payload.title || "").trim(),
        link: String(payload.tear_off_link || payload.url || "").trim(),
        npub: npub,
        pubkey: String(e.pubkey || "").toLowerCase(),
        id: String(e.id || ""),
        dtag: dtagOf(tags),
        lang: payload.lang || langFromTags(tags) || "",
        created_at: e.created_at || 0,
        raw: e
      });
    });
    return out;
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
      cmp: (a, b) => (a.created_at || 0) - (b.created_at || 0) },
    { key: "id", label: () => t("col_event_id"),
      cell: (r) => r.id
        ? `<span class="board-eventid" title="${escapeHtml(r.id)}">${escapeHtml(shortId(r.id))}</span>`
          + `<button type="button" class="board-copy" data-copy="${escapeHtml(r.id)}">${escapeHtml(t("copy"))}</button>`
        : "—",
      cmp: (a, b) => (a.id || "").localeCompare(b.id || "") },
    { key: "actions", label: () => "", sortable: false,
      cell: (r) => actionsCell(r), cmp: () => 0 }
  ];

  // Per-row actions: manage your own flyers (edit / re-broadcast / delete), or
  // block authors you didn't post.
  function actionsCell(r) {
    const isMine = connectedPubkey && r.pubkey === connectedPubkey;
    if (isMine) {
      const naddr = naddrFor(r);
      const edit = naddr
        ? `<a class="board-action" href="${escapeHtml(editUrlForNaddr(naddr))}">${escapeHtml(t("act_edit"))}</a>`
        : "";
      const reb = `<button type="button" class="board-action" data-act="rebroadcast" data-id="${escapeHtml(r.id)}">${escapeHtml(t("act_rebroadcast"))}</button>`;
      const del = `<button type="button" class="board-action danger" data-act="delete" data-id="${escapeHtml(r.id)}">${escapeHtml(t("act_delete"))}</button>`;
      return edit + reb + del;
    }
    return `<button type="button" class="board-action" data-act="block" data-pubkey="${escapeHtml(r.pubkey)}">${escapeHtml(t("act_block"))}</button>`;
  }

  function naddrFor(r) {
    try {
      return window.NostrTools.nip19.naddrEncode({
        identifier: r.dtag, pubkey: r.pubkey, kind: EVENT_KIND, relays: DEFAULT_RELAYS.slice(0, 1)
      });
    } catch (_) {
      return "";
    }
  }

  function editUrlForNaddr(naddr) {
    return `${window.location.origin}/?edit=1#${naddr}`;
  }

  function shortId(id) {
    return id && id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-4)}` : (id || "—");
  }

  function renderHead() {
    const head = document.getElementById("board-head");
    head.innerHTML = COLS.map((c) => {
      const sortable = c.sortable !== false;
      const ind = sortable && c.key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "";
      return `<th data-key="${c.key}"${sortable ? "" : ' class="no-sort"'}>${escapeHtml(c.label())}<span class="sort-indicator">${ind}</span></th>`;
    }).join("");
    head.querySelectorAll("th:not(.no-sort)").forEach((th) => {
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
    // Login gate + identity chip (localized whether or not they are visible).
    setText("board-gate-title", t("gate_title"));
    setText("board-gate-body", t("gate_body"));
    setText("board-connect", connecting ? t("connecting") : t("connect_extension"));
    setText("board-connect-nsec-toggle", t("connect_nsec"));
    setText("board-generate", t("connect_generate"));
    setText("board-nsec-submit", t("connect"));
    setText("board-nsec-note", t("key_note"));
    setText("board-gen-warning", t("gen_warning"));
    setText("board-gen-continue", t("continue_label"));
    const copyBtn = document.getElementById("board-gen-copy");
    if (copyBtn) copyBtn.textContent = t("copy");
    setText("board-disconnect", t("disconnect"));
    // Delete-confirm modal.
    setText("board-delete-title", t("delete_title"));
    setText("board-delete-message", t("delete_message"));
    setText("board-delete-confirm", t("delete_confirm"));
    setText("board-delete-cancel", t("cancel"));
    refreshGateError();
    updateFilterControls();
    updateBlockedNote();
    const sel = document.getElementById("board-lang");
    if (sel) sel.value = currentLang;
    setStatus(statusKey);
    renderHead();
    renderBody();
  }

  // ---- Login gate (NIP-07) ----------------------------------------------
  // The board is shown only to a connected Nostr identity. This is the seam
  // for a future web-of-trust filter; today it just establishes who is viewing.
  let connectedPubkey = null;
  let connectedNpub = null;
  let connecting = false;
  let gateErrorKey = "";

  // ---- Web-of-trust filter (NIP-02) -------------------------------------
  // The board defaults to flyers from authors in the viewer's trust set: the
  // people they follow. A fresh key with no follow list is seeded from
  // FALLBACK_CURATOR_PUBKEY's follows so a new viewer still gets a curated board
  // rather than the unmoderated firehose. "Show all" opts out of the filter.
  let allRows = [];                 // every parsed flyer, pre-filter
  let trustSet = new Set();         // hex pubkeys whose flyers we show
  let trustSource = "viewer";       // "viewer" | "seeded" | "unavailable"
  let showAll = false;
  let boardLoaded = false;

  function nip07Available() {
    return !!(window.nostr && typeof window.nostr.getPublicKey === "function");
  }

  function getStoredPubkey() {
    try {
      const stored = window.localStorage.getItem(NPUB_STORAGE_KEY);
      return stored && /^[0-9a-f]{64}$/i.test(stored) ? stored.toLowerCase() : "";
    } catch (_) {
      return "";
    }
  }

  function refreshGateError() {
    const node = document.getElementById("board-gate-error");
    if (!node) return;
    if (gateErrorKey) {
      node.hidden = false;
      node.textContent = t(gateErrorKey);
    } else {
      node.hidden = true;
      node.textContent = "";
    }
  }

  function showGate() {
    const gate = document.getElementById("board-gate");
    const content = document.getElementById("board-content");
    const identity = document.getElementById("board-identity");
    if (gate) gate.hidden = false;
    if (content) content.hidden = true;
    if (identity) identity.hidden = true;
    // Collapse the alternate connect methods and clear any pasted secret.
    const nsecRow = document.getElementById("board-nsec-row");
    if (nsecRow) nsecRow.hidden = true;
    const nsecInput = document.getElementById("board-nsec-input");
    if (nsecInput) nsecInput.value = "";
    const gen = document.getElementById("board-generated");
    if (gen) gen.hidden = true;
    pendingGeneratedPubkey = null;
  }

  function showConnected() {
    const gate = document.getElementById("board-gate");
    const content = document.getElementById("board-content");
    const identity = document.getElementById("board-identity");
    if (gate) gate.hidden = true;
    if (content) content.hidden = false;
    if (identity) {
      identity.hidden = false;
      const npubNode = document.getElementById("board-identity-npub");
      if (npubNode) {
        npubNode.textContent = shortNpub(connectedNpub);
        npubNode.title = connectedNpub || "";
      }
    }
  }

  function setConnecting(isConnecting) {
    connecting = isConnecting;
    const btn = document.getElementById("board-connect");
    if (btn) {
      btn.disabled = isConnecting;
      btn.textContent = isConnecting ? t("connecting") : t("connect_extension");
    }
  }

  // Core: adopt a hex pubkey as the viewer identity, persist it (the board only
  // ever needs the pubkey — it reads, never signs), and reveal the board.
  function connectWithPubkey(pubkeyHex) {
    if (!/^[0-9a-f]{64}$/i.test(String(pubkeyHex || ""))) {
      gateErrorKey = "connect_failed";
      refreshGateError();
      return;
    }
    connectedPubkey = String(pubkeyHex).toLowerCase();
    try {
      connectedNpub = window.NostrTools.nip19.npubEncode(connectedPubkey);
    } catch (_) {
      connectedNpub = connectedPubkey;
    }
    try { window.localStorage.setItem(NPUB_STORAGE_KEY, connectedPubkey); } catch (_) {}
    gateErrorKey = "";
    refreshGateError();
    showConnected();
    loadBoard();
  }

  // Method 1: NIP-07 browser extension.
  async function connectExtension() {
    gateErrorKey = "";
    refreshGateError();
    if (!nip07Available()) {
      gateErrorKey = "no_extension";
      refreshGateError();
      return;
    }
    setConnecting(true);
    try {
      const pubkey = await window.nostr.getPublicKey();
      setConnecting(false);
      if (!/^[0-9a-f]{64}$/i.test(String(pubkey || ""))) throw new Error("invalid pubkey");
      connectWithPubkey(pubkey);
    } catch (_) {
      setConnecting(false);
      gateErrorKey = "connect_failed";
      refreshGateError();
    }
  }

  // Method 2: paste an nsec. Decode in-page to derive the pubkey, then discard
  // the secret — it is never stored or transmitted (only the pubkey persists).
  function connectNsec() {
    gateErrorKey = "";
    refreshGateError();
    const input = document.getElementById("board-nsec-input");
    const raw = String((input && input.value) || "").trim();
    let pubkey = "";
    try {
      const decoded = window.NostrTools.nip19.decode(raw);
      if (decoded.type !== "nsec") throw new Error("not an nsec");
      pubkey = window.NostrTools.getPublicKey(decoded.data);
    } catch (_) {
      gateErrorKey = "invalid_nsec";
      refreshGateError();
      return;
    }
    if (input) input.value = ""; // don't leave the secret sitting in the DOM
    connectWithPubkey(pubkey);
  }

  function hexToBytes(hex) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  // Reuse this device's anon secret key if present, otherwise generate and store
  // one (shared with the editor). Returns { pubkey, npub, nsec } for display.
  function ensureDeviceKey() {
    const tools = window.NostrTools;
    let hex = "";
    try {
      const s = window.localStorage.getItem(ANON_SECRET_STORAGE_KEY);
      if (s && /^[0-9a-f]{64}$/i.test(s)) hex = s.toLowerCase();
    } catch (_) {}
    if (!hex) {
      hex = Array.from(tools.generateSecretKey(), (b) => b.toString(16).padStart(2, "0")).join("");
      try { window.localStorage.setItem(ANON_SECRET_STORAGE_KEY, hex); } catch (_) {}
    }
    const bytes = hexToBytes(hex);
    const pubkey = tools.getPublicKey(bytes);
    return { pubkey, npub: tools.nip19.npubEncode(pubkey), nsec: tools.nip19.nsecEncode(bytes) };
  }

  // Method 3: create (or reuse) a device key and reveal it so the user can save
  // the secret before continuing into the board.
  let pendingGeneratedPubkey = null;
  function showGenerated() {
    gateErrorKey = "";
    refreshGateError();
    let key;
    try { key = ensureDeviceKey(); } catch (_) { gateErrorKey = "connect_failed"; refreshGateError(); return; }
    pendingGeneratedPubkey = key.pubkey;
    const npubEl = document.getElementById("board-gen-npub");
    const nsecEl = document.getElementById("board-gen-nsec");
    if (npubEl) npubEl.value = key.npub;
    if (nsecEl) nsecEl.value = key.nsec;
    const nsecRow = document.getElementById("board-nsec-row");
    if (nsecRow) nsecRow.hidden = true;
    const gen = document.getElementById("board-generated");
    if (gen) gen.hidden = false;
  }

  function continueGenerated() {
    if (pendingGeneratedPubkey) connectWithPubkey(pendingGeneratedPubkey);
  }

  function toggleNsecRow() {
    gateErrorKey = "";
    refreshGateError();
    const gen = document.getElementById("board-generated");
    if (gen) gen.hidden = true;
    const row = document.getElementById("board-nsec-row");
    if (!row) return;
    row.hidden = !row.hidden;
    if (!row.hidden) {
      const input = document.getElementById("board-nsec-input");
      if (input) input.focus();
    }
  }

  function disconnect() {
    connectedPubkey = null;
    connectedNpub = null;
    try { window.localStorage.removeItem(NPUB_STORAGE_KEY); } catch (_) {}
    gateErrorKey = "";
    // Reset board state so a later reconnect rebuilds the trust filter fresh.
    allRows = [];
    rows = [];
    trustSet = new Set();
    trustSource = "viewer";
    showAll = false;
    boardLoaded = false;
    showGate();
    refreshGateError();
  }

  // Fetch the latest NIP-02 contact list (kind 3) for a pubkey and return the
  // hex pubkeys it follows (its `p` tags). Empty if there is no list.
  async function fetchFollows(pubkey) {
    if (!/^[0-9a-f]{64}$/i.test(String(pubkey || ""))) return [];
    const { events } = await queryRelays(
      DEFAULT_RELAYS, { kinds: [3], authors: [pubkey], limit: 5 }, 5000
    );
    let latest = null;
    events.forEach((e) => {
      if (e && e.kind === 3 && (!latest || (e.created_at || 0) > (latest.created_at || 0))) latest = e;
    });
    if (!latest) return [];
    return (latest.tags || [])
      .filter((x) => x[0] === "p" && /^[0-9a-f]{64}$/i.test(String(x[1] || "")))
      .map((x) => x[1].toLowerCase());
  }

  // Build the viewer's trust set: their own follows if they have any, otherwise
  // seed from the curator's follows. The viewer always trusts themselves.
  async function buildTrustSet(viewerPubkey) {
    const viewerFollows = await fetchFollows(viewerPubkey);
    let follows;
    if (viewerFollows.length) {
      follows = viewerFollows;
      trustSource = "viewer";
    } else {
      const curatorFollows = await fetchFollows(FALLBACK_CURATOR_PUBKEY);
      if (curatorFollows.length) {
        follows = curatorFollows.concat(FALLBACK_CURATOR_PUBKEY);
        trustSource = "seeded";
      } else {
        follows = [];
        trustSource = "unavailable";
      }
    }
    const set = new Set(follows.map((x) => x.toLowerCase()));
    if (viewerPubkey) set.add(String(viewerPubkey).toLowerCase());
    return set;
  }

  function updateFilterControls() {
    const note = document.getElementById("board-filter-note");
    if (note && boardLoaded) {
      let key;
      if (showAll) key = trustSource === "unavailable" ? "filter_unavailable" : "filter_all";
      else key = trustSource === "viewer" ? "filter_following" : "filter_seeded";
      note.textContent = t(key);
    }
    const chk = document.getElementById("board-show-all");
    if (chk) chk.checked = showAll;
    const lbl = document.getElementById("board-show-all-label");
    if (lbl) lbl.textContent = t("show_all_label");
  }

  // Apply the trust filter to allRows, manage the empty/filtered status, and
  // re-render. Assumes allRows is non-empty (the no-flyers case is handled in
  // loadBoard before this runs).
  function applyFilter() {
    // Blocked authors are hidden regardless of the trust/show-all mode.
    const visible = allRows.filter((r) => !blocked.has(r.pubkey));
    rows = showAll ? visible.slice() : visible.filter((r) => trustSet.has(r.pubkey));
    setStatus(rows.length || showAll ? null : "filter_empty");
    updateFilterControls();
    updateBlockedNote();
    renderBody();
  }

  async function loadBoard() {
    if (!window.NostrTools) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    const [flyerRes, trust] = await Promise.all([
      queryRelays(DEFAULT_RELAYS, { kinds: [EVENT_KIND], "#t": ["voxvera"], limit: 200 }, 6000),
      buildTrustSet(connectedPubkey)
    ]);
    allRows = parseFlyers(flyerRes.events);
    trustSet = trust;
    // With no trust data at all, filtering would hide everything — show all.
    showAll = trustSource === "unavailable";
    boardLoaded = true;
    if (!allRows.length) {
      rows = [];
      setStatus(flyerRes.anyOpen ? "empty" : "error");
      updateFilterControls();
      renderBody();
      return;
    }
    applyFilter();
  }

  // ---- Per-row management & blocklist -----------------------------------
  let blocked = loadBlocked();
  let pendingDeleteRow = null;

  function loadBlocked() {
    try {
      const raw = window.localStorage.getItem(BLOCKED_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return new Set((Array.isArray(arr) ? arr : [])
        .filter((x) => /^[0-9a-f]{64}$/i.test(x)).map((x) => x.toLowerCase()));
    } catch (_) {
      return new Set();
    }
  }
  function saveBlocked() {
    try { window.localStorage.setItem(BLOCKED_STORAGE_KEY, JSON.stringify(Array.from(blocked))); } catch (_) {}
  }
  function updateBlockedNote() {
    const note = document.getElementById("board-blocked-note");
    if (!note) return;
    note.hidden = blocked.size === 0;
    const count = document.getElementById("board-blocked-count");
    if (count) count.textContent = String(blocked.size);
    const clear = document.getElementById("board-unblock-all");
    if (clear) clear.textContent = t("unblock_all");
  }
  function blockAuthor(pubkey) {
    if (!/^[0-9a-f]{64}$/i.test(String(pubkey || ""))) return;
    blocked.add(pubkey.toLowerCase());
    saveBlocked();
    applyFilter();
  }
  function clearBlocked() {
    blocked = new Set();
    saveBlocked();
    applyFilter();
  }

  function nowSec() { return Math.floor(Date.now() / 1000); }

  // Sign as the connected author: a device key we hold, or the NIP-07 extension.
  // Returns sign(unsigned)->event, or null when we can't sign (a pasted-nsec
  // connection whose secret was discarded — delete from the editor instead).
  async function getBoardSigner() {
    const tools = window.NostrTools;
    try {
      const hex = window.localStorage.getItem(ANON_SECRET_STORAGE_KEY);
      if (hex && /^[0-9a-f]{64}$/i.test(hex)) {
        const bytes = hexToBytes(hex);
        if (String(tools.getPublicKey(bytes)).toLowerCase() === connectedPubkey) {
          return (unsigned) => tools.finalizeEvent(unsigned, bytes);
        }
      }
    } catch (_) {}
    if (window.nostr && typeof window.nostr.signEvent === "function" && typeof window.nostr.getPublicKey === "function") {
      try {
        const pk = await window.nostr.getPublicKey();
        if (String(pk).toLowerCase() === connectedPubkey) {
          return (unsigned) => window.nostr.signEvent({ ...unsigned, pubkey: connectedPubkey });
        }
      } catch (_) {}
    }
    return null;
  }

  function buildTombstone(row, payload) {
    const lang = (payload && payload.lang) || row.lang || "en";
    const folderName = (row.dtag || "").replace(/^voxvera:/, "") || "voxvera";
    return {
      kind: EVENT_KIND,
      created_at: nowSec(),
      tags: [["d", row.dtag], ["t", "voxvera"], ["t", "flyer"], ["deleted", ""], ["language", lang]],
      content: JSON.stringify({ type: "voxvera_flyer", version: 1, deleted: true, folder_name: folderName, lang })
    };
  }
  function buildDeletion(row) {
    const tags = [["a", `${EVENT_KIND}:${connectedPubkey}:${row.dtag}`], ["k", String(EVENT_KIND)]];
    if (/^[0-9a-f]{64}$/i.test(row.id)) tags.push(["e", row.id]);
    return { kind: 5, created_at: nowSec(), tags, content: "" };
  }

  // Send an already-signed event to all default relays.
  function publishRaw(event) {
    return Promise.all(DEFAULT_RELAYS.map((relay) => new Promise((res) => {
      let done = false;
      let ws;
      const end = () => { if (done) return; done = true; try { ws.close(); } catch (_) {} res(); };
      try { ws = new WebSocket(relay); } catch (_) { return res(); }
      ws.onopen = () => { try { ws.send(JSON.stringify(["EVENT", event])); } catch (_) {} };
      ws.onmessage = () => end();
      ws.onerror = end;
      setTimeout(end, 5000);
    })));
  }

  function findRowById(id) {
    return allRows.find((r) => r.id === id) || null;
  }

  function flashStatus(key) {
    setStatus(key);
    setTimeout(() => { if (statusKey === key) setStatus(rows.length ? null : "empty"); }, 2500);
  }

  async function rebroadcastRow(id) {
    const row = findRowById(id);
    if (!row || !row.raw) return;
    await publishRaw(row.raw);
    flashStatus("rebroadcast_done");
  }

  function openDeleteModal(row) {
    pendingDeleteRow = row;
    const modal = document.getElementById("board-delete-modal");
    if (modal) modal.hidden = false;
  }
  function closeDeleteModal() {
    pendingDeleteRow = null;
    const modal = document.getElementById("board-delete-modal");
    if (modal) modal.hidden = true;
  }
  async function confirmDelete() {
    const row = pendingDeleteRow;
    closeDeleteModal();
    if (!row) return;
    const signer = await getBoardSigner();
    if (!signer) { setStatus("sign_unavailable"); return; }
    let payload;
    try { payload = JSON.parse(row.raw.content); } catch (_) { payload = {}; }
    await publishRaw(await signer(buildTombstone(row, payload)));
    await publishRaw(await signer(buildDeletion(row)));
    allRows = allRows.filter((r) => r.id !== row.id);
    applyFilter();
    flashStatus("deleted_done");
  }

  // One delegated click handler for all per-row action buttons.
  function handleRowAction(event) {
    const btn = event.target.closest("[data-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-act");
    if (act === "block") {
      blockAuthor(btn.getAttribute("data-pubkey"));
    } else if (act === "rebroadcast") {
      rebroadcastRow(btn.getAttribute("data-id")).catch(() => {});
    } else if (act === "delete") {
      const row = findRowById(btn.getAttribute("data-id"));
      if (row) openDeleteModal(row);
    }
  }

  async function init() {
    populateLangSelect();
    const sel = document.getElementById("board-lang");
    if (sel) sel.addEventListener("change", () => applyLang(sel.value || FALLBACK_LANG));
    const connectBtn = document.getElementById("board-connect");
    if (connectBtn) connectBtn.addEventListener("click", connectExtension);
    const nsecToggle = document.getElementById("board-connect-nsec-toggle");
    if (nsecToggle) nsecToggle.addEventListener("click", toggleNsecRow);
    const nsecSubmit = document.getElementById("board-nsec-submit");
    if (nsecSubmit) nsecSubmit.addEventListener("click", connectNsec);
    const nsecInput = document.getElementById("board-nsec-input");
    if (nsecInput) nsecInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); connectNsec(); }
    });
    const generateBtn = document.getElementById("board-generate");
    if (generateBtn) generateBtn.addEventListener("click", showGenerated);
    const genContinue = document.getElementById("board-gen-continue");
    if (genContinue) genContinue.addEventListener("click", continueGenerated);
    const genCopy = document.getElementById("board-gen-copy");
    if (genCopy) genCopy.addEventListener("click", async () => {
      const nsecEl = document.getElementById("board-gen-nsec");
      if (!nsecEl) return;
      try {
        await navigator.clipboard.writeText(nsecEl.value);
        genCopy.textContent = t("copied");
        setTimeout(() => { genCopy.textContent = t("copy"); }, 1500);
      } catch (_) {
        nsecEl.type = "text";
        nsecEl.select();
      }
    });
    const disconnectBtn = document.getElementById("board-disconnect");
    if (disconnectBtn) disconnectBtn.addEventListener("click", disconnect);
    const showAllChk = document.getElementById("board-show-all");
    if (showAllChk) showAllChk.addEventListener("change", () => {
      showAll = showAllChk.checked;
      if (allRows.length) applyFilter();
      else updateFilterControls();
    });

    // Delegated copy handler for the per-row "copy event ID" buttons (rows are
    // re-rendered on sort, so a single listener on the tbody is simplest).
    const rowsBody = document.getElementById("board-rows");
    if (rowsBody) rowsBody.addEventListener("click", async (event) => {
      // Per-row management actions (edit links handle themselves).
      if (event.target.closest("[data-act]")) { handleRowAction(event); return; }
      const btn = event.target.closest(".board-copy");
      if (!btn) return;
      const value = btn.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(value);
        btn.textContent = t("copied");
        setTimeout(() => { btn.textContent = t("copy"); }, 1200);
      } catch (_) {
        // Clipboard blocked (e.g. insecure context): select the id text instead.
        const id = btn.previousElementSibling;
        if (id && window.getSelection) {
          const range = document.createRange();
          range.selectNodeContents(id);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    });

    const delCancel = document.getElementById("board-delete-cancel");
    if (delCancel) delCancel.addEventListener("click", closeDeleteModal);
    const delConfirm = document.getElementById("board-delete-confirm");
    if (delConfirm) delConfirm.addEventListener("click", () => { confirmDelete().catch(() => {}); });
    const delOverlay = document.getElementById("board-delete-modal");
    if (delOverlay) delOverlay.addEventListener("click", (e) => { if (e.target === delOverlay) closeDeleteModal(); });
    const unblock = document.getElementById("board-unblock-all");
    if (unblock) unblock.addEventListener("click", clearBlocked);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDeleteModal(); });

    applyLang(currentLang);
    showGate();

    // The board only needs the viewer's pubkey, so any prior connection (any
    // method) is restored directly from the remembered pubkey — no prompt, no
    // re-deriving from a secret. The visitor picks a method otherwise.
    const storedPubkey = getStoredPubkey();
    if (storedPubkey) {
      connectWithPubkey(storedPubkey);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
