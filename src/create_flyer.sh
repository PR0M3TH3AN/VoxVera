#!/usr/bin/env bash
# Legacy wrapper for voxvera Python CLI

set -e

if command -v voxvera >/dev/null 2>&1; then
  voxvera "$@"
else
  python3 -m voxvera "$@"
fi
