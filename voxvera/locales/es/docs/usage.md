# Uso detallado

Esta guía cubre los flujos de trabajo de CLI comunes. Consulte `docs/docker.md` para obtener instrucciones de Docker y `docs/templates.md` para conocer las plantillas de volantes disponibles.

## Prerrequisitos

VoxVera está diseñado para ser altamente portátil y requiere un mínimo de dependencias del sistema.

### 1. Binarios independientes (Recomendado)
Puede descargar binarios independientes sin dependencias para su sistema operativo:
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

Estos binarios incluyen todo lo necesario para ejecutar VoxVera (excepto `onionshare-cli`).

### 2. Instalador de una sola línea
Alternativamente, instale a través de nuestro script automatizado:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Instalación manual de Python
Si prefiere ejecutar desde la fuente:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Paso a paso

1. **Inicializar:** Ejecute `voxvera init` y siga las instrucciones. Se le pedirá que seleccione su idioma primero.
2. **Construir:** Genere los activos del volante. Cada construcción crea automáticamente un `voxvera-portable.zip` en la carpeta del volante, lo que permite que otros descarguen la herramienta completa directamente desde su volante.
   ```bash
   voxvera build
   ```
3. **Servir:** Publique el volante sobre Tor:
   ```bash
   voxvera serve
   ```
   Esto detecta automáticamente su instancia de Tor, inicia OnionShare y escribe la dirección .onion generada en los enlaces desprendibles del volante.

## Soporte de idiomas

VoxVera está totalmente localizado. Puede cambiar su preferencia de idioma de forma permanente utilizando el selector interactivo o un acceso directo:

- **Selector interactivo:** `voxvera lang`
- **Acceso directo:** `voxvera --lang es` (establece la preferencia en español)

### Idiomas soportados:
- **Inglés:** `en`
- **Español:** `es` (alias: `--idioma`)
- **Alemán:** `de` (alias: `--sprache`)
- **Ruso:** `ru`
- **Hebreo:** `he`
- **Árabe:** `ar`
- **Francés:** `fr`
- **Japonés:** `ja`
- **Hindi:** `hi`
- **Swahili:** `sw`

También puede forzar un idioma específico para un solo comando sin cambiar su preferencia permanente:
- **Inglés:** `voxvera --lang en check`
- **Español:** `voxvera --idioma es check`

Los volantes generados detectan automáticamente el idioma del navegador del visitante y cambian el texto de la interfaz en consecuencia.

## Gestión de servidores

Gestione múltiples volantes y sus identidades de Tor desde un único menú interactivo:

```bash
voxvera manage
```

Características:
- **{{t('cli.manage_create_new')}}**: Inicie la secuencia de configuración completa.
- **{{t('cli.manage_start_all')}}**: Inicie o apague todos los volantes de su flota a la vez.
- **Estado en tiempo real**: Vea las URL .onion activas e indicadores de progreso de arranque de Tor.
- **Control individual**: {{t('cli.manage_action_export')}} sitios específicos a ZIP o elimínelos.

## Espejo universal (Distribución viral)

Para garantizar que VoxVera siga siendo accesible incluso si los repositorios centrales son censurados, cada volante actúa como un espejo para la herramienta.

Cuando hospeda un volante, el botón **"{{t('web.download_button')}}"** en la página de inicio proporciona un `voxvera-portable.zip` que contiene:
- El código fuente completo y todos los idiomas soportados.
- Todas las dependencias de Python (pre-vendeurizadas).
- Binarios de Tor multiplataforma.

Esto permite que cualquier persona que escanee su volante se convierta en un nuevo distribuidor de la herramienta VoxVera.

## Exportación y respaldo

Haga una copia de seguridad de sus identidades únicas de Tor (para que su URL .onion nunca cambie) o mueva sus volantes a otra máquina.

- **Exportar un solo sitio**: `voxvera export <nombre_carpeta>`
- **Exportar todos los servicios**: `voxvera export-all`

**Lugar de almacenamiento:** Todas las exportaciones se guardan como archivos ZIP en una carpeta llamada `voxvera-exports` en el directorio de inicio del usuario (`~/voxvera-exports/`) en todas las plataformas.

## Importación y recuperación

Restaure toda su configuración en una nueva máquina moviendo sus archivos ZIP a `~/voxvera-exports/` y ejecutando:

```bash
voxvera import-multiple
```

## Portabilidad y uso sin conexión

Si necesita ejecutar VoxVera en una máquina sin acceso a Internet, primero puede "vendeurizar" las dependencias:

```bash
voxvera vendorize
```

Esto descarga todas las librerías de Python requeridas en `voxvera/vendor/`. La herramienta dará prioridad a estos archivos locales, lo que le permitirá ejecutarse sin `pip install`.

## Importación por lotes (JSON)

Para generar volantes de forma masiva a partir de múltiples archivos de configuración JSON, colóquelos en el directorio `imports/` y ejecute:

```bash
voxvera batch-import
```

## Cómo funcionan las URL

Cada volante tiene dos URL separadas:
- **Enlace desprendible** (generado automáticamente): La dirección .onion donde se hospeda el volante.
- **Enlace de contenido** (configurado por el usuario): Una URL externa que apunta a un sitio web, video o descarga.

No es necesario ingresar manualmente la dirección .onion; VoxVera lo maneja automáticamente durante la fase de `serve`.
