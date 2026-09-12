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

# Runs here rather than only in the GitHub workflow, so that the pre-push hook
# catches vendored contract drift instead of leaving it for CI to find. Needs
# to reach the contracts repository; point CONTRACTS_REPO at a local clone when
# working offline.
echo "--> [1/6] Vendored contracts (make contracts-check)..."
make contracts-check

echo "--> [2/6] Typecheck (tsc -b --noEmit)..."
pnpm typecheck

echo "--> [3/6] Lint (eslint)..."
pnpm lint

echo "--> [4/6] Format check (prettier --check)..."
pnpm format:check

echo "--> [5/6] Tests (vitest run)..."
pnpm test:run

echo "--> [6/6] Production Build (vite build)..."
pnpm build

echo "=================================================="
echo "==> All CI stages passed successfully!"
echo "=================================================="
