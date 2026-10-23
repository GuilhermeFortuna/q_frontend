# Q-124 implementation plan: Performance tab metrics panel and drawdown analysis

> **For implementation agents:** Read the linked specification and repository instructions. Launch only through `./work start Q-124 --agent <agent> --worktree` after written-plan approval and after Q-123 is Done. Implement natively; delegation requires separate authorization.

**Goal:** The Performance tab shows a grouped metrics panel, linked equity and underwater charts, and a worst-drawdowns table, all from Q-123's `performance` object.
**Architecture:** Declarative metric rows in `src/lib/backtesting/performanceSummary.ts` drive a presentational summary component. Charts share a Recharts `syncId`, and a hovered-period state lives in the Performance pane.
**Tech stack:** React 19, TypeScript, Tailwind v4 tokens, Recharts, Vitest and Testing Library, MSW.
**Spec:** [Specification](../specs/Q-124-performance-tab-metrics-panel-and-drawdown-analysis-spec.md)
**Status:** written plan awaiting human review.

## Global constraints

- Start from `development` with Q-123's vendored contract and `performance` type.
- Reuse `GlowCard`, `KeyValueGrid` styling, `SegmentedToggle`, `Tooltip`, `DataTable`, `chartTheme` and `rechartsTheme`. Add no new dependency or visual primitive.
- No metric math in components. Formatting and row definitions are pure and unit-tested.
- Tests run as `TZ=America/Sao_Paulo pnpm test:run`. Do not run the backend or Tauri.
- Commit focused units on the task branch; no push, merge or protected-branch checkout.

## Review focus

- Visual parity with the existing KPI tiles and chart frames: spacing, type scale and tokens, in both themes.
- Null and infinity rendering, and sign tones.
- Hover and focus highlighting stays in sync and does not re-render the full chart on every pointer move.
- The tab degrades cleanly without `performance`, and the bundle split is unchanged.

## Ordered implementation

### 1. Tooltip fix and fixtures

**Files:** `EquityCurveChart.tsx`, `tests/unit/components/EquityCurveChart.test.tsx`, `src/mocks/backtest.ts`.

- [ ] Write a failing test for acceptance item 5, fix the scaling, and add a `performance` fixture with long and short trades, an unrecovered drawdown and a null ratio. Commit.

### 2. Metrics panel

**Files:**

- New: `src/lib/backtesting/performanceSummary.ts` with tests, and `src/components/backtests/BacktestPerformanceSummary.tsx` with tests.
- Modified: `backtestMetricFormatters.ts` (hold-time format).

- [ ] Write failing tests for acceptance items 1 and 2.
- [ ] Implement the row definitions, formats, tooltips and side toggle, then wire the panel into `BacktestRechartsPane` behind `performance`. Commit.

### 3. Linked charts and the drawdowns table

**Files:**

- New: `src/components/backtests/WorstDrawdownsTable.tsx` with tests.
- Modified: `EquityCurveChart.tsx`, `DrawdownChart.tsx`, `BacktestRechartsPane.tsx`, `BacktestResultsTabs.tsx`.

- [ ] Write failing tests for acceptance items 3, 4 and 6.
- [ ] Add the shared `syncId`, the drawdown `ReferenceArea`s, the hovered-period state, the table with the Open badge, and keyboard focus. Commit.

## Verification

- `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `pnpm build`.
- Browser check of the MSW web preview:
  - the Performance tab at desktop and narrow widths, in the dark and light themes;
  - the toggle, tooltips, synchronized crosshair and row highlight;
  - a fixture without `performance`.

  Keep screenshots outside the repository.

- Review the whole change, then run `./work board set Q-124 in-review` with the results and the references used.
