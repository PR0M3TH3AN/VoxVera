#!/usr/bin/env bash
set -euo pipefail

VERSION="${VERSION:-15.0.7}"
BASE_URL="https://dist.torproject.org/torbrowser"

# ARCH=$(uname -m) # Not needed for multi-platform download if we hardcode/loop targets

download_platform() {
    local platform=$1
    local arch=$2
    local archive=$3
    local exe=$4
    
    local tmpdir=$(mktemp -d)
    # trap 'rm -rf "$tmpdir"' EXIT # We'll clean up manually in the loop

    local url="$BASE_URL/${VERSION}/${archive}"
    local dest="$(dirname "$0")/../voxvera/resources/tor/$platform"
    
    echo "--- Platform: $platform ($arch) ---"
    echo "Downloading $url"
    if ! curl -L "$url" -o "$tmpdir/$archive"; then
        echo "Failed to download $url" >&2
        rm -rf "$tmpdir"
        return 1
    fi

    echo "Extracting..."
    if [[ "$archive" == *.zip ]]; then
        unzip -q "$tmpdir/$archive" -d "$tmpdir"
    else
        tar -xf "$tmpdir/$archive" -C "$tmpdir"
    fi

    mkdir -p "$dest"

    local tor_bin=$(find "$tmpdir" -type f -name "$exe" | head -n 1)
    local obfs_bin=$(find "$tmpdir" -type f \( -name "lyrebird*" -o -name "obfs4proxy*" \) | head -n 1)

    if [[ -z "$tor_bin" || -z "$obfs_bin" ]]; then
      echo "Failed to locate tor or lyrebird/obfs4proxy in archive for $platform" >&2
      rm -rf "$tmpdir"
      return 1
    fi

    echo "Installing binaries to $dest"
    cp "$tor_bin" "$dest/$(basename "$exe")"
    cp "$obfs_bin" "$dest/$(basename "$obfs_bin")"

    chmod +x "$dest/$(basename "$exe")" "$dest/$(basename "$obfs_bin")"
    
    # If it's lyrebird, create a symlink for obfs4proxy for compatibility
    if [[ "$(basename "$obfs_bin")" == "lyrebird"* ]]; then
        local obfs_name="obfs4proxy"
        [[ "$platform" == "win" ]] && obfs_name="obfs4proxy.exe"
        echo "Creating symlink $obfs_name -> $(basename "$obfs_bin")"
        (cd "$dest" && rm -f "$obfs_name" && ln -s "$(basename "$obfs_bin")" "$obfs_name")
    fi

    rm -rf "$tmpdir"
}

# Linux x86_64
download_platform "linux" "x86_64" "tor-expert-bundle-linux-x86_64-${VERSION}.tar.gz" "tor"

# macOS x86_64 (Intel) - works on M1/M2 via Rosetta if needed, but expert bundle usually has universal or specific
download_platform "mac" "x86_64" "tor-expert-bundle-macos-x86_64-${VERSION}.tar.gz" "tor"

# Windows x86_64
download_platform "win" "x86_64" "tor-expert-bundle-windows-x86_64-${VERSION}.tar.gz" "tor.exe"

echo "All platforms updated."
