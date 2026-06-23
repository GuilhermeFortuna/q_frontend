# WO100 — Frontend: scalable result surfaces, workers, and virtualization

## Shared context (read first)

Frontend-focused WO. Backend changes are allowed only if an existing endpoint blocks scalable paging
or artifact access, and must be additive.

Depends on **WO96** instrumentation. Benefits from WO99 feature islands but can start independently.

**Context:** Q’s research surfaces will grow: Discovery candidates, optimization trials, backtest
trades, chart bars, walk-forward windows, history, and AI revisions. Large result sets must not
freeze the main thread or render thousands of DOM/SVG nodes unnecessarily.

## Goal

Make large result surfaces scalable:

- virtualize large tables/lists;
- move expensive frontend transforms to memoized selectors or Web Workers;
- progressively load artifacts/results;
- keep visual polish and interaction quality;
- avoid main-thread stalls as result sizes grow.

## How the pieces work today

Read:

- `src/components/discover/LeaderboardTable.tsx`
- `src/components/discover/CandidateDetailPanel.tsx`
- `src/components/optimize/TrialsTable.tsx`
- `src/components/optimize/OptimizationResultsPanel.tsx`
- `src/components/backtests/BacktestResultsTabs.tsx`
- `src/components/backtests/BacktestHistoryPanel.tsx`
- `src/components/backtests/BacktestStrategyChart.tsx`
- `src/components/charts/CandlestickChart.tsx`
- `src/lib/backtesting/performance.ts`
- `src/lib/discover/candidateMetrics.ts`
- `src/lib/optimize/*`
- API query hooks for backtests/optimization/strategySearch/walkforward.

## Tasks

### 1. Inventory large surfaces

Using WO96 metrics and source inspection, document:

- which tables/lists can exceed 100 rows;
- which chart/result transforms are O(n) or worse on every render;
- which panels render hidden or inactive content;
- where SVG node count can grow with data.

Add this inventory to a short developer doc or the final implementation notes.

### 2. Virtualize tables/lists

Apply `@tanstack/react-virtual` already present in dependencies where appropriate:

- Discovery leaderboard;
- optimization trials table;
- backtest/trade/history lists if they can grow;
- walk-forward windows if needed.

Keep keyboard/focus behavior and row expansion usable. Preserve the premium table styling.

### 3. Move expensive transforms off hot render paths

For expensive derived data:

- memoize stable selectors on query data identity;
- precompute once when query data arrives;
- use Web Workers for large transforms where the main thread stalls.

Candidate transforms:

- equity curve/monthly stats for large trade lists;
- optimization terrain/scatter preparation;
- discovery candidate rankings/details;
- chart indicator preparation for large datasets if WO71 is insufficient.

### 4. Progressive result loading

Do not force full artifacts into the initial visible route when summaries are enough.

- Render summaries first;
- load detail panels on expansion;
- load charts when visible;
- page or stream artifact-heavy data if backend endpoints support it.

If backend endpoint support is missing, create an additive follow-up note rather than reshaping
existing contracts silently.

## Visual guardrails

> Virtualized rows must look indistinguishable from non-virtual rows.

> Skeleton/loading/detail expansion states must be cinematic and stable, with no layout jump.

> Do not remove chart/detail richness; defer or compute it more intelligently.

## Tests

- Virtualized tables render visible rows and support row click/expansion.
- Large fixture does not render all rows into the DOM.
- Derived-data selectors do not recompute on unrelated state changes.
- Worker fallback path works when Worker is unavailable in tests/Tauri.
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

With large mocked or real result sets:

- scroll Discovery leaderboard and trials table smoothly;
- expand rows/details without route-wide jank;
- record WO96 long tasks before/after.

## Definition of done

- Large tables/lists are virtualized where needed.
- Expensive transforms are off hot render paths.
- Large fixtures demonstrate bounded DOM size.
- Visual parity is preserved or improved.
- Required test/typecheck/build commands pass.
- Final message includes large-fixture metrics and before/after long-task observations.

## Out of scope

- New backend analytics.
- Changing optimization/discovery algorithms.
- Replacing all charts with a new renderer unless measurement proves it is required.
