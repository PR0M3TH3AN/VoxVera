#!/usr/bin/env bash
set -e

if [ ! -f dist/voxvera ]; then
  echo "Run PyInstaller first" >&2
  exit 1
fi

APPDIR=dist/AppDir
mkdir -p "$APPDIR/usr/bin"
cp dist/voxvera "$APPDIR/usr/bin/voxvera"
chmod +x "$APPDIR/usr/bin/voxvera"
mkdir -p "$APPDIR/usr/lib/voxvera/resources"
cp -r voxvera/resources/tor "$APPDIR/usr/lib/voxvera/resources/"
# also bundle Tor for the Electron GUI
mkdir -p gui/electron/voxvera/resources
cp -r voxvera/resources/tor gui/electron/voxvera/resources/

cat > "$APPDIR/voxvera.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=VoxVera
Exec=voxvera
Icon=voxvera
Categories=Utility;
EOD

touch "$APPDIR/voxvera.png"

wget -q https://github.com/AppImage/AppImageKit/releases/latest/download/appimagetool-x86_64.AppImage -O appimagetool
chmod +x appimagetool
./appimagetool "$APPDIR" dist/VoxVera.AppImage
rm appimagetool

echo "AppImage created at dist/VoxVera.AppImage"
