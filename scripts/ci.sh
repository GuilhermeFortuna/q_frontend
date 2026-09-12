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

echo "--> [1/5] Typecheck (tsc -b --noEmit)..."
pnpm typecheck

echo "--> [2/5] Lint (eslint)..."
pnpm lint

echo "--> [3/5] Format check (prettier --check)..."
pnpm format:check

echo "--> [4/5] Tests (vitest run)..."
pnpm test:run

echo "--> [5/5] Production Build (vite build)..."
pnpm build

echo "=================================================="
echo "==> All CI stages passed successfully!"
echo "=================================================="
