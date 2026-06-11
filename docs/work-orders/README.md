# Phase A — Wire Persistence · Work Orders

These are self-contained task prompts to hand to coding agents. Each file includes its
own shared-context header, so an agent can act on one file with no other knowledge of
the project.

## Goal of Phase A

The backend has a fully-written persistence layer (`src/q_backend/storage/db/`) —
SQLAlchemy models, an Alembic migration, and a `repositories.py` of `create_*`/`update_*`
functions — but the API never imports any of it. Backtests and Optuna studies run
ephemerally and vanish on restart. Phase A **wires the existing persistence in** (it is
mostly plumbing, not new design) and surfaces run/study history in the UI.

## Work orders

| #   | File                                                                               | Repo       | Depends on                   |
| --- | ---------------------------------------------------------------------------------- | ---------- | ---------------------------- |
| 1   | [WO1-backend-backtest-persistence.md](WO1-backend-backtest-persistence.md)         | q_backend  | —                            |
| 2   | [WO2-frontend-backtest-history.md](WO2-frontend-backtest-history.md)               | q_frontend | WO1 contract                 |
| 3   | [WO3-backend-optimization-persistence.md](WO3-backend-optimization-persistence.md) | q_backend  | WO1 (deps.py, repo patterns) |
| 4   | [WO4-frontend-optimization-history.md](WO4-frontend-optimization-history.md)       | q_frontend | WO3 contract                 |

## Dispatch order

```
WO1  ──►  WO2  ┐
          WO3  ┴──►  WO4
```

WO1 first. Once it merges, WO2 and WO3 can run **in parallel** (both depend only on
WO1's `deps.py` + endpoint contracts). WO4 last, after WO3's contract is final.

## Phase: Strategy Library (next batch)

Makes strategies pluggable and broadens the library beyond the single MA crossover.
The optimization layer is already strategy-agnostic and indicators auto-render, so the
work is a registry + strategies + a schema endpoint (backend) and schema-driven param
forms (frontend).

| #   | File                                                                 | Repo       | Depends on   |
| --- | -------------------------------------------------------------------- | ---------- | ------------ |
| 5   | [WO5-backend-strategy-registry.md](WO5-backend-strategy-registry.md) | q_backend  | —            |
| 6   | [WO6-frontend-strategy-forms.md](WO6-frontend-strategy-forms.md)     | q_frontend | WO5 contract |

Dispatch WO5 first; WO6 builds its forms against WO5's `GET /api/v1/strategies` schema.

## Phase: Market Terminal (next batch)

Upgrades the Market page (`src/workspaces/market-data/MarketDataWorkspace.tsx`) into a
Bloomberg-style terminal. Today the watchlist shows hardcoded mock prices, the snapshot
carries only `last/changePct/volume`, nothing polls, and the page is one ~820-line
component. The batch: enrich the data layer (backend), make every price real and live,
decompose + add a resizable panel layout, fill it with quote/tape/instrument panels, then
a polish pass.

| #   | File                                                                 | Repo       | Depends on          |
| --- | -------------------------------------------------------------------- | ---------- | ------------------- |
| 7   | [WO7-backend-market-quotes.md](WO7-backend-market-quotes.md)         | q_backend  | —                   |
| 8   | [WO8-frontend-live-quotes.md](WO8-frontend-live-quotes.md)           | q_frontend | WO7 contract        |
| 9   | [WO9-frontend-terminal-layout.md](WO9-frontend-terminal-layout.md)   | q_frontend | WO8 merged          |
| 10  | [WO10-frontend-market-panels.md](WO10-frontend-market-panels.md)     | q_frontend | WO7 contract + WO9  |
| 11  | [WO11-frontend-terminal-polish.md](WO11-frontend-terminal-polish.md) | q_frontend | WO9 (WO10 optional) |

### Dispatch order

```
WO7  ──►  WO8  ──►  WO9  ──►  WO10
                          └──►  WO11
```

WO7 first (its completion message must paste the JSON contracts — WO8/WO10 build against
them). WO8 next, kept surgical so the WO9 refactor rebases cleanly. After WO9 merges,
WO10 and WO11 can run **in parallel**: WO10 owns `DetailZone.tsx` and its tab panels,
WO11 owns the watchlist/palette/ribbon — disjoint files by design.

### Batch-specific review checklist

1. Is `mockPrices` fully gone after WO8? (`grep -r mockPrices src/`)
2. Does an MT5-offline 503 degrade to a status pill + stale quotes, never an error wall?
3. Are the WO7 legacy snapshot fields (`symbol/last/changePct/volume`) byte-compatible?
4. Did hidden DetailZone tabs stop polling (no `/ticks` requests while TAPE inactive)?
5. Did the agent run `pnpm test:run` / `uv run pytest` for real, or just claim green?

## Phase: Tick-Data Backtest Engine (next batch)

Adds a **second backtest engine** alongside the candle engine. The candle engine fills every
signal at the _next bar's open_ and can't resolve intrabar events (which hit first inside a
bar — the stop or the target?) or model the bid/ask spread. The tick engine simulates fills at
true MT5 tick resolution with a real intrabar order system (stop-loss / take-profit /
opposite-signal exits), buying at ask and selling at bid. Design decisions locked in:
intrabar SL/TP precision, **tick-native** indicators, a **Numba-JIT** (or pure-NumPy fallback)
hot loop, and a **new `TickStrategy` interface**. The dominating constraint is performance —
1–4M ticks/month means the hot path stays columnar (NumPy end to end, no per-tick Python
objects) and the inner loop is compiled.

| #   | File                                                                           | Repo       | Depends on                      |
| --- | ------------------------------------------------------------------------------ | ---------- | ------------------------------- |
| 12  | [WO12-backend-tick-data-loader.md](WO12-backend-tick-data-loader.md)           | q_backend  | — (resolves numba/numpy compat) |
| 13  | [WO13-backend-tick-engine-core.md](WO13-backend-tick-engine-core.md)           | q_backend  | WO12 contract                   |
| 14  | [WO14-backend-tick-backtest-api.md](WO14-backend-tick-backtest-api.md)         | q_backend  | WO13 contract                   |
| 15  | [WO15-frontend-tick-engine.md](WO15-frontend-tick-engine.md)                   | q_frontend | WO14 contract                   |
| 16  | [WO16-backend-tick-optimization.md](WO16-backend-tick-optimization.md)         | q_backend  | WO13 + WO14                     |
| 17  | [WO17-frontend-optimize-tick-engine.md](WO17-frontend-optimize-tick-engine.md) | q_frontend | WO16 merged                     |

### Dispatch order

```
WO12  ──►  WO13  ──►  WO14  ──►  WO15
                            └──►  WO16  ──►  WO17
```

Strictly sequential through WO14 — each builds on the prior's contract. **WO12 must resolve
the Numba/NumPy compatibility verdict first** (it decides whether WO13's kernel uses `@njit`
or a pure-NumPy fallback) and paste the columnar loader's array contract in its completion
message. WO13 pastes the `TickStrategy` interface + kernel trade-event contract; WO14 pastes
the tick request/response JSON. After WO14 merges, WO15 (single-run backtest toggle) and WO16
(tick optimizer backend) can run **in parallel** — disjoint repos. WO17 brings the tick engine
to the _optimizer form_ (the follow-up WO15 deferred); it needs WO16's backend to accept tick
optimization configs.

### Batch-specific review checklist

1. Are tick arrays **columnar end to end**? (no `List[Tick]` / per-tick Pydantic in the engine
   path — the only Pydantic objects are closed `Trade`s, one per trade not per tick)
2. Did WO12 **avoid downgrading NumPy/pandas** to satisfy Numba, and is the verdict recorded
   in `q_backend/docs/tick-engine-deps.md`?
3. Do buys/long-entries pay the **ask** and sells/long-exits receive the **bid**? (a round-trip
   with a non-zero spread must lose the spread — the whole accuracy point)
4. Is the **candle path byte-for-byte unchanged**? (`engine` defaults to `"candle"`; existing
   backtest/optimization tests green and unmodified)
5. Did anything sneak **ticks / bars / trades into Postgres**? (must not — only run row +
   config + `result_summary`; `timeframe:"TICK"` is just a string in the JSON config)
6. Does WO16 load ticks **once per study** and reuse across all trials (never refetch in
   `run()`), proven by a call-count test?
7. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Phase: Academic Strategy Library (next batch)

Implements strategies from published academic papers selected for fit with the candle
engine's closed-bar / next-bar-open contract (see the deep-research report,
`Academic Trading Papers That Fit an OHLCV Python Backtester`). The batch deliberately
takes only the **single-instrument-compatible** subset: Lai–Lau (2006) technical rule
families and a per-instrument adaptation of time-series momentum (Moskowitz–Ooi–Pedersen
2012 / Baltas–Kosowski 2017). Cross-sectional papers (Miffre–Rallis quintile momentum,
Hurst multi-market blend) and pairs/stat-arb papers (Gatev, Do–Faff, Avellaneda–Lee)
require a multi-asset portfolio engine and are **deferred**. The batch also closes the
platform's biggest realism gap first: a transaction cost model (every backtest today is
gross of costs).

| #   | File                                                                               | Repo       | Depends on               |
| --- | ---------------------------------------------------------------------------------- | ---------- | ------------------------ |
| 18  | [WO18-backend-transaction-costs.md](WO18-backend-transaction-costs.md)             | q_backend  | —                        |
| 19  | [WO19-backend-lai-lau-technical-rules.md](WO19-backend-lai-lau-technical-rules.md) | q_backend  | — (WO18 for net results) |
| 20  | [WO20-backend-tsmom-inverse-vol.md](WO20-backend-tsmom-inverse-vol.md)             | q_backend  | — (WO18 for net results) |
| 21  | [WO21-frontend-costs-and-vol-sizer.md](WO21-frontend-costs-and-vol-sizer.md)       | q_frontend | WO18 + WO20 contracts    |

### Dispatch order

```
WO18  ─┬─►  WO21
WO19   │
WO20  ─┘
```

WO18, WO19, and WO20 are mutually independent and can run **in parallel** (WO19/WO20 are
pure strategy/sizer additions; WO18 owns the engine's fill/close paths — if run
concurrently with WO19/WO20, merge WO18 first since it touches `engine.py` most). WO21
last: it builds forms against the JSON contracts pasted in WO18's and WO20's completion
messages.

### Batch-specific review checklist

1. With `costs` omitted / both zero, are existing backtest results **byte-identical**?
   (run a pre-existing engine test scenario both ways)
2. Does every close path pay the exit side exactly once? (force-close, pending exit,
   end-of-day, end-of-chunk)
3. Do WO19/WO20 strategies pass `test_strategy_causality.py` (auto-applies on
   registration), and were no engine semantics changed to accommodate them?
4. Is the `size_signal` change strictly additive (existing sizers ignore the new kwarg)?
5. Does the optimizer thread `costs` into every trial, so studies select on **net** PnL?
6. Do FMA/TRB holding periods count **bars**, not calendar days?
7. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Review checklist (apply to every returned PR)

1. Does the compute path still work with Postgres **stopped**? (stop the container, run a backtest / a study)
2. Are new id fields (`run_id`, `study_id`) strictly **additive** — did any existing response field change shape?
3. Did anything sneak **trades / bars / indicator series into Postgres**? (must not — that's a later data-lake phase)
4. Did background threads use `session_scope()` and **not** a request-scoped session?
5. Did the agent actually **run the stated verification command**, or just claim green?
