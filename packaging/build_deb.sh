#!/usr/bin/env bash
set -e

# Ensure we are in project root
cd "$(dirname "$0")/.."

ARCH=$(uname -m)
# Debian uses amd64 instead of x86_64
if [ "$ARCH" == "x86_64" ]; then
  DEB_ARCH="amd64"
elif [ "$ARCH" == "aarch64" ] || [ "$ARCH" == "arm64" ]; then
  DEB_ARCH="arm64"
else
  DEB_ARCH="$ARCH"
fi
BINARY=${1:-"voxvera/resources/bin/voxvera-linux-$ARCH"}

if [ ! -f "$BINARY" ]; then
  echo "Binary not found: $BINARY." >&2
  exit 1
fi


VERSION=$(grep "__version__" voxvera/__init__.py | cut -d '"' -f 2)
PKG_DIR="build/voxvera_${VERSION}_${DEB_ARCH}"

echo "Building .deb package for version $VERSION ($DEB_ARCH)..."

rm -rf "$PKG_DIR"
mkdir -p "$PKG_DIR/usr/bin"
mkdir -p "$PKG_DIR/DEBIAN"

cp "$BINARY" "$PKG_DIR/usr/bin/voxvera"
chmod +x "$PKG_DIR/usr/bin/voxvera"

# Copy control file and update version/arch
cp packaging/deb/DEBIAN/control "$PKG_DIR/DEBIAN/control"
sed -i "s/^Version: .*/Version: $VERSION/" "$PKG_DIR/DEBIAN/control"
sed -i "s/^Architecture: .*/Architecture: $DEB_ARCH/" "$PKG_DIR/DEBIAN/control"

# Build the package
dpkg-deb --build "$PKG_DIR" "voxvera/resources/bin/voxvera_${VERSION}_${DEB_ARCH}.deb"

echo "Debian package created at voxvera/resources/bin/voxvera_${VERSION}_${DEB_ARCH}.deb"
