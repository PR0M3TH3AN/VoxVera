# Detaillierte Verwendung

Diese Anleitung deckt gängige CLI-Workflows ab. Informationen zu Docker finden Sie unter `docs/docker.md` und verfügbare Flyer-Vorlagen unter `docs/templates.md`.

## Voraussetzungen

VoxVera ist auf hohe Portabilität ausgelegt und erfordert minimale Systemabhängigkeiten.

### 1. Eigenständige Binärdateien (Empfohlen)
Sie können eigenständige Binärdateien ohne Abhängigkeiten für Ihr Betriebssystem herunterladen:
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

Diese Binärdateien enthalten alles, was zum Ausführen von VoxVera erforderlich ist (außer `onionshare-cli`).

### 2. Ein-Zeilen-Installer
Alternativ können Sie die Installation über unser automatisiertes Skript vornehmen:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Manuelle Python-Installation
Wenn Sie lieber aus dem Quellcode ausführen möchten:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Schritt für Schritt

1. **Initialisieren:** Führen Sie `voxvera init` aus und folgen Sie den Anweisungen. Sie werden zuerst aufgefordert, Ihre Sprache auszuwählen.
2. **Bauen:** Erstellen Sie die Flyer-Assets. Jeder Build erstellt automatisch eine `voxvera-portable.zip` im Flyer-Ordner, sodass andere das komplette Tool direkt von Ihrem Flyer herunterladen können.
   ```bash
   voxvera build
   ```
3. **Bereitstellen:** Veröffentlichen Sie den Flyer über Tor:
   ```bash
   voxvera serve
   ```
   Dies erkennt automatisch Ihre Tor-Instanz, startet OnionShare und schreibt die generierte .onion-Adresse in die Abreiß-Links des Flyers.

## Sprachunterstützung

VoxVera ist vollständig lokalisiert. Sie können Ihre Sprachpräferenz dauerhaft über den interaktiven Selektor oder eine direkte Verknüpfung ändern:

- **Interaktiver Selektor:** `voxvera lang`
- **Direkte Verknüpfung:** `voxvera --lang de` (setzt die Präferenz auf Deutsch)

### Unterstützte Sprachen:
- **Englisch:** `en`
- **Spanisch:** `es` (Alias: `--idioma`)
- **Deutsch:** `de` (Alias: `--sprache`)
- **Russisch:** `ru`
- **Hebräisch:** `he`
- **Arabisch:** `ar`
- **Französisch:** `fr`
- **Japanisch:** `ja`
- **Hindi:** `hi`
- **Suaheli:** `sw`

Sie können auch eine bestimmte Sprache für einen einzelnen Befehl erzwingen, ohne Ihre dauerhafte Präferenz zu ändern:
- **Englisch:** `voxvera --lang en check`
- **Deutsch:** `voxvera --sprache de check`

Die generierten Flyer erkennen automatisch die Browsersprache des Besuchers und schalten den UI-Text entsprechend um.

## Server-Verwaltung

Verwalten Sie mehrere Flyer und deren Tor-Identitäten über ein einziges interaktives Menü:

```bash
voxvera manage
```

Funktionen:
- **{{t('cli.manage_create_new')}}**: Starten Sie die vollständige Setup-Sequenz.
- **{{t('cli.manage_start_all')}}**: Starten oder stoppen Sie alle Flyer in Ihrer Flotte auf einmal.
- **Echtzeit-Status**: Zeigen Sie aktive .onion-URLs und Tor-Bootstrapping-Fortschrittsanzeigen an.
- **Individuelle Steuerung**: {{t('cli.manage_action_export')}} Sie bestimmte Seiten in eine ZIP-Datei oder löschen Sie sie.

## Universelle Spiegelung (Virale Verteilung)

Um sicherzustellen, dass VoxVera auch dann zugänglich bleibt, wenn zentrale Repositories zensiert werden, fungiert jeder Flyer als Spiegel für das Tool.

Wenn Sie einen Flyer hosten, bietet die Schaltfläche **"{{t('web.download_button')}}"** auf der Landingpage eine `voxvera-portable.zip` an, die Folgendes enthält:
- Den vollständigen Quellcode und alle unterstützten Sprachen.
- Alle Python-Abhängigkeiten (vorinstalliert).
- Plattformübergreifende Tor-Binärdateien.

Dies ermöglicht es jedem, der Ihren Flyer scannt, ein neuer Distributor des VoxVera-Tools zu werden.

## Export & Sicherung

Sichern Sie Ihre eindeutigen Tor-Identitäten (damit sich Ihre .onion-URL nie ändert) oder verschieben Sie Ihre Flyer auf einen anderen Computer.

- **Einzelne Seite exportieren:** `voxvera export <folder_name>`
- **Alle Seiten exportieren:** `voxvera export-all`

**Speicherort:** Alle Exporte werden als ZIP-Dateien in einem Ordner namens `voxvera-exports` im Home-Verzeichnis des Benutzers (`~/voxvera-exports/`) auf allen Plattformen gespeichert.

## Import & Wiederherstellung

Stellen Sie Ihr gesamtes Setup auf einem neuen Computer wieder her, indem Sie Ihre ZIP-Dateien nach `~/voxvera-exports/` verschieben und Folgendes ausführen:

```bash
voxvera import-multiple
```

## Portabilität & Offline-Nutzung

Wenn Sie VoxVera auf einem Computer ohne Internetzugang ausführen müssen, können Sie die Abhängigkeiten zuerst lokal bereitstellen:

```bash
voxvera vendorize
```

Dies lädt alle erforderlichen Python-Bibliotheken in `voxvera/vendor/` herunter. Das Tool priorisiert dann diese lokalen Dateien, sodass es ohne `pip install` ausgeführt werden kann.

## Batch-Import (JSON)

Um Flyer in großen Mengen aus mehreren JSON-Konfigurationsdateien zu generieren, legen Sie diese im Verzeichnis `imports/` ab und führen Sie Folgendes aus:

```bash
voxvera batch-import
```

## Wie URLs funktionieren

Jeder Flyer hat zwei separate URLs:
- **Abreiß-Link** (automatisch generiert): Die .onion-Adresse, unter der der Flyer gehostet wird.
- **Inhalts-Link** (vom Benutzer konfiguriert): Eine externe URL, die auf eine Website, ein Video oder einen Download verweist.

Sie müssen die .onion-Adresse nicht manuell eingeben; VoxVera erledigt dies automatisch während der `serve`-Phase.
