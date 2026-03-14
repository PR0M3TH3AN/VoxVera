#!/usr/bin/env bash
set -euo pipefail

VERSION="${VERSION:-15.0.7}"
BASE_URL="https://dist.torproject.org/torbrowser"

ARCH=$(uname -m)
if [ "$ARCH" == "aarch64" ] || [ "$ARCH" == "arm64" ]; then
    TOR_ARCH="aarch64"
else
    TOR_ARCH="x86_64"
fi

case "$(uname -s)" in
  Linux*)  PLATFORM=linux;  ARCHIVE="tor-expert-bundle-linux-${TOR_ARCH}-${VERSION}.tar.gz"; EXE=tor;;
  Darwin*) PLATFORM=mac;    ARCHIVE="tor-expert-bundle-macos-${TOR_ARCH}-${VERSION}.tar.gz"; EXE=tor;;
  MINGW*|MSYS*|CYGWIN*) PLATFORM=win; ARCHIVE="tor-expert-bundle-windows-x86_64-${VERSION}.tar.gz"; EXE=tor.exe;;
  *) echo "Unsupported OS" >&2; exit 1;;
esac

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

URL="$BASE_URL/${VERSION}/${ARCHIVE}"

echo "Downloading $URL"
curl -L "$URL" -o "$TMPDIR/$ARCHIVE"

echo "Extracting..."
tar -xf "$TMPDIR/$ARCHIVE" -C "$TMPDIR"

DEST="$(dirname "$0")/../voxvera/resources/tor/$PLATFORM"
mkdir -p "$DEST"

TOR_BIN=$(find "$TMPDIR" -type f -name "$EXE" | head -n 1)
OBFS_BIN=$(find "$TMPDIR" -type f \( -name "lyrebird*" -o -name "obfs4proxy*" \) | head -n 1)

if [[ -z "$TOR_BIN" || -z "$OBFS_BIN" ]]; then
  echo "Failed to locate tor or lyrebird/obfs4proxy in archive" >&2
  exit 1
fi

cp "$TOR_BIN" "$DEST/$(basename "$EXE")"
cp "$OBFS_BIN" "$DEST/$(basename "$OBFS_BIN")"

chmod +x "$DEST/$(basename "$EXE")" "$DEST/$(basename "$OBFS_BIN")"

echo "Installed binaries to $DEST"

