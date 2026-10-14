#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "No se encontro Node.js. Instala Node.js LTS y vuelve a ejecutar este archivo."
  exit 1
fi

node artifacts/device-lock/scripts/build-apk-local.js
