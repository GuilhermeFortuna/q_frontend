# Q-125 implementation plan: Performance tab rolling metrics and trade distribution

> **For implementation agents:** Read the linked specification and repository instructions. Launch only through `./work start Q-125 --agent <agent> --worktree` after written-plan approval and after Q-124 is Done. Implement natively; delegation requires separate authorization.

**Goal:** The Performance tab adds a rolling-metrics chart and four trade-distribution panels below Q-124's summary.
**Architecture:** Pure derivations in `src/lib/backtesting/distribution.ts` run inline or in the existing performance worker. Thin Recharts components render them in Q-124's panel framing.
**Tech stack:** React 19, TypeScript, Tailwind v4 tokens, Recharts, Web Workers, Vitest and Testing Library, MSW.
**Spec:** [Specification](../specs/Q-125-performance-tab-rolling-metrics-and-trade-distribution-spec.md)
**Status:** written plan awaiting human review.

## Global constraints

- Start from `development` with Q-124 merged. Reuse its panel framing, formatters and fixture.
- Reuse `SegmentedToggle`, `chartTheme`, `rechartsTheme`, the display-time helpers and the existing worker client. Add no new dependency.
- Derivations are pure and unit-tested, and the worker and inline paths share one implementation.
- Tests run as `TZ=America/Sao_Paulo pnpm test:run`. Do not run the backend or Tauri.
- Commit focused units on the task branch; no push, merge or protected-branch checkout.

## Review focus

- Histogram binning around zero and with outliers; the rolling profit factor with loss-free windows.
- Timezone correctness of the weekday and hour buckets.
- No stale worker results when trades change. Follow the existing request-id guard in `useBacktestPerformanceData`.
- Visual consistency with Q-124 panels, and rendering cost with 10,000 trades.

## Ordered implementation

### 1. Pure derivations

**Files:** new `src/lib/backtesting/distribution.ts`, plus tests.

- [ ] Write failing tests for acceptance items 1–3, then implement the four functions. Commit.

### 2. Worker integration

**Files:** `backtestPerformance.worker.ts`, `backtestPerformanceClient.ts`, `useBacktestPerformanceData.ts`, plus their tests.

- [ ] Write a failing parity test for acceptance item 6, then return the derived series from both paths. Commit.

### 3. Rolling metrics chart

**Files:** new `RollingMetricsChart.tsx`, plus tests; `BacktestRechartsPane.tsx`.

- [ ] Write failing tests for acceptance items 4 and 7 (the rolling part), then implement the chart with its controls, reference lines and empty state. Commit.

### 4. Trade distribution panels

**Files:** new `TradeDistributionPanels.tsx` and per-panel components, plus tests; `BacktestRechartsPane.tsx`, `BacktestResultsTabs.tsx`.

- [ ] Write failing tests for acceptance items 5 and 7, then implement the histogram, scatter with trade focus, exit-reason bars and the time breakdown. Commit.

## Verification

- `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `pnpm build`.
- Browser check of the MSW web preview:
  - both sections at desktop and narrow widths, in the dark and light themes;
  - the window and metric toggles, and the scatter click to the Trade Chart;
  - a 10,000-trade fixture for responsiveness.

  Keep screenshots outside the repository.

- Review the whole change, then run `./work board set Q-125 in-review` with the results.
