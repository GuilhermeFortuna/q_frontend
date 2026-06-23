# Bundle splitting and startup budget (WO106)

This document tracks what remains in the **startup path** after WO99 feature-island route splitting, and how to verify chunk sizes in future PRs.

## Startup path (eager)

These modules load before any workspace route resolves:

| Area            | Modules                                                          | Notes                                             |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| App shell       | `App.tsx`, `router.tsx`, `AppShell.tsx`, `AppDock.tsx`           | Dock stays eager for navigation                   |
| Cinematic shell | `CinematicScene`, `CinematicParticles`, `vendor-three`           | Required for launcher first paint — do not remove |
| Core vendors    | `vendor-react`, `vendor-router`, `vendor-query`, `vendor-motion` | Split via `manualChunks` in `vite.config.ts`      |
| Perf HUD        | `PerformanceInstrumentation`                                     | **Lazy** — only loads when `VITE_PERF_HUD=true`   |

## Deferred (not startup)

| Area                | Load trigger                                    | Chunk                                        |
| ------------------- | ----------------------------------------------- | -------------------------------------------- |
| Workspaces          | TanStack route `lazy()` in `lazyWorkspaces.tsx` | `*Workspace-*.js` per route                  |
| Recharts panels     | Backtest results tabs / walk-forward views      | `vendor-charts`, `BacktestRechartsPane-*.js` |
| Visx candlestick    | Market data + trade chart islands               | `vendor-charts`, lazy chart islands          |
| Three/drei features | Optimize terrain, discover swarm                | `vendor-drei`, feature island chunks         |
| PDF export          | Export button in backtest results               | `backtestReport-*.js` on click               |
| AI strategy builder | Teaser expand in Strategy Studio                | `AiStrategyIsland-*.js`                      |
| Confirm dialogs     | History panels in workspaces                    | `confirm-dialog-*.js` (workspace chunk)      |

## Budget (minified, not gzip)

| Chunk                | Current target             | Policy                                |
| -------------------- | -------------------------- | ------------------------------------- |
| `index-*.js`         | **Trend below 1 MB**       | True startup application code only    |
| `vendor-three-*.js`  | Allowed at startup         | Cinematic launcher WebGL              |
| `vendor-charts-*.js` | Must stay **out of index** | Load on workspace/feature interaction |
| `vendor-drei-*.js`   | Must stay **out of index** | 3D feature surfaces only              |

As of WO106 implementation, `manualChunks` splits React, router, query, motion, three, charts, and drei. Recharts backtest charts and PDF export are behind lazy islands / dynamic import.

**Measured after WO106** (minified):

| Chunk                | Size               |
| -------------------- | ------------------ |
| `index-*.js`         | ~151 KB            |
| `vendor-three-*.js`  | ~888 KB            |
| `vendor-react-*.js`  | ~194 KB            |
| `vendor-motion-*.js` | ~114 KB            |
| `vendor-router-*.js` | ~90 KB             |
| `vendor-charts-*.js` | ~446 KB (deferred) |
| `vendor-query-*.js`  | ~48 KB             |

Startup entry (`index`) is now under the 1 MB budget. Total first-load bytes still include cinematic Three.js — track `vendor-three` separately when optimizing Tauri launch.

## Verification commands

```bash
cd q_frontend

# Production build + chunk summary
pnpm bundle:report

# Re-report without rebuilding
pnpm bundle:report --skip-build

# Required regression gates
pnpm build
pnpm test:run -- tests/unit/app/lazyRoutes.test.ts tests/unit/components/featureIslands.test.tsx
pnpm exec tsc -p tsconfig.app.json --noEmit
```

## Adding new heavy dependencies

1. Prefer **lazy feature islands** with `FeatureIslandFallback` (dimension-stable skeleton).
2. If the library is shared across a workspace, add it to an existing `vendor-*` group in `src/lib/build/manualChunks.ts`.
3. Run `pnpm bundle:report` and note before/after `index-*.js` size in the PR.
4. If `index` must grow past 1 MB, document why the code is true startup-critical.

## Inspection workflow

1. `pnpm bundle:report` — sorted chunk list + startup total.
2. Grep eager imports from `src/app/` and `src/components/layout/AppShell.tsx`.
3. Confirm workspace routes still use `lazyWorkspaces.tsx` wrappers.
4. Optional: search build output for `vendor-charts` / `vendor-drei` — they should not appear in the startup-related list unless intentionally added to the shell.
