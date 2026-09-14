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

echo "--> [1/7] Frozen lockfile check (pnpm install --frozen-lockfile)..."
pnpm install --frozen-lockfile --prefer-offline

# Runs here rather than only in the GitHub workflow, so that the pre-push hook
# catches vendored contract drift instead of leaving it for CI to find. Needs
# a checkout that contains CONTRACTS_REV: the Makefile prefers ../q_contracts
# when that pin is present locally; otherwise it clones the GitHub remote.
# Override with CONTRACTS_REPO=/path/to/q_contracts when needed.
echo "--> [2/7] Vendored contracts (make contracts-check)..."
make contracts-check


echo "--> [3/7] Typecheck (tsc -b --noEmit)..."
pnpm typecheck

echo "--> [4/7] Lint (eslint)..."
pnpm lint

echo "--> [5/7] Format check (prettier --check)..."
pnpm format:check

echo "--> [6/7] Tests (vitest run)..."
pnpm test:run

echo "--> [7/7] Production Build (vite build)..."
pnpm build

echo "=================================================="
echo "==> All CI stages passed successfully!"
echo "=================================================="
