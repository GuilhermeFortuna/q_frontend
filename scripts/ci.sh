#!/usr/bin/env bash
set -euo pipefail

# GUI-spawned git hooks (GitKraken, etc.) often omit the user session bus vars,
# which makes `systemctl --user` fail and skips ci.slice entirely.
if [[ -z "${XDG_RUNTIME_DIR:-}" && -d "/run/user/$(id -u)" ]]; then
  export XDG_RUNTIME_DIR="/run/user/$(id -u)"
fi
if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" && -n "${XDG_RUNTIME_DIR:-}" && -S "${XDG_RUNTIME_DIR}/bus" ]]; then
  export DBUS_SESSION_BUS_ADDRESS="unix:path=${XDG_RUNTIME_DIR}/bus"
fi

# Enter the host user ci.slice when available so local CI yields to interactive work.
# Scope gets Nice=10 + idle ionice so install/clone/build IO is deprioritized too.
# No-ops on hosts/runners without systemd-run or the slice (e.g. GitHub Actions).
if [[ "${CI_RESOURCE_CONTROLLED:-0}" != "1" ]]; then
  if command -v systemd-run >/dev/null 2>&1 &&
     systemctl --user status ci.slice >/dev/null 2>&1; then
    _ci_run=(
      systemd-run --user --scope --quiet --collect --slice=ci.slice --nice=10
      --setenv=CI_RESOURCE_CONTROLLED=1
      --setenv=XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR}"
      --setenv=DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS}"
    )
    if command -v ionice >/dev/null 2>&1; then
      exec "${_ci_run[@]}" ionice -c 3 "$0" "$@"
    fi
    exec "${_ci_run[@]}" "$0" "$@"
  fi
fi

# Resolve repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Prefer fnm Node/pnpm (GUI git hooks often lack ~/.bashrc init).
# shellcheck disable=SC1091
source "${REPO_ROOT}/scripts/ensure-node-env.sh"

echo "=================================================="
echo "==> Running q_frontend CI Pipeline"
echo "=================================================="

# Ensure timezone parity for timezone-sensitive snapshot tests (UTC-3)
export TZ="${TZ:-America/Sao_Paulo}"

# Lower CPU/IO priority locally so CI yields to interactive work and agent sessions.
NICE=()
if [ -z "${CI:-}" ] && command -v nice >/dev/null 2>&1; then
  NICE=(nice -n 10)
  command -v ionice >/dev/null 2>&1 && NICE=(ionice -c 3 "${NICE[@]}")
fi

echo "--> [1/6] Frozen lockfile check (pnpm install --frozen-lockfile)..."
"${NICE[@]}" pnpm install --frozen-lockfile --prefer-offline

# Runs here rather than only in the GitHub workflow, so that the pre-push hook
# catches vendored contract drift instead of leaving it for CI to find. Clones
# the same GitHub remote CI uses (CONTRACTS_REV must be pushed). Override with
# CONTRACTS_REPO=/path/to/q_contracts only when working offline.
echo "--> [2/6] Vendored contracts (make contracts-check)..."
"${NICE[@]}" make contracts-check

# The static checks are independent, so they run concurrently (combined peak ~3 GB).
# Output is buffered per check and printed in a stable order once all finish.
# eslint/prettier caches live under node_modules/.cache and only help repeat runs.
echo "--> [3/6] Static checks in parallel (cross-repo paths, tsc, eslint, prettier)..."
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT
declare -A CHECKS=(
  [cross-repo-paths]="node scripts/check-cross-repo-paths.mjs"
  [typecheck]="pnpm typecheck"
  [lint]="pnpm lint --cache --cache-location node_modules/.cache/eslint/"
  [format]="pnpm format:check --cache"
)
ORDER=(cross-repo-paths typecheck lint format)
declare -A PIDS=()
for name in "${ORDER[@]}"; do
  # shellcheck disable=SC2086
  "${NICE[@]}" ${CHECKS[$name]} >"$LOG_DIR/$name.log" 2>&1 &
  PIDS[$name]=$!
done
FAILED=()
for name in "${ORDER[@]}"; do
  if wait "${PIDS[$name]}"; then
    echo "    ok   $name"
  else
    echo "    FAIL $name"
    FAILED+=("$name")
  fi
done
for name in "${FAILED[@]}"; do
  echo "---------------- $name output ----------------"
  cat "$LOG_DIR/$name.log"
done
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "==> Static checks failed: ${FAILED[*]}"
  exit 1
fi

# Worker count is capped in vitest.config.ts (VITEST_MAX_WORKERS to override).
echo "--> [4/6] Tests (vitest run)..."
"${NICE[@]}" pnpm test:run

# `pnpm build` is `tsc -b && vite build`; tsc already ran in step 3 (both tsconfigs
# are noEmit), so only the bundler runs here.
echo "--> [5/6] Production Build (vite build)..."
"${NICE[@]}" pnpm exec vite build

# The Rust shell is part of this repository, so it belongs in this repository's
# validation suite. Without this stage `src-tauri/tests/no_process_ownership.rs`
# — the guard that keeps the shell from owning backend processes again — never
# runs anywhere, and a reintroduced `std::process::Command` ships unnoticed.
# cargo is a hard requirement here: `pnpm tauri:dev` and `pnpm tauri build`
# cannot work without it, so a missing toolchain is an error, not a skip.
# `cargo fmt --check` is deliberately not here: the shell sources predate any
# rustfmt gate and do not pass it. Adding one is a separate change.
echo "--> [6/6] Tauri shell (cargo clippy, test)..."
if ! command -v cargo >/dev/null 2>&1; then
  echo "    cargo not found; install the Rust toolchain (https://rustup.rs) to build the desktop shell." >&2
  exit 1
fi
"${NICE[@]}" cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
"${NICE[@]}" cargo test --manifest-path src-tauri/Cargo.toml

echo "=================================================="
echo "==> All CI stages passed successfully!"
echo "=================================================="
