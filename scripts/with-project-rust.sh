#!/usr/bin/env sh
set -eu

PROJECT_ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
export CARGO_HOME="$PROJECT_ROOT/.local-rust/cargo"
export RUSTUP_HOME="$PROJECT_ROOT/.local-rust/rustup"
export PATH="$CARGO_HOME/bin:/Users/lam/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/lam/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/fallback:$PATH"

exec "$@"

