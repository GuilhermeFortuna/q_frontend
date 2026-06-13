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

## Phase: Research Validation (next batch)

Turns the platform from a backtest runner into a research instrument — the defense against
overfitting. Today the Optuna optimizer reports in-sample results over a single range, and
trades/equity curves vanish after the HTTP response. This batch: persist per-run artifacts
to the Parquet lake (the schema's `lake_paths` column has waited since day one), add
walk-forward analysis (rolling optimize → out-of-sample test → stitched OOS equity +
efficiency ratio), give it a frontend workspace, and add cross-run comparison.

| #   | File                                                                             | Repo       | Depends on         |
| --- | -------------------------------------------------------------------------------- | ---------- | ------------------ |
| 22  | [WO22-backend-data-lake-artifacts.md](WO22-backend-data-lake-artifacts.md)       | q_backend  | —                  |
| 23  | [WO23-backend-walkforward-core.md](WO23-backend-walkforward-core.md)             | q_backend  | —                  |
| 24  | [WO24-backend-walkforward-api.md](WO24-backend-walkforward-api.md)               | q_backend  | WO22 + WO23 merged |
| 25  | [WO25-frontend-walkforward-workspace.md](WO25-frontend-walkforward-workspace.md) | q_frontend | WO24 contract      |
| 26  | [WO26-frontend-run-comparison.md](WO26-frontend-run-comparison.md)               | q_frontend | WO22 contract      |

### Dispatch order

```
WO22  ─┬─►  WO24  ──►  WO25
WO23  ─┘
WO22  ──►  WO26
```

WO22 and WO23 run **in parallel** (disjoint: lake module vs optimization core). WO24 wires
both into the API and must paste the full JSON contracts in its completion message — WO25
builds the entire frontend against that message. WO26 needs only WO22's artifact-endpoint
contract, so it can run alongside WO23/WO24.

### Batch-specific review checklist

1. Lake writes are **best-effort both ways**: a backtest/walk-forward run still succeeds
   with the lake unwritable, and artifacts are still written with Postgres stopped.
2. Did anything sneak **series/trades into Postgres**? (stitched equity and OOS trades go
   to the lake; window-level metrics JSON is summary metadata, allowed)
3. Walk-forward data loads **once per run** (`from_market_data_sliced`, call-count test),
   and the existing `from_market_data` is byte-for-byte unchanged.
4. **No leakage:** every OOS trade timestamp falls inside its window's test range, and test
   windows tile the history with no gaps/overlaps (the splitter tests prove it).
5. Runs predating WO22 return 404 for artifacts and degrade to a marked-but-functional UI
   state — never an error wall (WO26) or a crash (WO25 history).
6. Are the new tables/fields strictly **additive** — no existing response field changed
   shape, existing optimization/backtest tests untouched and green?
7. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Phase: Backtest Workbench (next batch)

Redesigns the Backtests page from a thin config sidebar into a strategy-first workbench.
Today a ~320px rail holds every input while the canvas shows "No Results Yet"; strategies
are a bare `<select>` despite the registry serving 9+ of them with descriptions. The
batch: move presentation metadata (category, thesis, regime notes, param hints) into the
strategy registry (backend), rebuild setup as a full-canvas strategy library + detail
panel + horizontal config band (frontend), then make setup and results two views of one
workbench — whichever pane the user clicks gets the stage while the other collapses to a
live teaser (collapsed setup = config digest + Run button; collapsed results = headline
metrics + equity sparkline), reversibly and without losing state on either side.

| #   | File                                                                   | Repo       | Depends on    |
| --- | ---------------------------------------------------------------------- | ---------- | ------------- |
| 27  | [WO27-backend-strategy-metadata.md](WO27-backend-strategy-metadata.md) | q_backend  | —             |
| 28  | [WO28-frontend-strategy-library.md](WO28-frontend-strategy-library.md) | q_frontend | WO27 contract |
| 29  | [WO29-frontend-focus-workbench.md](WO29-frontend-focus-workbench.md)   | q_frontend | WO28 merged   |

### Dispatch order

```
WO27  ──►  WO28  ──►  WO29
```

WO27 first (its completion message pastes one full strategy object from
`/api/v1/strategies` — WO28 types its fallbacks against it). WO28 may start in parallel if
needed, since it must degrade gracefully against a pre-WO27 backend anyway, but its detail
panel content can only be verified once WO27 merges. WO29 strictly after WO28 merges — it
replaces WO28's interim "Edit setup" strip and animates the sibling-pane layout WO28 is
required to leave behind.

### Batch-specific review checklist

1. Is the submitted `BacktestRequest` **byte-identical** to the old sidebar's for the same
   inputs? (WO28's `buildRequest()` snapshot test — candle and tick variants — is the
   proof; check it actually snapshots the full payload)
2. Is `/api/v1/strategies` strictly **additive** — existing backend tests pass unmodified,
   and the pre-WO28 frontend renders fine against the WO27 backend?
3. Does Optimizer → "Load into Backtest" still hydrate the new setup UI (strategy selected
   in the library, params merged, band populated)?
4. Is the Optimize workspace pixel-identical? (shared field components may gain layout
   props but defaults must not change)
5. Tick engine intact: engine filter still constrains the library, tick-only fields still
   appear, tick request payload unchanged.
6. WO29: both panes stay **mounted** through swaps (form state, results, and history
   selection survive), the collapsed setup strip can re-run without expanding, and
   `prefers-reduced-motion` gets an instant swap.
7. Did the agent actually run `pnpm test:run` / `uv run pytest` for real, or just claim
   green?

## Phase: Discovery — automatic strategy search (next batch)

Turns the platform from "optimize one strategy at a time" into "find the strategy." Today a
quant must hand-run the optimizer once per strategy, hand-write a search space each time, and
eyeball the results. This batch adds **automatic strategy search**: point it at an instrument

- date range and it sweeps every registered strategy, optimizes each, **walk-forward-validates
  each**, and returns a leaderboard ranked on out-of-sample performance — never in-sample. The
  whole feature is composition over what already exists (`WalkForwardRunner`, the registry, the
  job/Redis/Postgres/lake plumbing, the workspace shell); the new code is a search-space
  derivation, a candidate abstraction, an orchestrator, a job manager, and a workspace, each
  mirroring an existing sibling. Crucially the search is defined over a `CandidateProvider`
  **seam** so a later genetic-synthesis batch (option 2) drops in as a new provider without
  re-plumbing — WO34 designs that and confirms the seam.

| #   | File                                                                         | Repo       | Depends on    |
| --- | ---------------------------------------------------------------------------- | ---------- | ------------- |
| 30  | [WO30-backend-auto-search-space.md](WO30-backend-auto-search-space.md)       | q_backend  | —             |
| 31  | [WO31-backend-strategy-search-core.md](WO31-backend-strategy-search-core.md) | q_backend  | WO30          |
| 32  | [WO32-backend-strategy-search-api.md](WO32-backend-strategy-search-api.md)   | q_backend  | WO31          |
| 33  | [WO33-frontend-discovery-workspace.md](WO33-frontend-discovery-workspace.md) | q_frontend | WO32 contract |
| 34  | [WO34-genetic-search-design.md](WO34-genetic-search-design.md)               | docs       | WO31 seam     |

### Dispatch order

```
WO30  ──►  WO31  ──►  WO32  ──►  WO33
                 └──►  WO34 (design doc only)
```

Strictly sequential WO30→WO31→WO32→WO33 — each builds on the prior's contract. **WO31 must
paste the `StrategySearchConfig` / `CandidateResult` / `StrategySearchResult` / `SearchProgress`
field lists**; WO32 serializes them and **pastes the full JSON contracts** — WO33 builds the
entire frontend against that message. WO34 is a paper that can run any time after WO31 lands
(it only needs the seam to reason about), and it ships no code.

### Batch-specific review checklist

1. Is the leaderboard ranked on **out-of-sample** objective value (`resolve_objective` over
   `oos_metrics`), never in-sample? Is `MINIMIZE_DRAWDOWN` oriented so "higher robustness =
   better"?
2. Does the whole search load market data **once** (`from_market_data_sliced`, call-count
   spy), reusing the frame across every candidate's walk-forward?
3. Does a single failing/zero-trade/tick candidate get flagged (`error`/`no_result`/
   `unsupported`) **without aborting** the sweep?
4. Are gated candidates kept on the leaderboard (flagged, sorted below passing ones), never
   silently dropped?
5. Did WO30/WO31 **reuse `WalkForwardRunner` / `OptimizationRunner` unchanged** (no fork), and
   are the existing walk-forward + optimization tests green and untouched?
6. Does the search **complete with Postgres stopped** and **with the lake unwritable** (best
   effort both ways)? Did series/trades stay out of Postgres (lake only)?
7. Does "Send to Backtest/Optimizer" hydrate the target workspace via the existing
   `pendingBacktestConfig` / `pendingOptimizationConfig` seams?
8. Is multi-objective rejected (422 / `ValueError`) since ranking needs a scalar?
9. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Phase: Parallel Optimization (next batch)

Makes the Optimize tab use the whole machine. Today an Optuna study runs trials **strictly one
at a time** on a single core — the inner backtest is a pure-Python, GIL-bound bar loop, so
Optuna's thread-based `n_jobs` buys nothing, and a 50–200-trial study leaves a 16-core/32-thread
box ~97% idle. This batch parallelizes trials across **processes** using Optuna **ask/tell**:
the main process owns the study, sampler, progress, and persistence; worker processes run only
the backtests, sharing one in-memory OHLCV frame via a pool initializer. It is the direct
follow-on to the walk-forward window parallelization already shipped, and reuses that batch's
proven plumbing (`resolve_worker_count`, `DefaultBacktestRunner.load_sliced_frame` /
`from_frame_sliced`, the pool-initializer frame, the persist-before-flip finish ordering). The
one genuinely new design point is sampler quality under batched sampling (TPE `constant_liar`),
so — unlike walk-forward — parallel results are _comparable_, not byte-identical, to sequential.

| #   | File                                                                                     | Repo       | Depends on    |
| --- | ---------------------------------------------------------------------------------------- | ---------- | ------------- |
| 35  | [WO35-backend-parallel-optimization-core.md](WO35-backend-parallel-optimization-core.md) | q_backend  | —             |
| 36  | [WO36-backend-parallel-optimization-api.md](WO36-backend-parallel-optimization-api.md)   | q_backend  | WO35 contract |
| 37  | [WO37-frontend-parallel-optimization-ux.md](WO37-frontend-parallel-optimization-ux.md)   | q_frontend | WO36 contract |

### Dispatch order

```
WO35  ──►  WO36  ──►  WO37
```

Strictly sequential. WO35 builds the compute core and **must paste the changed
`OptimizationRunner` signature, the worker return contract, and where `resolve_worker_count`
now lives** — WO36 wires the job layer against it. WO36 **must paste the request body (with
`study.max_workers`) and the status payload (with `workers`)** — WO37 builds the UI against
that message. WO37 is frontend-only and must degrade cleanly against a pre-WO36 backend.

### Batch-specific review checklist

1. Is the **sequential path the byte-for-byte default** when no frame is supplied (no
   `max_workers`, or `=1`, or an injected runner, or the tick engine)? Existing optimization
   tests green and unmodified?
2. Does the parallel path **load market data once** per study (`load_sliced_frame` on the
   request thread, call-count spy), reusing the frame across every trial?
3. Is the worker the **only** thing that runs the backtest, with param suggestion (`ask` +
   `suggest_params`) and `tell` kept in the main process so the sampler advances correctly?
4. Is `TPESampler(constant_liar=True)` used in the parallel path, and is it documented that
   parallel results are **comparable, not identical** (tests assert best ≥ sequential − ε,
   never byte-equality)?
5. Do parallel best trials carry the **same `user_attrs` contract**
   (`strategy_params`/`risk_params`/`metrics`) that walk-forward and results serialization
   read?
6. Is the engine's inner `parallel_mode` forced **SEQUENTIAL** in workers (no nested
   `ProcessPoolExecutor`)? Is the **tick engine** kept sequential (no tick arrays shipped
   across processes)?
7. Was the **finish race fixed** in `optimization_jobs._run_job` (persist with terminal
   status, _then_ flip `job.status`), matching the walk-forward fix, with a restart-rebuild
   test that catches it?
8. Does the study **complete with Postgres stopped** (best-effort persistence), and does
   cancel end the run cleanly with no further trials asked?
9. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Review checklist (apply to every returned PR)

1. Does the compute path still work with Postgres **stopped**? (stop the container, run a backtest / a study)
2. Are new id fields (`run_id`, `study_id`) strictly **additive** — did any existing response field change shape?
3. Did anything sneak **trades / bars / indicator series into Postgres**? (must not — series belong in the Parquet lake, WO22+)
4. Did background threads use `session_scope()` and **not** a request-scoped session?
5. Did the agent actually **run the stated verification command**, or just claim green?
