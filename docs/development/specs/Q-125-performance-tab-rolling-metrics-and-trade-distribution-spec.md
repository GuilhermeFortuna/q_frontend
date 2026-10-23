# Q-125: Performance tab rolling metrics and trade distribution

**Status:** written spec awaiting human review; the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2) is the status of record.
**Batch:** 30 — Backtest performance analytics
**Depends on:** Q-124
**Implementation plan:** [Plan](../plans/Q-125-performance-tab-rolling-metrics-and-trade-distribution-plan.md)

## Purpose

Q-124's summary says how a strategy did overall. It cannot show:

- whether the edge holds over time or decays;
- whether P&L comes from a few outliers;
- whether long holds pay;
- which exits, weekdays or hours carry the result.

This task adds two sections to the Performance tab below Q-124's content: **Rolling metrics** and **Trade distribution**.

## Design references

- The QuantStats tearsheet: rolling Sharpe and volatility panels, and the returns distribution histogram.
- The TradingView Strategy Tester and MT5 report: P&L distribution and trade-duration views.
- The visual system: `DESIGN.md`, the Q-124 panel framing, and the `rechartsTheme` axes, grid and tooltip.

## Behaviour

### Rolling metrics

- One framed chart showing a rolling statistic over the last N closed trades, in exit order. The x-axis is the exit time of the window's last trade.
- Controls in the header:
  - a window `SegmentedToggle` of 20, 50 or 100 trades (default 50);
  - a metric `SegmentedToggle` of Win rate, Profit factor or Expectancy (default Expectancy).
- A dashed reference line marks the full-sample value from `performance.trades.all`.
- Expectancy is toned by sign about zero. Profit factor shows a neutral reference at 1.0.
- With fewer trades than the window, the chart shows an inline empty state: "Needs at least N closed trades". The window options larger than the trade count are disabled.
- A window with no losing trades produces a profit-factor gap (null), never a spike.

### Trade distribution

A responsive grid of four framed panels, two by two on desktop and stacked when narrow:

1. **P&L distribution**: a histogram of closed-trade P&L.
   - Bin edges are symmetric about zero, so no bin straddles it, and use the Freedman–Diaconis width clamped to 10–40 bins.
   - Bars are rose below zero and emerald above. Vertical markers show the mean and median.
   - The tooltip shows the range, count and share of trades.
2. **Holding time vs P&L**: a scatter of hold duration (log-scaled x) against P&L, with points toned by sign. The tooltip shows the trade id, side, entry time, hold and P&L. Clicking a point focuses that trade in the Trade Chart tab, using the existing Trade List behaviour.
3. **By exit reason**: horizontal bars of P&L per reason from `performance.exit_reasons`, labelled with trade count and win rate.
4. **By time**: a `SegmentedToggle` switches between weekday (Mon–Fri, plus Sat/Sun only if present) and entry hour.
   - Bars show total P&L; a secondary line shows win rate.
   - Buckets use the entry time in the app's display timezone, through the same helpers as `aggregateMonthlyStats`.

### Data and performance

- Rolling series, histogram bins, scatter points and time buckets are pure derivations from `trades` in `src/lib/backtesting/distribution.ts`. Exit-reason bars use `performance.exit_reasons`.
- Above `BACKTEST_WORKER_THRESHOLD` trades, the derivations run in the existing performance worker alongside the equity and monthly computations. Results equal the inline path.
- Without `performance`, the rolling chart omits its reference line and the exit-reason panel is hidden. The other panels still render from `trades`.
- With no closed trades, both sections show one empty state.

## Interfaces

- New: `src/lib/backtesting/distribution.ts`, which provides:
  - `rollingTradeStats(trades, window)`;
  - `pnlHistogram(trades)`;
  - `holdVsPnl(trades)`;
  - `breakdownBy(trades, 'weekday' | 'hour')`.
- New: `src/components/backtests/RollingMetricsChart.tsx`, `TradeDistributionPanels.tsx` and small per-panel components as needed.
- Modified:
  - `backtestPerformance.worker.ts`, `backtestPerformanceClient.ts` and `useBacktestPerformanceData.ts`, to return the derived series;
  - `BacktestRechartsPane.tsx`;
  - `BacktestResultsTabs.tsx`, for the scatter-to-trade focus.
- No backend, contract, PDF or `q_terminal` change.

## Focused acceptance

1. `rollingTradeStats` matches hand-computed values for each metric and window, and returns null profit factor for loss-free windows.
2. `pnlHistogram` never has a bin spanning zero, keeps the bin count within bounds, and its counts sum to the closed trades. The mean and median are correct.
3. `breakdownBy` buckets by display-timezone entry time (tested with `TZ=America/Sao_Paulo` around midnight UTC). `holdVsPnl` durations equal exit − entry.
4. Window controls disable options larger than the trade count, and the empty states render.
5. Clicking a scatter point opens the Trade Chart focused on that trade.
6. The worker and inline paths return identical derived series for the same input.
7. Without `performance`, the sections render as specified, without errors.
8. `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `pnpm build` pass. The bundle-splitting tests still pass.

Verification uses unit tests for the pure functions, component tests with the mock fixture, and a browser check of the MSW web preview. No backend, Tauri, Docker or GPU run is needed.

## Delivery boundary

- No MAE/MFE, R-multiple, or Monte Carlo and bootstrap analysis.
- No rolling Sharpe on daily equity and no user-defined window sizes.
- No change to the Monthly tab (a year × month return heatmap is a follow-up candidate), the PDF or CSV exports, or the comparison view.
