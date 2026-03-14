#!/usr/bin/env bash
set -e

# Ensure we are in project root
cd "$(dirname "$0")/.."

ARCH=$(uname -m)
BINARY="voxvera/resources/bin/voxvera-linux-$ARCH"

if [ ! -f "$BINARY" ]; then
  echo "Binary not found: $BINARY. Run scripts/build_binaries.sh first." >&2
  exit 1
fi

APPDIR=build/AppDir
mkdir -p "$APPDIR/usr/bin"
cp "$BINARY" "$APPDIR/usr/bin/voxvera"
chmod +x "$APPDIR/usr/bin/voxvera"

# Desktop file
cat > "$APPDIR/voxvera.desktop" <<EOD
[Desktop Entry]
Type=Application
Name=VoxVera
Exec=voxvera
Icon=voxvera
Categories=Utility;
Terminal=true
EOD

# Use a generic icon since we don't have one
# (AppImageTool requires an icon file to exist)
# We will copy a qrcode as a placeholder if nothing else exists
cp site/qrcode-content.png "$APPDIR/voxvera.png"

# Download appimagetool
echo "Downloading appimagetool..."
wget -q https://github.com/AppImage/appimagetool/releases/download/continuous/appimagetool-x86_64.AppImage -O appimagetool
chmod +x appimagetool

# Run appimagetool
echo "Running appimagetool..."
export ARCH
./appimagetool --appimage-extract-and-run "$APPDIR" voxvera/resources/bin/VoxVera-x86_64.AppImage
rm appimagetool

echo "AppImage created at voxvera/resources/bin/VoxVera-x86_64.AppImage"
