#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> flake8"
python3 -m flake8 voxvera tests \
  --jobs=1 \
  --exclude=voxvera/vendor \
  --ignore=E501,W503,W293,E402,E306,E704,E261,F841,E302,F401,E401,F541

echo "==> pytest"
python3 -m pytest tests/ -v

echo "==> electron smoke tests"
(cd gui/electron && npm test)

echo "==> dependency check"
python3 -m voxvera.cli --lang en check

if [[ "$(uname -s)" == "Linux" ]]; then
  echo "==> platform smoke"
  bash scripts/platform-smoke.sh linux-cli
  if command -v docker >/dev/null 2>&1; then
    echo "==> docker runtime smoke"
    bash scripts/docker-runtime-smoke.sh
  fi
fi

echo "==> build docs"
python3 -m voxvera.cli build-docs

echo "==> build site"
python3 -m voxvera.cli build-site

echo "All local checks passed."
