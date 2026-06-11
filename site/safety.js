(function () {
  "use strict";

  // Standalone, fully static "Safety & privacy" page. It shares the locale meta
  // (direction, language names) from locales.js but keeps its own strings here,
  // localized across all 14 languages. Sentences are kept short and plain on
  // purpose: this is security-critical content, so it must translate cleanly.

  const FALLBACK_LANG = "en";
  // Same key the editor and board use, so a language choice carries across pages.
  const UI_LANG_STORAGE_KEY = "voxvera_nostr_lang";
  const LOCALES = window.VoxVeraLocales || {};

  const SAFETY_UI = {
    en: {
      title: "Safety & privacy",
      intro: "VoxVera helps you publish flyers that are hard to censor. On its own it does not keep you anonymous. Please read what it does and does not protect before you rely on it.",
      protects_h: "What VoxVera protects",
      protects: [
        "Flyers are stored across many independent Nostr relays, not on one website, so no single host can quietly remove them.",
        "Writing and printing a flyer happens in your browser. Nothing is sent anywhere until you choose to publish.",
        "You can publish anonymously. By default VoxVera signs with a throwaway key created on your device, not your real name.",
        "Your secret key can stay out of this web page entirely — use a browser extension (NIP-07) or a remote signer app (NIP-46)."
      ],
      exposes_h: "What it does not protect",
      exposes: [
        "When you publish a flyer or open the bulletin board, the relays can see your IP address. Use Tor or a VPN if your location must stay private.",
        "The anonymous key is stored unencrypted in your browser. Anyone who can use your device can read it.",
        "An optional PIN only slows down casual snooping. It will not stop someone who copies your stored data and attacks it offline.",
        "Anything you publish is public and effectively permanent. Assume it can never be fully deleted, even after a delete request.",
        "Pasting a private key (nsec) into any website is risky. Prefer a browser extension or a remote signer instead.",
        "Reports you send are public and signed by your key. Blocking, by contrast, stays private on your device.",
        "VoxVera has no accounts and does not track you, but the website's host and the relays still see your requests."
      ],
      tips_h: "Staying safer",
      tips: [
        "If your location must stay private, use Tor Browser or a trusted VPN whenever you publish or browse the board.",
        "Treat the anonymous key as disposable. Generate a fresh one when you want a clean separation.",
        "Do not sign sensitive flyers with a key that is already linked to your real identity.",
        "Keep secret keys in a signer app or extension — never paste them into a web page on a shared or untrusted device.",
        "Remember that a printed flyer is permanent. Once it is distributed, you cannot edit or recall it."
      ],
      closing: "VoxVera is a tool, not a guarantee. When your safety depends on it, combine it with Tor or a VPN and careful habits.",
      back: "← Back to VoxVera",
      link: "Safety & privacy"
    },
    es: {
      title: "Seguridad y privacidad",
      intro: "VoxVera te ayuda a publicar carteles difíciles de censurar. Por sí solo no te mantiene anónimo. Lee qué protege y qué no antes de confiar en él.",
      protects_h: "Qué protege VoxVera",
      protects: [
        "Los carteles se guardan en muchos relés Nostr independientes, no en un solo sitio web, así que ningún servidor puede eliminarlos en silencio.",
        "Escribir e imprimir un cartel ocurre en tu navegador. No se envía nada hasta que decides publicar.",
        "Puedes publicar de forma anónima. Por defecto VoxVera firma con una clave desechable creada en tu dispositivo, no con tu nombre real.",
        "Tu clave secreta puede quedar fuera de esta página por completo: usa una extensión de navegador (NIP-07) o una app de firma remota (NIP-46)."
      ],
      exposes_h: "Qué no protege",
      exposes: [
        "Cuando publicas un cartel o abres el tablón, los relés pueden ver tu dirección IP. Usa Tor o una VPN si tu ubicación debe ser privada.",
        "La clave anónima se guarda sin cifrar en tu navegador. Cualquiera que pueda usar tu dispositivo puede leerla.",
        "Un PIN opcional solo frena el fisgoneo casual. No detendrá a quien copie tus datos guardados y los ataque sin conexión.",
        "Todo lo que publicas es público y prácticamente permanente. Da por hecho que nunca podrá borrarse del todo, ni con una solicitud de borrado.",
        "Pegar una clave privada (nsec) en cualquier sitio web es arriesgado. Mejor usa una extensión de navegador o un firmante remoto.",
        "Las denuncias que envías son públicas y firmadas con tu clave. El bloqueo, en cambio, queda privado en tu dispositivo.",
        "VoxVera no tiene cuentas ni te rastrea, pero el alojamiento del sitio y los relés siguen viendo tus solicitudes."
      ],
      tips_h: "Mantente más seguro",
      tips: [
        "Si tu ubicación debe ser privada, usa el navegador Tor o una VPN de confianza siempre que publiques o navegues el tablón.",
        "Trata la clave anónima como desechable. Genera una nueva cuando quieras una separación limpia.",
        "No firmes carteles delicados con una clave que ya esté vinculada a tu identidad real.",
        "Guarda las claves secretas en una app de firma o extensión; nunca las pegues en una página web en un dispositivo compartido o no confiable.",
        "Recuerda que un cartel impreso es permanente. Una vez distribuido, no puedes editarlo ni retirarlo."
      ],
      closing: "VoxVera es una herramienta, no una garantía. Cuando tu seguridad dependa de ella, combínala con Tor o una VPN y buenos hábitos.",
      back: "← Volver a VoxVera",
      link: "Seguridad y privacidad"
    },
    de: {
      title: "Sicherheit & Privatsphäre",
      intro: "VoxVera hilft dir, Flyer zu veröffentlichen, die schwer zu zensieren sind. Anonym macht es dich allein nicht. Lies bitte, was es schützt und was nicht, bevor du dich darauf verlässt.",
      protects_h: "Was VoxVera schützt",
      protects: [
        "Flyer liegen auf vielen unabhängigen Nostr-Relays, nicht auf einer einzigen Website, sodass kein einzelner Anbieter sie heimlich entfernen kann.",
        "Das Schreiben und Drucken eines Flyers passiert in deinem Browser. Es wird nichts gesendet, bis du dich zum Veröffentlichen entscheidest.",
        "Du kannst anonym veröffentlichen. Standardmäßig signiert VoxVera mit einem Wegwerf-Schlüssel auf deinem Gerät, nicht mit deinem echten Namen.",
        "Dein geheimer Schlüssel kann ganz außerhalb dieser Seite bleiben — nutze eine Browser-Erweiterung (NIP-07) oder eine Remote-Signier-App (NIP-46)."
      ],
      exposes_h: "Was es nicht schützt",
      exposes: [
        "Wenn du einen Flyer veröffentlichst oder das Schwarze Brett öffnest, können die Relays deine IP-Adresse sehen. Nutze Tor oder ein VPN, wenn dein Standort privat bleiben muss.",
        "Der anonyme Schlüssel wird unverschlüsselt in deinem Browser gespeichert. Jeder mit Zugriff auf dein Gerät kann ihn lesen.",
        "Eine optionale PIN bremst nur beiläufiges Schnüffeln. Sie stoppt niemanden, der deine gespeicherten Daten kopiert und offline angreift.",
        "Alles, was du veröffentlichst, ist öffentlich und praktisch dauerhaft. Geh davon aus, dass es nie vollständig gelöscht werden kann, auch nicht nach einer Löschanfrage.",
        "Einen privaten Schlüssel (nsec) in eine Website einzufügen ist riskant. Nutze lieber eine Browser-Erweiterung oder einen Remote-Signierer.",
        "Meldungen, die du sendest, sind öffentlich und mit deinem Schlüssel signiert. Das Blockieren bleibt dagegen privat auf deinem Gerät.",
        "VoxVera hat keine Konten und verfolgt dich nicht, aber der Hoster der Website und die Relays sehen deine Anfragen weiterhin."
      ],
      tips_h: "Sicherer bleiben",
      tips: [
        "Wenn dein Standort privat bleiben muss, nutze den Tor-Browser oder ein vertrauenswürdiges VPN, wann immer du veröffentlichst oder das Brett ansiehst.",
        "Behandle den anonymen Schlüssel als Wegwerfartikel. Erzeuge einen neuen, wenn du eine saubere Trennung willst.",
        "Signiere heikle Flyer nicht mit einem Schlüssel, der bereits mit deiner echten Identität verknüpft ist.",
        "Bewahre geheime Schlüssel in einer Signier-App oder Erweiterung auf — füge sie nie auf einem geteilten oder nicht vertrauenswürdigen Gerät in eine Webseite ein.",
        "Denk daran, dass ein gedruckter Flyer dauerhaft ist. Einmal verteilt, kannst du ihn weder bearbeiten noch zurückrufen."
      ],
      closing: "VoxVera ist ein Werkzeug, keine Garantie. Wenn deine Sicherheit davon abhängt, kombiniere es mit Tor oder einem VPN und umsichtigem Verhalten.",
      back: "← Zurück zu VoxVera",
      link: "Sicherheit & Privatsphäre"
    },
    fr: {
      title: "Sécurité et confidentialité",
      intro: "VoxVera vous aide à publier des tracts difficiles à censurer. À lui seul, il ne vous rend pas anonyme. Lisez ce qu'il protège et ce qu'il ne protège pas avant de vous y fier.",
      protects_h: "Ce que VoxVera protège",
      protects: [
        "Les tracts sont stockés sur de nombreux relais Nostr indépendants, pas sur un seul site web, donc aucun hébergeur ne peut les supprimer discrètement.",
        "La rédaction et l'impression d'un tract se font dans votre navigateur. Rien n'est envoyé tant que vous ne choisissez pas de publier.",
        "Vous pouvez publier de façon anonyme. Par défaut, VoxVera signe avec une clé jetable créée sur votre appareil, pas avec votre vrai nom.",
        "Votre clé secrète peut rester entièrement hors de cette page : utilisez une extension de navigateur (NIP-07) ou une application de signature distante (NIP-46)."
      ],
      exposes_h: "Ce qu'il ne protège pas",
      exposes: [
        "Quand vous publiez un tract ou ouvrez le tableau d'affichage, les relais peuvent voir votre adresse IP. Utilisez Tor ou un VPN si votre localisation doit rester privée.",
        "La clé anonyme est stockée non chiffrée dans votre navigateur. Toute personne ayant accès à votre appareil peut la lire.",
        "Un code PIN facultatif ne fait que ralentir une curiosité occasionnelle. Il n'arrêtera pas quelqu'un qui copie vos données et les attaque hors ligne.",
        "Tout ce que vous publiez est public et de fait permanent. Considérez que cela ne pourra jamais être totalement supprimé, même après une demande de suppression.",
        "Coller une clé privée (nsec) dans un site web est risqué. Préférez une extension de navigateur ou un signataire distant.",
        "Les signalements que vous envoyez sont publics et signés par votre clé. Le blocage, lui, reste privé sur votre appareil.",
        "VoxVera n'a pas de comptes et ne vous piste pas, mais l'hébergeur du site et les relais voient toujours vos requêtes."
      ],
      tips_h: "Rester plus en sécurité",
      tips: [
        "Si votre localisation doit rester privée, utilisez le navigateur Tor ou un VPN de confiance chaque fois que vous publiez ou consultez le tableau.",
        "Considérez la clé anonyme comme jetable. Générez-en une nouvelle quand vous voulez une séparation nette.",
        "Ne signez pas de tracts sensibles avec une clé déjà liée à votre identité réelle.",
        "Gardez les clés secrètes dans une application de signature ou une extension — ne les collez jamais dans une page web sur un appareil partagé ou non fiable.",
        "N'oubliez pas qu'un tract imprimé est permanent. Une fois distribué, vous ne pouvez ni le modifier ni le rappeler."
      ],
      closing: "VoxVera est un outil, pas une garantie. Quand votre sécurité en dépend, associez-le à Tor ou un VPN et à de bonnes habitudes.",
      back: "← Retour à VoxVera",
      link: "Sécurité et confidentialité"
    },
    ru: {
      title: "Безопасность и конфиденциальность",
      intro: "VoxVera помогает публиковать листовки, которые трудно подвергнуть цензуре. Сам по себе он не обеспечивает анонимность. Прочитайте, что он защищает, а что нет, прежде чем на него полагаться.",
      protects_h: "Что защищает VoxVera",
      protects: [
        "Листовки хранятся на множестве независимых реле Nostr, а не на одном сайте, поэтому ни один хостер не может тихо их удалить.",
        "Создание и печать листовки происходят в вашем браузере. Ничего не отправляется, пока вы не решите опубликовать.",
        "Можно публиковать анонимно. По умолчанию VoxVera подписывает одноразовым ключом, созданным на вашем устройстве, а не вашим настоящим именем.",
        "Ваш секретный ключ может вообще не попадать на эту страницу — используйте расширение браузера (NIP-07) или приложение удалённой подписи (NIP-46)."
      ],
      exposes_h: "Что он не защищает",
      exposes: [
        "Когда вы публикуете листовку или открываете доску, реле видят ваш IP-адрес. Используйте Tor или VPN, если ваше местоположение должно оставаться тайным.",
        "Анонимный ключ хранится в браузере без шифрования. Любой, кто имеет доступ к вашему устройству, может его прочитать.",
        "Необязательный PIN лишь замедляет случайное любопытство. Он не остановит того, кто скопирует ваши данные и будет взламывать их офлайн.",
        "Всё, что вы публикуете, публично и фактически вечно. Считайте, что это нельзя полностью удалить, даже после запроса на удаление.",
        "Вставлять приватный ключ (nsec) на любой сайт рискованно. Лучше используйте расширение браузера или удалённую подпись.",
        "Жалобы, которые вы отправляете, публичны и подписаны вашим ключом. Блокировка же остаётся приватной на вашем устройстве.",
        "У VoxVera нет аккаунтов и он вас не отслеживает, но хостинг сайта и реле всё равно видят ваши запросы."
      ],
      tips_h: "Как быть безопаснее",
      tips: [
        "Если ваше местоположение должно оставаться тайным, используйте браузер Tor или надёжный VPN при публикации и просмотре доски.",
        "Относитесь к анонимному ключу как к одноразовому. Создавайте новый, когда нужно чёткое разделение.",
        "Не подписывайте чувствительные листовки ключом, который уже связан с вашей настоящей личностью.",
        "Храните секретные ключи в приложении подписи или расширении — никогда не вставляйте их на веб-странице на чужом или ненадёжном устройстве.",
        "Помните, что напечатанная листовка вечна. После распространения её нельзя ни изменить, ни отозвать."
      ],
      closing: "VoxVera — это инструмент, а не гарантия. Когда от него зависит ваша безопасность, сочетайте его с Tor или VPN и осторожными привычками.",
      back: "← Назад к VoxVera",
      link: "Безопасность и конфиденциальность"
    },
    he: {
      title: "בטיחות ופרטיות",
      intro: "VoxVera עוזר לך לפרסם פליירים שקשה לצנזר. לבדו הוא אינו שומר עליך אנונימי. אנא קרא מה הוא מגן ומה לא לפני שאתה מסתמך עליו.",
      protects_h: "על מה VoxVera מגן",
      protects: [
        "הפליירים נשמרים בריבוי ממסרי Nostr עצמאיים, לא באתר אחד, כך שאף מארח בודד אינו יכול להסיר אותם בשקט.",
        "כתיבת הפלייר והדפסתו מתרחשות בדפדפן שלך. שום דבר אינו נשלח עד שתבחר לפרסם.",
        "אפשר לפרסם באופן אנונימי. כברירת מחדל VoxVera חותם במפתח חד-פעמי שנוצר במכשירך, לא בשמך האמיתי.",
        "המפתח הסודי שלך יכול להישאר מחוץ לדף הזה לחלוטין — השתמש בתוסף דפדפן (NIP-07) או באפליקציית חתימה מרוחקת (NIP-46)."
      ],
      exposes_h: "על מה הוא אינו מגן",
      exposes: [
        "כאשר אתה מפרסם פלייר או פותח את לוח המודעות, הממסרים יכולים לראות את כתובת ה-IP שלך. השתמש ב-Tor או ב-VPN אם המיקום שלך חייב להישאר פרטי.",
        "המפתח האנונימי נשמר ללא הצפנה בדפדפן שלך. כל מי שיכול להשתמש במכשירך יכול לקרוא אותו.",
        "קוד PIN אופציונלי רק מאט הצצה מזדמנת. הוא לא יעצור מישהו שמעתיק את הנתונים השמורים שלך ותוקף אותם במצב לא מקוון.",
        "כל מה שאתה מפרסם הוא ציבורי וקבוע למעשה. הנח שלעולם לא ניתן יהיה למחוק אותו לחלוטין, גם לאחר בקשת מחיקה.",
        "הדבקת מפתח פרטי (nsec) בכל אתר היא מסוכנת. עדיף תוסף דפדפן או חותם מרוחק.",
        "דיווחים שאתה שולח הם ציבוריים וחתומים במפתח שלך. חסימה, לעומת זאת, נשארת פרטית במכשירך.",
        "ל-VoxVera אין חשבונות והוא אינו עוקב אחריך, אך מארח האתר והממסרים עדיין רואים את הבקשות שלך."
      ],
      tips_h: "להישאר בטוח יותר",
      tips: [
        "אם המיקום שלך חייב להישאר פרטי, השתמש בדפדפן Tor או ב-VPN מהימן בכל פעם שאתה מפרסם או גולש בלוח.",
        "התייחס למפתח האנונימי כאל חד-פעמי. צור חדש כאשר אתה רוצה הפרדה נקייה.",
        "אל תחתום על פליירים רגישים במפתח שכבר מקושר לזהותך האמיתית.",
        "שמור מפתחות סודיים באפליקציית חתימה או בתוסף — לעולם אל תדביק אותם בדף אינטרנט במכשיר משותף או לא מהימן.",
        "זכור שפלייר מודפס הוא קבוע. לאחר שהופץ, אינך יכול לערוך אותו או להחזירו."
      ],
      closing: "VoxVera הוא כלי, לא ערובה. כשבטיחותך תלויה בו, שלב אותו עם Tor או VPN והרגלים זהירים.",
      back: "← חזרה ל-VoxVera",
      link: "בטיחות ופרטיות"
    },
    ar: {
      title: "الأمان والخصوصية",
      intro: "يساعدك VoxVera على نشر ملصقات يصعب فرض الرقابة عليها. لكنه وحده لا يبقيك مجهولاً. يُرجى قراءة ما يحميه وما لا يحميه قبل الاعتماد عليه.",
      protects_h: "ما الذي يحميه VoxVera",
      protects: [
        "تُخزَّن الملصقات على العديد من مرحلات Nostr المستقلة، لا على موقع واحد، فلا يمكن لأي مضيف منفرد إزالتها بهدوء.",
        "تتم كتابة الملصق وطباعته في متصفحك. لا يُرسَل أي شيء حتى تختار النشر.",
        "يمكنك النشر بشكل مجهول. افتراضياً يوقّع VoxVera بمفتاح يُستخدم لمرة واحدة يُنشأ على جهازك، لا باسمك الحقيقي.",
        "يمكن أن يبقى مفتاحك السري خارج هذه الصفحة تماماً — استخدم إضافة متصفح (NIP-07) أو تطبيق توقيع عن بُعد (NIP-46)."
      ],
      exposes_h: "ما الذي لا يحميه",
      exposes: [
        "عند نشر ملصق أو فتح لوحة الإعلانات، يمكن للمرحلات رؤية عنوان IP الخاص بك. استخدم Tor أو VPN إذا كان يجب أن يبقى موقعك خاصاً.",
        "يُخزَّن المفتاح المجهول دون تشفير في متصفحك. يمكن لأي شخص يستطيع استخدام جهازك قراءته.",
        "رمز PIN اختياري يبطئ فقط التطفل العابر. لن يوقف من ينسخ بياناتك المخزَّنة ويهاجمها دون اتصال.",
        "كل ما تنشره عام ودائم فعلياً. افترض أنه لا يمكن حذفه نهائياً أبداً، حتى بعد طلب الحذف.",
        "لصق مفتاح خاص (nsec) في أي موقع أمر خطر. فضّل إضافة متصفح أو موقّعاً عن بُعد.",
        "البلاغات التي ترسلها عامة وموقَّعة بمفتاحك. أما الحظر فيبقى خاصاً على جهازك.",
        "ليس لدى VoxVera حسابات ولا يتتبعك، لكن مضيف الموقع والمرحلات ما زالوا يرون طلباتك."
      ],
      tips_h: "للبقاء أكثر أماناً",
      tips: [
        "إذا كان يجب أن يبقى موقعك خاصاً، استخدم متصفح Tor أو VPN موثوقاً كلما نشرت أو تصفحت اللوحة.",
        "تعامل مع المفتاح المجهول كأنه للاستخدام مرة واحدة. أنشئ مفتاحاً جديداً عندما تريد فصلاً نظيفاً.",
        "لا توقّع الملصقات الحساسة بمفتاح مرتبط بالفعل بهويتك الحقيقية.",
        "احتفظ بالمفاتيح السرية في تطبيق توقيع أو إضافة — ولا تلصقها أبداً في صفحة ويب على جهاز مشترك أو غير موثوق.",
        "تذكّر أن الملصق المطبوع دائم. بمجرد توزيعه، لا يمكنك تعديله أو سحبه."
      ],
      closing: "VoxVera أداة وليس ضماناً. عندما تعتمد سلامتك عليه، اجمعه مع Tor أو VPN وعادات حذرة.",
      back: "← العودة إلى VoxVera",
      link: "الأمان والخصوصية"
    },
    ja: {
      title: "安全とプライバシー",
      intro: "VoxVera は検閲されにくいちらしの公開を助けます。ただしそれだけで匿名性を保証するものではありません。頼る前に、何を守り何を守らないかをお読みください。",
      protects_h: "VoxVera が守るもの",
      protects: [
        "ちらしは一つのウェブサイトではなく、多数の独立した Nostr リレーに保存されるため、単一のホストがひそかに削除することはできません。",
        "ちらしの作成と印刷はブラウザー内で行われます。あなたが公開を選ぶまで、何も送信されません。",
        "匿名で公開できます。既定では VoxVera は本名ではなく、端末上で作られた使い捨ての鍵で署名します。",
        "秘密鍵はこのページの外に置いたままにできます — ブラウザー拡張機能（NIP-07）またはリモート署名アプリ（NIP-46）を使ってください。"
      ],
      exposes_h: "守らないもの",
      exposes: [
        "ちらしを公開したり掲示板を開いたりすると、リレーはあなたの IP アドレスを見られます。所在地を秘密にする必要があるなら Tor か VPN を使ってください。",
        "匿名の鍵は暗号化されずにブラウザーに保存されます。あなたの端末を使える人なら誰でも読めます。",
        "任意の PIN は軽い覗き見を遅らせるだけです。保存データをコピーしてオフラインで攻撃する相手は止められません。",
        "公開したものはすべて公開され、事実上恒久的です。削除要求の後でも完全には消せないものと考えてください。",
        "秘密鍵（nsec）をどのサイトにも貼り付けるのは危険です。ブラウザー拡張機能かリモート署名を使ってください。",
        "あなたが送る報告は公開され、あなたの鍵で署名されます。一方、ブロックは端末内に留まり非公開です。",
        "VoxVera にはアカウントがなく追跡もしませんが、サイトのホストとリレーは依然としてあなたのリクエストを見られます。"
      ],
      tips_h: "より安全でいるために",
      tips: [
        "所在地を秘密にする必要があるなら、公開や掲示板の閲覧のたびに Tor ブラウザーか信頼できる VPN を使ってください。",
        "匿名の鍵は使い捨てとして扱ってください。きれいに切り離したいときは新しい鍵を作りましょう。",
        "すでに本人の身元に結びついた鍵で、機微なちらしに署名しないでください。",
        "秘密鍵は署名アプリか拡張機能に保管し、共有または信頼できない端末のウェブページには決して貼り付けないでください。",
        "印刷したちらしは恒久的だと覚えておいてください。配布した後は編集も回収もできません。"
      ],
      closing: "VoxVera は道具であって保証ではありません。安全がそれに懸かるときは、Tor か VPN と慎重な習慣を併用してください。",
      back: "← VoxVera に戻る",
      link: "安全とプライバシー"
    },
    hi: {
      title: "सुरक्षा और निजता",
      intro: "VoxVera आपको ऐसे फ़्लायर प्रकाशित करने में मदद करता है जिन्हें सेंसर करना कठिन है। यह अकेले आपको गुमनाम नहीं रखता। भरोसा करने से पहले पढ़ें कि यह क्या बचाता है और क्या नहीं।",
      protects_h: "VoxVera क्या बचाता है",
      protects: [
        "फ़्लायर एक वेबसाइट पर नहीं, बल्कि कई स्वतंत्र Nostr रिले पर संग्रहीत होते हैं, इसलिए कोई एक होस्ट उन्हें चुपचाप नहीं हटा सकता।",
        "फ़्लायर लिखना और छापना आपके ब्राउज़र में होता है। जब तक आप प्रकाशित करना न चुनें, कुछ भी नहीं भेजा जाता।",
        "आप गुमनाम रूप से प्रकाशित कर सकते हैं। डिफ़ॉल्ट रूप से VoxVera आपके असली नाम से नहीं, बल्कि आपके डिवाइस पर बनी एक उपयोग-और-फेंक कुंजी से हस्ताक्षर करता है।",
        "आपकी गुप्त कुंजी पूरी तरह इस पेज से बाहर रह सकती है — ब्राउज़र एक्सटेंशन (NIP-07) या रिमोट साइनर ऐप (NIP-46) का उपयोग करें।"
      ],
      exposes_h: "यह क्या नहीं बचाता",
      exposes: [
        "जब आप फ़्लायर प्रकाशित करते हैं या बुलेटिन बोर्ड खोलते हैं, तो रिले आपका IP पता देख सकते हैं। यदि आपका स्थान निजी रहना चाहिए तो Tor या VPN उपयोग करें।",
        "गुमनाम कुंजी आपके ब्राउज़र में बिना एन्क्रिप्शन के संग्रहीत होती है। जो भी आपके डिवाइस का उपयोग कर सकता है, वह इसे पढ़ सकता है।",
        "एक वैकल्पिक PIN केवल आम ताक-झाँक को धीमा करता है। यह उसे नहीं रोकेगा जो आपके संग्रहीत डेटा की नकल करके उसे ऑफ़लाइन तोड़ता है।",
        "आप जो भी प्रकाशित करते हैं वह सार्वजनिक और व्यावहारिक रूप से स्थायी है। मान लें कि इसे कभी पूरी तरह नहीं हटाया जा सकता, हटाने के अनुरोध के बाद भी नहीं।",
        "किसी भी वेबसाइट में निजी कुंजी (nsec) चिपकाना जोखिम भरा है। इसके बजाय ब्राउज़र एक्सटेंशन या रिमोट साइनर को प्राथमिकता दें।",
        "आपके भेजे गए रिपोर्ट सार्वजनिक होते हैं और आपकी कुंजी से हस्ताक्षरित होते हैं। इसके विपरीत, ब्लॉक करना आपके डिवाइस पर निजी रहता है।",
        "VoxVera के कोई खाते नहीं हैं और यह आपको ट्रैक नहीं करता, पर वेबसाइट का होस्ट और रिले फिर भी आपके अनुरोध देखते हैं।"
      ],
      tips_h: "अधिक सुरक्षित रहना",
      tips: [
        "यदि आपका स्थान निजी रहना चाहिए, तो जब भी प्रकाशित करें या बोर्ड देखें, Tor ब्राउज़र या भरोसेमंद VPN उपयोग करें।",
        "गुमनाम कुंजी को उपयोग-और-फेंक मानें। जब साफ़ अलगाव चाहिए तब नई कुंजी बनाएँ।",
        "संवेदनशील फ़्लायर को ऐसी कुंजी से हस्ताक्षरित न करें जो पहले से आपकी असली पहचान से जुड़ी हो।",
        "गुप्त कुंजियाँ साइनर ऐप या एक्सटेंशन में रखें — साझा या अविश्वसनीय डिवाइस पर किसी वेब पेज में कभी न चिपकाएँ।",
        "याद रखें कि छपा हुआ फ़्लायर स्थायी है। एक बार बँट जाने पर आप उसे न संपादित कर सकते हैं न वापस ले सकते हैं।"
      ],
      closing: "VoxVera एक उपकरण है, गारंटी नहीं। जब आपकी सुरक्षा इस पर निर्भर हो, तो इसे Tor या VPN और सावधान आदतों के साथ मिलाएँ।",
      back: "← VoxVera पर वापस",
      link: "सुरक्षा और निजता"
    },
    pt: {
      title: "Segurança e privacidade",
      intro: "O VoxVera ajuda você a publicar panfletos difíceis de censurar. Sozinho, ele não mantém você anônimo. Leia o que ele protege e o que não protege antes de confiar nele.",
      protects_h: "O que o VoxVera protege",
      protects: [
        "Os panfletos ficam guardados em muitos relés Nostr independentes, não em um único site, então nenhum host sozinho pode removê-los em silêncio.",
        "Escrever e imprimir um panfleto acontece no seu navegador. Nada é enviado até você escolher publicar.",
        "Você pode publicar de forma anônima. Por padrão o VoxVera assina com uma chave descartável criada no seu dispositivo, não com seu nome real.",
        "Sua chave secreta pode ficar totalmente fora desta página — use uma extensão de navegador (NIP-07) ou um app de assinatura remota (NIP-46)."
      ],
      exposes_h: "O que ele não protege",
      exposes: [
        "Quando você publica um panfleto ou abre o quadro de avisos, os relés podem ver seu endereço IP. Use Tor ou uma VPN se sua localização precisa permanecer privada.",
        "A chave anônima é guardada sem criptografia no seu navegador. Qualquer um que possa usar seu dispositivo pode lê-la.",
        "Um PIN opcional só atrasa a bisbilhotice casual. Não vai deter alguém que copie seus dados guardados e os ataque offline.",
        "Tudo o que você publica é público e praticamente permanente. Suponha que nunca poderá ser totalmente apagado, mesmo após um pedido de exclusão.",
        "Colar uma chave privada (nsec) em qualquer site é arriscado. Prefira uma extensão de navegador ou um assinador remoto.",
        "As denúncias que você envia são públicas e assinadas pela sua chave. O bloqueio, por outro lado, fica privado no seu dispositivo.",
        "O VoxVera não tem contas e não rastreia você, mas o host do site e os relés ainda veem suas requisições."
      ],
      tips_h: "Ficar mais seguro",
      tips: [
        "Se sua localização precisa permanecer privada, use o navegador Tor ou uma VPN confiável sempre que publicar ou navegar pelo quadro.",
        "Trate a chave anônima como descartável. Gere uma nova quando quiser uma separação limpa.",
        "Não assine panfletos sensíveis com uma chave que já esteja ligada à sua identidade real.",
        "Mantenha chaves secretas em um app de assinatura ou extensão — nunca as cole em uma página web em um dispositivo compartilhado ou não confiável.",
        "Lembre-se de que um panfleto impresso é permanente. Depois de distribuído, você não pode editá-lo nem recolhê-lo."
      ],
      closing: "O VoxVera é uma ferramenta, não uma garantia. Quando sua segurança depender dele, combine-o com Tor ou uma VPN e hábitos cuidadosos.",
      back: "← Voltar ao VoxVera",
      link: "Segurança e privacidade"
    },
    sw: {
      title: "Usalama na faragha",
      intro: "VoxVera hukusaidia kuchapisha vipeperushi vigumu kudhibitiwa. Peke yake haukufichi utambulisho wako. Tafadhali soma kile kinachokinga na kisichokinga kabla ya kukitegemea.",
      protects_h: "Kile VoxVera inakinga",
      protects: [
        "Vipeperushi huhifadhiwa kwenye relay nyingi huru za Nostr, si tovuti moja, hivyo hakuna mwenyeji mmoja anayeweza kuviondoa kimyakimya.",
        "Kuandika na kuchapisha kipeperushi hufanyika kwenye kivinjari chako. Hakuna kinachotumwa hadi uchague kuchapisha.",
        "Unaweza kuchapisha bila kujulikana. Kwa kawaida VoxVera hutia saini kwa ufunguo wa matumizi-mara-moja ulioundwa kwenye kifaa chako, si jina lako halisi.",
        "Ufunguo wako wa siri unaweza kubaki nje ya ukurasa huu kabisa — tumia kiendelezi cha kivinjari (NIP-07) au programu ya kutia saini kwa mbali (NIP-46)."
      ],
      exposes_h: "Kile kisichokinga",
      exposes: [
        "Unapochapisha kipeperushi au kufungua ubao wa matangazo, relay zinaweza kuona anwani yako ya IP. Tumia Tor au VPN ikiwa eneo lako lazima libaki la faragha.",
        "Ufunguo usiojulikana huhifadhiwa bila usimbaji kwenye kivinjari chako. Yeyote anayeweza kutumia kifaa chako anaweza kuusoma.",
        "PIN ya hiari hupunguza tu udadisi wa kawaida. Haitamzuia mtu anayenakili data yako iliyohifadhiwa na kuishambulia nje ya mtandao.",
        "Chochote unachochapisha ni cha umma na cha kudumu kivitendo. Dhani kwamba hakiwezi kufutwa kabisa, hata baada ya ombi la kufuta.",
        "Kubandika ufunguo wa siri (nsec) kwenye tovuti yoyote ni hatari. Pendelea kiendelezi cha kivinjari au mtia-saini wa mbali.",
        "Ripoti unazotuma ni za umma na zimetiwa saini kwa ufunguo wako. Kuzuia, kinyume chake, hubaki faragha kwenye kifaa chako.",
        "VoxVera haina akaunti na haikufuatilii, lakini mwenyeji wa tovuti na relay bado wanaona maombi yako."
      ],
      tips_h: "Kubaki salama zaidi",
      tips: [
        "Ikiwa eneo lako lazima libaki la faragha, tumia kivinjari cha Tor au VPN inayoaminika kila unapochapisha au kuvinjari ubao.",
        "Chukulia ufunguo usiojulikana kama wa matumizi-mara-moja. Tengeneza mpya unapotaka utengano safi.",
        "Usitie saini vipeperushi nyeti kwa ufunguo ambao tayari umeunganishwa na utambulisho wako halisi.",
        "Weka funguo za siri katika programu ya kutia saini au kiendelezi — usizibandike kamwe kwenye ukurasa wa wavuti kwenye kifaa kinachoshirikiwa au kisichoaminika.",
        "Kumbuka kwamba kipeperushi kilichochapishwa ni cha kudumu. Mara kikishasambazwa, huwezi kukihariri wala kukirudisha."
      ],
      closing: "VoxVera ni chombo, si dhamana. Usalama wako unapokitegemea, kichanganye na Tor au VPN na tabia za uangalifu.",
      back: "← Rudi VoxVera",
      link: "Usalama na faragha"
    },
    tr: {
      title: "Güvenlik ve gizlilik",
      intro: "VoxVera, sansürlenmesi zor el ilanları yayımlamana yardımcı olur. Tek başına seni anonim tutmaz. Ona güvenmeden önce neyi koruyup neyi korumadığını lütfen oku.",
      protects_h: "VoxVera neyi korur",
      protects: [
        "El ilanları tek bir web sitesinde değil, birçok bağımsız Nostr rölesinde saklanır; böylece tek bir barındırıcı onları sessizce kaldıramaz.",
        "El ilanı yazmak ve yazdırmak tarayıcında olur. Sen yayımlamayı seçene dek hiçbir şey gönderilmez.",
        "Anonim olarak yayımlayabilirsin. VoxVera varsayılan olarak gerçek adınla değil, cihazında oluşturulan tek kullanımlık bir anahtarla imzalar.",
        "Gizli anahtarın bu sayfanın tamamen dışında kalabilir — bir tarayıcı uzantısı (NIP-07) ya da uzaktan imzalama uygulaması (NIP-46) kullan."
      ],
      exposes_h: "Neyi korumaz",
      exposes: [
        "Bir el ilanı yayımladığında ya da ilan panosunu açtığında röleler IP adresini görebilir. Konumun gizli kalmalıysa Tor veya VPN kullan.",
        "Anonim anahtar tarayıcında şifrelenmeden saklanır. Cihazını kullanabilen herkes onu okuyabilir.",
        "İsteğe bağlı bir PIN yalnızca gelişigüzel meraklıları yavaşlatır. Saklı verini kopyalayıp çevrimdışı saldıran birini durdurmaz.",
        "Yayımladığın her şey herkese açıktır ve fiilen kalıcıdır. Bir silme isteğinden sonra bile asla tümüyle silinemeyeceğini varsay.",
        "Özel bir anahtarı (nsec) herhangi bir web sitesine yapıştırmak risklidir. Bunun yerine tarayıcı uzantısı veya uzaktan imzalayıcı tercih et.",
        "Gönderdiğin bildirimler herkese açıktır ve anahtarınla imzalanır. Engelleme ise cihazında gizli kalır.",
        "VoxVera'nın hesabı yoktur ve seni izlemez, ama sitenin barındırıcısı ve röleler isteklerini yine de görür."
      ],
      tips_h: "Daha güvende kalmak",
      tips: [
        "Konumun gizli kalmalıysa, yayımladığın ya da panoya göz attığın her seferde Tor Tarayıcı veya güvenilir bir VPN kullan.",
        "Anonim anahtarı tek kullanımlık say. Temiz bir ayrım istediğinde yenisini oluştur.",
        "Hassas el ilanlarını gerçek kimliğinle zaten bağlantılı bir anahtarla imzalama.",
        "Gizli anahtarları bir imzalama uygulamasında ya da uzantıda tut — paylaşılan ya da güvenilmeyen bir cihazda asla bir web sayfasına yapıştırma.",
        "Basılı bir el ilanının kalıcı olduğunu unutma. Bir kez dağıtıldığında onu düzenleyemez ya da geri çağıramazsın."
      ],
      closing: "VoxVera bir araçtır, bir garanti değil. Güvenliğin ona bağlı olduğunda onu Tor veya VPN ve dikkatli alışkanlıklarla birlikte kullan.",
      back: "← VoxVera'ya dön",
      link: "Güvenlik ve gizlilik"
    },
    zh: {
      title: "安全与隐私",
      intro: "VoxVera 帮助你发布难以审查的传单。它本身并不能让你保持匿名。在依赖它之前，请阅读它能保护什么、不能保护什么。",
      protects_h: "VoxVera 能保护什么",
      protects: [
        "传单存储在许多独立的 Nostr 中继上，而非单一网站，因此没有任何单一主机能悄悄删除它们。",
        "撰写和打印传单都在你的浏览器中进行。在你选择发布之前，不会向任何地方发送任何内容。",
        "你可以匿名发布。默认情况下，VoxVera 使用在你设备上生成的一次性密钥签名，而不是你的真实姓名。",
        "你的私钥可以完全不进入此页面——使用浏览器扩展（NIP-07）或远程签名应用（NIP-46）。"
      ],
      exposes_h: "它不能保护什么",
      exposes: [
        "当你发布传单或打开公告栏时，中继可以看到你的 IP 地址。如果你的位置必须保密，请使用 Tor 或 VPN。",
        "匿名密钥以未加密形式存储在你的浏览器中。任何能使用你设备的人都能读取它。",
        "可选的 PIN 只能减缓随意窥探。它无法阻止复制你存储数据并离线破解的人。",
        "你发布的任何内容都是公开且实际上永久的。请假定它永远无法被彻底删除，即使提交了删除请求。",
        "把私钥（nsec）粘贴到任何网站都有风险。请优先使用浏览器扩展或远程签名。",
        "你提交的举报是公开的，并用你的密钥签名。相比之下，屏蔽只保留在你的设备上、保持私密。",
        "VoxVera 没有账户，也不追踪你，但网站主机和中继仍能看到你的请求。"
      ],
      tips_h: "更安全地使用",
      tips: [
        "如果你的位置必须保密，每次发布或浏览公告栏时都使用 Tor 浏览器或可信的 VPN。",
        "把匿名密钥当作一次性的。当你需要彻底分隔时，生成一个新的。",
        "不要用已经与你真实身份关联的密钥来签署敏感传单。",
        "把私钥保存在签名应用或扩展中——切勿在共享或不可信的设备上把它们粘贴到网页里。",
        "请记住，打印出来的传单是永久的。一旦散发出去，你就无法编辑或收回。"
      ],
      closing: "VoxVera 是一个工具，而非保证。当你的安全依赖于它时，请将它与 Tor 或 VPN 以及谨慎的习惯结合使用。",
      back: "← 返回 VoxVera",
      link: "安全与隐私"
    },
    fa: {
      title: "ایمنی و حریم خصوصی",
      intro: "VoxVera به شما کمک می‌کند پوسترهایی منتشر کنید که سانسور آن‌ها دشوار است. به‌تنهایی شما را ناشناس نگه نمی‌دارد. لطفاً پیش از اتکا به آن بخوانید چه چیزی را محافظت می‌کند و چه چیزی را نه.",
      protects_h: "VoxVera از چه چیزی محافظت می‌کند",
      protects: [
        "پوسترها روی رله‌های مستقل و متعدد Nostr ذخیره می‌شوند، نه روی یک وب‌سایت، بنابراین هیچ میزبان واحدی نمی‌تواند آن‌ها را بی‌سروصدا حذف کند.",
        "نوشتن و چاپ پوستر در مرورگر شما انجام می‌شود. تا زمانی که انتشار را انتخاب نکنید، چیزی ارسال نمی‌شود.",
        "می‌توانید به‌صورت ناشناس منتشر کنید. به‌طور پیش‌فرض VoxVera با یک کلید یک‌بارمصرف که روی دستگاه شما ساخته می‌شود امضا می‌کند، نه با نام واقعی شما.",
        "کلید مخفی شما می‌تواند کاملاً بیرون از این صفحه بماند — از افزونه مرورگر (NIP-07) یا برنامه امضای از راه دور (NIP-46) استفاده کنید."
      ],
      exposes_h: "از چه چیزی محافظت نمی‌کند",
      exposes: [
        "وقتی پوستری منتشر می‌کنید یا تابلوی اعلانات را باز می‌کنید، رله‌ها می‌توانند نشانی IP شما را ببینند. اگر موقعیت شما باید خصوصی بماند از Tor یا VPN استفاده کنید.",
        "کلید ناشناس بدون رمزگذاری در مرورگر شما ذخیره می‌شود. هرکس بتواند از دستگاه شما استفاده کند می‌تواند آن را بخواند.",
        "یک PIN اختیاری فقط فضولی اتفاقی را کند می‌کند. کسی را که داده‌های ذخیره‌شده شما را کپی و آفلاین حمله می‌کند متوقف نمی‌کند.",
        "هرچه منتشر می‌کنید عمومی و عملاً دائمی است. فرض کنید هرگز نمی‌توان آن را به‌طور کامل حذف کرد، حتی پس از درخواست حذف.",
        "چسباندن کلید خصوصی (nsec) در هر وب‌سایتی پرخطر است. به‌جای آن افزونه مرورگر یا امضاکننده از راه دور را ترجیح دهید.",
        "گزارش‌هایی که می‌فرستید عمومی و با کلید شما امضا شده‌اند. در مقابل، مسدودسازی روی دستگاه شما خصوصی می‌ماند.",
        "VoxVera حساب کاربری ندارد و شما را ردیابی نمی‌کند، اما میزبان وب‌سایت و رله‌ها همچنان درخواست‌های شما را می‌بینند."
      ],
      tips_h: "ایمن‌تر ماندن",
      tips: [
        "اگر موقعیت شما باید خصوصی بماند، هر بار که منتشر می‌کنید یا تابلو را مرور می‌کنید از مرورگر Tor یا یک VPN معتبر استفاده کنید.",
        "با کلید ناشناس مانند یک کلید یک‌بارمصرف رفتار کنید. وقتی جداسازی تمیز می‌خواهید کلید تازه‌ای بسازید.",
        "پوسترهای حساس را با کلیدی که از پیش به هویت واقعی شما گره خورده امضا نکنید.",
        "کلیدهای مخفی را در یک برنامه امضا یا افزونه نگه دارید — هرگز آن‌ها را در یک صفحه وب روی دستگاه مشترک یا نامعتبر نچسبانید.",
        "به یاد داشته باشید که پوستر چاپ‌شده دائمی است. پس از توزیع، نمی‌توانید آن را ویرایش یا بازپس‌گیری کنید."
      ],
      closing: "VoxVera یک ابزار است، نه یک تضمین. وقتی ایمنی شما به آن وابسته است، آن را با Tor یا VPN و عادت‌های محتاطانه ترکیب کنید.",
      back: "← بازگشت به VoxVera",
      link: "ایمنی و حریم خصوصی"
    }
  };

  function pickLang() {
    try {
      const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
      if (stored && SAFETY_UI[stored]) return stored;
    } catch (_) {}
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || ""];
    for (const tag of list) {
      const base = String(tag || "").split("-")[0];
      if (SAFETY_UI[base]) return base;
    }
    return FALLBACK_LANG;
  }

  let currentLang = pickLang();
  function ui() { return SAFETY_UI[currentLang] || SAFETY_UI[FALLBACK_LANG]; }

  function langLabel(code) {
    const meta = LOCALES[code] && LOCALES[code].meta;
    if (meta && meta.language_name) return (meta.flag ? meta.flag + " " : "") + meta.language_name;
    return code || "—";
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function fillList(id, items) {
    const ul = document.getElementById(id);
    if (!ul) return;
    ul.innerHTML = "";
    (items || []).forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text; // textContent: content is trusted, but never inject HTML
      ul.appendChild(li);
    });
  }

  function populateLangSelect() {
    const sel = document.getElementById("safety-lang");
    if (!sel || sel.options.length) return;
    Object.keys(SAFETY_UI)
      .sort((a, b) => langLabel(a).localeCompare(langLabel(b)))
      .forEach((code) => {
        const opt = document.createElement("option");
        opt.value = code;
        opt.textContent = langLabel(code);
        sel.appendChild(opt);
      });
  }

  function applyLang(lang) {
    currentLang = SAFETY_UI[lang] ? lang : FALLBACK_LANG;
    try { window.localStorage.setItem(UI_LANG_STORAGE_KEY, currentLang); } catch (_) {}
    const dir = (LOCALES[currentLang] && LOCALES[currentLang].meta && LOCALES[currentLang].meta.direction) || "ltr";
    document.documentElement.lang = currentLang;
    document.documentElement.dir = dir;
    const u = ui();
    document.title = "VoxVera — " + u.title;
    setText("safety-title", u.title);
    setText("safety-intro", u.intro);
    setText("safety-protects-h", u.protects_h);
    fillList("safety-protects", u.protects);
    setText("safety-exposes-h", u.exposes_h);
    fillList("safety-exposes", u.exposes);
    setText("safety-tips-h", u.tips_h);
    fillList("safety-tips", u.tips);
    setText("safety-closing", u.closing);
    setText("safety-back", u.back);
    const sel = document.getElementById("safety-lang");
    if (sel) sel.value = currentLang;
  }

  document.addEventListener("DOMContentLoaded", () => {
    populateLangSelect();
    const sel = document.getElementById("safety-lang");
    if (sel) sel.addEventListener("change", () => applyLang(sel.value || FALLBACK_LANG));
    applyLang(currentLang);
  });
})();
