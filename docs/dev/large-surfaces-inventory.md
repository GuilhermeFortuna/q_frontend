# Large result surfaces — inventory (WO100)

Measured against WO96 instrumentation and source inspection. Threshold for virtualization:
`VIRTUALIZE_THRESHOLD = 50` rows; worker offload for backtest transforms at
`BACKTEST_WORKER_THRESHOLD = 400` trades.

## Tables / lists (can exceed 100 rows)

| Surface                     | Component                                   | Virtualized | Notes                                         |
| --------------------------- | ------------------------------------------- | ----------- | --------------------------------------------- |
| Discovery leaderboard       | `LeaderboardTable.tsx`                      | Yes         | Dynamic row height when detail expanded       |
| Optimization trials         | `TrialsTable.tsx`                           | Yes         | Sort precomputed via `sortOptimizationTrials` |
| Backtest trade list         | `BacktestResultsTabs` → `TradeHistoryTable` | Yes         | Tab mounts only when "Trade List" active      |
| Backtest history            | `BacktestHistoryPanel.tsx`                  | Yes         | Infinite query + virtual list                 |
| Walk-forward windows        | `WalkForwardWindowsTable.tsx`               | Yes         | Dense WF runs                                 |
| Optimization history panels | `OptimizationHistoryPanel.tsx`              | No          | Server-paged; typically &lt; 50 per page      |
| Discover history            | `DiscoverHistoryPanel.tsx`                  | No          | Same                                          |

## O(n) transforms moved off hot paths

| Transform                    | Location                        | Mitigation                              |
| ---------------------------- | ------------------------------- | --------------------------------------- |
| Leaderboard sort             | `sortLeaderboardCandidates.ts`  | `useMemo` on filter/sort inputs         |
| Trial sort                   | `sortOptimizationTrials.ts`     | `useMemo` in `TrialsTable`              |
| Scatter point prep           | `prepareScatterData.ts`         | `useMemo` in `OptimizationScatter`      |
| Equity curve + monthly stats | `useBacktestPerformanceData.ts` | Sync below 400 trades; Web Worker above |
| Terrain/scatter 3D           | `OptimizationTerrain3D.tsx`     | Already `useMemo`; feature-local canvas |

## Progressive loading (existing + WO100)

| Panel                  | Behavior                                                          |
| ---------------------- | ----------------------------------------------------------------- |
| `CandidateDetailPanel` | Equity/genome queries only on row expand                          |
| `BacktestResultsTabs`  | Trade chart via `LazyBacktestStrategyChart`; trades tab on demand |
| `BacktestHistoryPanel` | Summary list first; full config on selection via `useBacktestRun` |

## SVG / canvas growth

| Surface              | Risk                     | Mitigation                                    |
| -------------------- | ------------------------ | --------------------------------------------- |
| Candlestick charts   | O(bars) SVG nodes        | WO71 decimation; lazy chart island            |
| Optimization scatter | O(trials) Recharts cells | Precomputed points; Recharts caps visible DOM |
| 3D terrain / swarm   | Feature canvases         | Separate WebGL; dims cinematic scene (WO97)   |

## Backend follow-ups (additive only)

- Paged discovery candidate API if population &gt; 500 per run becomes common.
- Streaming trade artifact endpoint for multi-thousand trade backtests (optional).
