#!/usr/bin/env bash
set -euo pipefail

# Resolve repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

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

echo "--> [1/5] Frozen lockfile check (pnpm install --frozen-lockfile)..."
pnpm install --frozen-lockfile --prefer-offline

# Runs here rather than only in the GitHub workflow, so that the pre-push hook
# catches vendored contract drift instead of leaving it for CI to find. Clones
# the same GitHub remote CI uses (CONTRACTS_REV must be pushed). Override with
# CONTRACTS_REPO=/path/to/q_contracts only when working offline.
echo "--> [2/5] Vendored contracts (make contracts-check)..."
make contracts-check

# The static checks are independent, so they run concurrently (combined peak ~3 GB).
# Output is buffered per check and printed in a stable order once all finish.
# eslint/prettier caches live under node_modules/.cache and only help repeat runs.
echo "--> [3/5] Static checks in parallel (cross-repo paths, tsc, eslint, prettier)..."
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
echo "--> [4/5] Tests (vitest run)..."
"${NICE[@]}" pnpm test:run

# `pnpm build` is `tsc -b && vite build`; tsc already ran in step 3 (both tsconfigs
# are noEmit), so only the bundler runs here.
echo "--> [5/5] Production Build (vite build)..."
"${NICE[@]}" pnpm exec vite build

echo "=================================================="
echo "==> All CI stages passed successfully!"
echo "=================================================="
