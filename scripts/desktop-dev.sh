#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec node "$PROJECT_ROOT/scripts/with-project-rust.mjs" tauri dev
