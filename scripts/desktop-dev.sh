#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
exec "$PROJECT_ROOT/scripts/with-project-rust.sh" \
  /Users/lam/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback/pnpm \
  desktop:dev

