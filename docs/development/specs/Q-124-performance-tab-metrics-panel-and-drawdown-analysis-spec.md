# Q-124: Performance tab metrics panel and drawdown analysis

**Status:** written spec awaiting human review; the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2) is the status of record.
**Batch:** 30 — Backtest performance analytics
**Depends on:** Q-123
**Implementation plan:** [Plan](../plans/Q-124-performance-tab-metrics-panel-and-drawdown-analysis-plan.md)

## Purpose

The Backtests **Simulation › Results › Performance** tab has three parts:

- four KPI tiles: Total PnL, Win Rate, Total Trades and Max Drawdown;
- an equity curve;
- a separate drawdown chart.

Profit factor, expectancy, payoff, streaks, risk-adjusted returns, the long/short split and drawdown durations are not visible, though the PDF export already prints several of them. The equity tooltip also prints drawdown 100× too small: `EquityCurveChart` renders the `drawdownPct` fraction as a percent without scaling it.

This task makes the Performance tab a complete summary. It shows a grouped metrics panel from Q-123's `performance` object, linked equity and underwater charts, and a worst-drawdowns table. It keeps or improves the current visual quality.

## Design references

The layout follows established strategy reports, restyled in the Q system (`DESIGN.md`, `docs/design/visual-design-system.md`):

- The TradingView Strategy Tester **Performance Summary**, grouped as returns, risk and trade metrics, with All / Long / Short columns.
- The QuantStats tearsheet: the **underwater plot** beneath equity, and the **Worst 5 Drawdowns** table.
- The MetaTrader 5 Strategy Tester report: the profit factor, payoff, recovery and consecutive-trade groups.

The implementing agent records the reference screenshots it used in the review notes, not in the repository.

## Behaviour

### Layout

From the top, below the unchanged KPI tiles and tab bar:

1. **Metrics panel**: three equal columns that stack at narrow widths. Each column is a `GlowCard` (`intensity="card"`) holding a definition list styled like `KeyValueGrid`. Labels are `text-silver-400`; values are `tabular-nums` and right-aligned. A `SectionHeader`-style title row holds an All / Long / Short `SegmentedToggle` and a muted basis note: "Closed-trade equity · daily · 252/yr · rf 0".
   - **Returns:** net P&L, return %, CAGR, gross profit, gross loss, commission, trades per month.
   - **Risk:** max drawdown % and value, longest drawdown (days), average drawdown, recovery factor, Calmar, Sharpe, Sortino, annual volatility, time in market.
   - **Trade quality** (follows the toggle): trades, win rate (with W / L / BE counts), profit factor, expectancy, average win, average loss, payoff, largest win, largest loss, maximum consecutive wins and losses, average hold (all, winners, losers).
   - The toggle changes only the Trade quality column. Returns and Risk are portfolio-wide and say so in their header.
2. **Equity and underwater**: one framed card holding the existing equity chart above the drawdown chart.
   - The two charts share a time axis and a synchronized crosshair and tooltip, through a Recharts `syncId`.
   - The three deepest drawdown periods are shaded on the equity chart as low-opacity rose `ReferenceArea`s, from peak to recovery (or to the end if unrecovered).
   - The existing `Initial` capital line stays.
3. **Worst drawdowns**: a `DataTable` of `performance.drawdowns` with columns rank, depth %, depth value, peak, trough, recovery, duration (days) and trades.
   - An unrecovered period shows a muted **Open** badge.
   - Hovering a row emphasizes that period on both charts; leaving the row clears the emphasis.

### Values and formatting

- Currency, percent and ratio formats reuse `src/lib/backtesting/backtestMetricFormatters.ts` and the format kinds in `comparison.ts`. Hold times are formatted as `1d 4h`, `3h 12m` or `45m`.
- Tones follow `StatTile`: P&L-like values are emerald or rose by sign, drawdowns are rose, and neutral values are silver.
- A null value renders as "—". A null `profit_factor` with winners and no losers renders as "∞".
- Every metric label has a `Tooltip` with its one-line definition from the Q-123 spec.
- Tooltip drawdown in the equity chart shows `drawdownPct × 100`.

### Data availability

- `performance` comes from `BacktestResponse.performance` for both live and stored runs.
- When it is null or absent, the metrics panel and drawdown table are not rendered, and the charts render as today without shading.
- No metric is recomputed in the frontend.

### States and accessibility

- Rendering happens inside the existing lazy Performance boundary, so loading and retry behaviour is unchanged.
- The toggle is keyboard operable. The table rows are focusable, and focus triggers the same highlight as hover.
- Charts keep their existing dimensions, so the tab does not shift when data loads.

## Interfaces

- New: `src/components/backtests/BacktestPerformanceSummary.tsx` and `src/components/backtests/WorstDrawdownsTable.tsx`.
- New: `src/lib/backtesting/performanceSummary.ts`, which holds the metric definitions as rows (label, accessor, format, tone, tooltip) so the components stay declarative.
- Modified: `BacktestRechartsPane.tsx` (performance variant), `EquityCurveChart.tsx` (`syncId`, drawdown areas, highlight, tooltip fix), `DrawdownChart.tsx` (`syncId`, highlight), and `BacktestResultsTabs.tsx` (passes `performance`).
- Fixtures: `src/mocks/backtest.ts` gains a `performance` object.
- No backend, contract, PDF or `q_terminal` change.

## Focused acceptance

1. With `performance` present, the panel renders three groups with the specified rows and formats. All / Long / Short switches the Trade quality values.
2. Null ratios render as "—", and an all-winners `profit_factor` renders as "∞". Signed values carry the right tone.
3. The worst-drawdowns table lists the periods in order and shows **Open** for an unrecovered one. Hovering or focusing a row highlights its period on both charts.
4. The equity and drawdown charts share a synchronized tooltip, and the top three periods are shaded.
5. The equity tooltip shows a 5 % drawdown as `-5.00%`, as a regression test.
6. Without `performance`, the tab renders the current charts and nothing else, without errors.
7. `pnpm lint`, `pnpm typecheck`, `TZ=America/Sao_Paulo pnpm test:run` and `pnpm build` pass. The lazy-loading and bundle-splitting tests still pass.

Verification uses component tests with the mock fixture and a browser check of the MSW web preview at desktop and narrow widths. No backend, Tauri, Docker or GPU run is needed.

## Delivery boundary

- No rolling metrics or trade distribution; Q-125 covers them.
- No change to the KPI tiles, the Monthly, Trade Chart or Trade List tabs, the PDF or CSV exports, or the comparison view.
- No frontend metric computation and no user-configurable metric set.
