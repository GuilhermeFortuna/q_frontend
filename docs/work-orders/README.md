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

## Phase: Generative Discovery (next batch)

Turns the platform from "find the best of the strategies we _wrote_" into "**invent** the
strategy." Today Discovery (WO30–WO33) sweeps the ~10 hand-coded registry strategies, optimizes

- walk-forward-validates each, and ranks on out-of-sample. This batch adds **genetic strategy
  synthesis**: a JSON **genome DSL** composes indicator/rule primitives into novel strategies, a
  `CompositeStrategy` interprets them under the existing closed-bar contract, and a
  `GeneticCandidateProvider` evolves structure (selection/crossover/mutation) while Optuna + the
  walk-forward runner optimize each genome's numeric params. It is **composition over the WO31
  seam** — WO34 confirmed `evaluate_candidate` / `WalkForwardRunner` / `OptimizationRunner` need
  **zero** semantic change; the new code is a DSL, an interpreter, a provider, a ~40-line
  orchestrator, and additive UI. Because evolving thousands of genomes is a multiple-testing
  trap, the **overfitting defense ships with it, not after**: a Deflated Sharpe Ratio correction
  over the effective trial count, a held-out **lock-box** the champion is tested on exactly once,
  and a parsimony penalty. Full design: [`../design/genetic-strategy-search.md`](../design/genetic-strategy-search.md).

| #   | File                                                                                           | Repo       | Depends on       |
| --- | ---------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| 38  | [WO38-backend-genome-dsl-interpreter.md](WO38-backend-genome-dsl-interpreter.md)               | q_backend  | WO31 (read-only) |
| 39  | [WO39-backend-genetic-provider-orchestrator.md](WO39-backend-genetic-provider-orchestrator.md) | q_backend  | WO38             |
| 40  | [WO40-backend-dsr-lockbox-persistence.md](WO40-backend-dsr-lockbox-persistence.md)             | q_backend  | WO39 + WO32      |
| 41  | [WO41-frontend-discovery-genetic-mode.md](WO41-frontend-discovery-genetic-mode.md)             | q_frontend | WO40 + WO33      |

### Dispatch order

```
WO38  ──►  WO39  ──►  WO40  ──►  WO41
```

Strictly sequential — each builds on the prior's contract. **WO38 is the riskiest** (DSL
correctness) and must paste the `Genome`/`GenomeNode`/`NodeParam` field lists, the v1 primitive
allowlist with output-type tags, the `GENOME_PARAM_BOUNDS` table, and the
`derive_genome_search_space` return shape — WO39 evolves these and WO41 renders them. WO39
pastes the `GeneticSearchConfig` fields, the extended `SearchProgress`, and the
`select_search_orchestrator` switch. WO40 **must paste the full JSON contracts** (genetic
request body, generation-aware status, genome/DSR/lock-box results) — WO41 builds the entire
frontend against that message and must degrade cleanly against a pre-WO40 backend.

### Batch-specific review checklist

1. Is the **registry sweep byte-identical**? With `genetic` omitted and `lockbox.enabled=False`,
   the request, compute path, persistence, and API payloads must match WO30–WO33 exactly (snapshot
   both ways). Frontend registry-sweep Discover stays **pixel-identical**.
2. Did WO38 **reuse the registry's indicator math verbatim** (every `ind.*` calls the same
   `compute_*` the registry strategy calls — no new EMA/RSI/MACD), and is **every** registry
   strategy backtest-parity-tested against its equivalent genome (identical signals)?
3. Is the genome **causal by construction** — `shift.bars` hard-locked to 1, no centered windows,
   validation rejecting look-ahead **before** any backtest — and does `CompositeStrategy` pass
   `test_strategy_causality.py` for a canonical **and** N random valid genomes?
4. Did genetic search **change nothing** in `evaluate_candidate` / `WalkForwardRunner` /
   `OptimizationRunner` / `StrategySearchRunner` (the seam's whole premise)? New code = provider +
   orchestrator + additive config only?
5. Does the whole genetic run **load market data once** (`from_market_data_sliced`, call-count
   spy) across every genome of every generation, **and** reuse that frame for the lock-box backtest?
6. Is selection **OOS-only** (`robustness_score`, never in-sample), with the parsimony penalty
   applied and `MINIMIZE_DRAWDOWN` oriented so higher fitness = more robust? Is the run
   **deterministic** under `init_seed`?
7. **No lock-box leakage:** every WF test-window timestamp falls strictly before the lock-box
   start; the champion is evaluated on the lock-box **exactly once**, no re-optimization (date
   assertions prove it). Does DSR **decrease** as `total_genomes_evaluated` rises?
8. Are all new DB/lake/payload fields strictly **additive** (nullable columns / optional JSON
   keys), and does a genetic run **complete with Postgres stopped and the lake unwritable** (best
   effort both ways)? Did genomes-as-summary stay in Postgres while series/trades go to the lake?
9. Does WO41 **degrade against a pre-WO40 backend** (missing genome/DSR/lock-box fields → normal
   leaderboard, no crash), and does "Send to Backtest/Optimizer" promote a genome via the existing
   `pendingBacktestConfig` / `pendingOptimizationConfig` seams?
10. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Phase: Feature Engine (historical plan; superseded by WO158-WO162)

> **Current status:** WO42-WO46 captured the original feature-engine direction but were not implemented
> against the later Feature Store, neural-latent, score-biased, and adaptive-GA architecture. Do not
> dispatch these documents as written. WO158-WO162 supersede their implementation details while
> preserving the causal-feature and leakage-boundary intent.

Turns Generative Discovery from "recombine the ~8 indicators we wrote" into "**invent the features**
edge actually lives in." A genetic algorithm can only rearrange the primitives the grammar exposes
(today price sources + ~8 indicators + comparisons/logic), so the discovery ceiling is set by the
**feature vocabulary, not the search operator**. This batch widens that vocabulary with
economically-motivated, **causal-by-construction** primitive families — normalization transforms,
B3 session/calendar gates, volatility/trend regime, and **cross-asset-as-feature** (read WDO /
overnight ES / PETR4–VALE3 while trading one symbol, no capital required) — and then adds a
**feature-discovery layer** that mines compositions and promotes only those surviving **purged
out-of-sample IC + cross-fold stability + de-duplication + null-floor deflation** on a dedicated
discovery segment the GA never trains on. Finally it seeds validated features into the GA and adds
diversity-aware selection so a run yields a **book of low-correlation single-symbol strategies**.
Scope is deliberately **single-instrument** (B3 focus) — portfolio/cross-sectional stays deferred.
Full design: [`../design/feature-engine.md`](../design/feature-engine.md).

| #   | File                                                                                                 | Repo      | Depends on            |
| --- | ---------------------------------------------------------------------------------------------------- | --------- | --------------------- |
| 42  | [WO42-backend-feature-primitive-substrate.md](WO42-backend-feature-primitive-substrate.md)           | q_backend | WO38/WO39 (read)      |
| 43  | [WO43-backend-session-regime-features.md](WO43-backend-session-regime-features.md)                   | q_backend | WO42                  |
| 44  | [WO44-backend-exogenous-cross-asset-features.md](WO44-backend-exogenous-cross-asset-features.md)     | q_backend | WO42                  |
| 45  | [WO45-backend-feature-discovery-validation.md](WO45-backend-feature-discovery-validation.md)         | q_backend | WO42 (WO43/44 enrich) |
| 46  | [WO46-backend-feature-ga-integration-diversity.md](WO46-backend-feature-ga-integration-diversity.md) | q_backend | WO45 + WO39           |

### Dispatch order

```
WO42 ─┬─►  WO43 ─┐
      └─►  WO44 ─┴─►  WO45  ──►  WO46
```

WO42 first — it establishes the canonical "five seams to add a primitive" contract and refactors the
**hardcoded** operator pools (today `_mutate_add_node` only ever adds `ind.ma/ema/rsi`) into
category-driven pools so WO43/WO44 primitives are reachable by the GA for free. **WO42 must paste the
updated `NodeSpec` fields + the category-pool helper signatures** — WO43/WO44 add primitives against
that exact contract. WO43 (session/regime) and WO44 (exogenous) are independent enrichments that run
**in parallel** after WO42. **WO45 must paste the `FeatureDiscoveryConfig` + three-way-split bounds +
`FeatureDefinition` shapes** — WO46 seeds the GA against them. A frontend WO47 (discovered-feature
panel, IC stability, book correlation) is a deferred follow-up — this batch is discovery capability,
not UI.

### Batch-specific review checklist

1. Is every new primitive **causal by construction** (value at bar _i_ uses only bars ≤ _i_; no
   centered windows, no contemporaneous-future exogenous reads), and does `CompositeStrategy` keep
   passing `test_strategy_causality.py` for a canonical **and** random genomes including the new kinds?
2. Are the new kinds actually **reachable** by the GA (drawn by `_mutate_add_node` /
   `build_random_genome`), not dead primitives? (random-genome sampling test asserts each appears)
3. **Disabled = byte-identical**: with no new kinds in a genome, `exogenous=[]`, feature discovery
   off, `seed_features=[]`, and `diversity_lambda=0`, the run / persistence / payloads match the
   pre-batch snapshot, and the three-way split collapses to the WO40 two-segment lock-box split.
4. **No leakage across the three-way split**: feature IC/stability/dedup computed **only** on the
   front discovery segment; WF test windows strictly inside the middle; lock-box is the tail
   (date-assertion tests). A planted lookahead feature has high naive IC but **fails** the
   purged/stability gate.
5. Does **deflation bite** — more candidates tried → higher null floor → lower `ic_deflated`
   (monotonicity test, mirroring `test_dsr.py`)?
6. Is the project **single-instrument** throughout — exogenous symbols are **features, never
   positions** (the engine still trades only `backtest.symbol`)?
7. Is data loaded **once per symbol per run** (primary + each exogenous via `get_ohlcv`, call-count
   spy), with exogenous columns riding the reused `from_frame_sliced` frame?
8. Did the batch **change nothing** in `evaluate_candidate` / `WalkForwardRunner` /
   `OptimizationRunner` (new code = primitives + discovery module + provider/operator + additive
   config/persistence), and is the run **deterministic** under its seeds?
9. Best-effort persistence both ways (lake unwritable / Postgres stopped) for feature-discovery
   artifacts and the book summary?
10. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Phase: Local Data Store (next batch)

Makes the platform run **with or without MetaTrader 5** so it can be developed on **Linux**,
where MT5 does not exist. Today every market-data read funnels through one MT5 wrapper
(`MarketDataService`) and `import MetaTrader5` is a top-level import in three modules — so the
backend can't even boot on Linux. This batch turns that single seam into a **provider router**
(`auto` / `mt5` / `local`, a persisted setting on the System page), makes the MT5 import
optional, and adds a **portable local parquet store** of market data (`data/market/`,
self-describing `catalog.json`, copy-the-folder portability for the USB workflow). A new
**Storage** workspace fetches data from MT5 on Windows and writes it to the store; on Linux the
app reads the same store with `local` selected. Phase A ships OHLCV (candle engine offline);
Phase B (WO50–WO51) adds ticks (tick engine offline).

| #   | File                                                                                                   | Repo       | Depends on        |
| --- | ------------------------------------------------------------------------------------------------------ | ---------- | ----------------- |
| 47  | [WO47-backend-market-data-provider-abstraction.md](WO47-backend-market-data-provider-abstraction.md)   | q_backend  | —                 |
| 48  | [WO48-backend-local-ohlcv-store-and-ingestion.md](WO48-backend-local-ohlcv-store-and-ingestion.md)     | q_backend  | WO47 contract     |
| 49  | [WO49-frontend-storage-workspace.md](WO49-frontend-storage-workspace.md)                               | q_frontend | WO47 + WO48       |
| 50  | [WO50-backend-local-tick-store-and-ingestion.md](WO50-backend-local-tick-store-and-ingestion.md)       | q_backend  | WO48              |
| 51  | [WO51-frontend-storage-tick-support.md](WO51-frontend-storage-tick-support.md)                         | q_frontend | WO49 + WO50       |

### Dispatch order

```
WO47  ──►  WO48  ─┬─►  WO49  ──────────►  WO51
                  └─►  WO50  ──►  WO51
```

Strictly WO47→WO48 first (each pastes its contract: WO47 the `MarketDataProvider` interface +
`/system/data-source` JSON; WO48 the four `/storage/*` shapes + catalog layout). After WO48,
WO49 (Storage UI + System data-source card) and WO50 (tick backend) run **in parallel** —
disjoint repos. WO51 last: it needs WO49's Storage workspace and WO50's `kind`-tagged tick
contract.

### Batch-specific review checklist

1. Does the backend **import and boot with `MetaTrader5` uninstalled** (no top-level `mt5.*`
   left — timeframes and tick flags resolved lazily), and is behavior **identical** when MT5 is
   present (all 21 timeframes resolve to the same constants)?
2. Does **every** market-data read still funnel through `MarketDataService` (engines/workers/
   `backtest_runner` call sites unchanged), with the provider chosen by the `auto/mt5/local`
   setting read **per-process** (workers see the change without a restart)?
3. Is the OHLCV store **idempotent on overlap** (re-ingest doesn't duplicate bars; catalog
   start/end/rows stay correct) and **portable** (copy `data/market` / repoint
   `Q_MARKET_DATA_ROOT` → inventory + a `local` backtest still work)?
4. Does a candle backtest in `local` mode run with **zero MT5 calls** (spy proves it), and does
   a tick backtest with no stored ticks **degrade with a clear "ingest ticks" error**, not a 500?
5. Is `ingest` gated on MT5 availability (you can't fill the store from a machine with no
   broker), while inventory/delete/read work **without** MT5?
6. Do live-only UI features (snapshots, recent ticks, time & sales, broker symbol search) in
   `local` mode **degrade** (empty/disabled, catalog-backed search) rather than throw?
7. Are ticks stored in the **existing `COLUMNAR_TICK_KEYS` schema/dtypes** (WO50), and is the
   columnar contract the engine consumes unchanged?
8. Are all new fields/endpoints strictly **additive** (health/ catalog `kind`), with existing
   market-data/backtest tests green and unmodified?
9. Is `MetaTrader5` now an **optional/Windows-only** dependency so `uv sync` succeeds on Linux,
   while still installing on Windows?
10. Did the agent actually run `uv run pytest` / `pnpm test:run`, or just claim green?

## Phase: Exit-Driven Discovery (next batch)

Makes exit logic a first-class discovery surface. Today Discovery can rank entries and genetic
structures, and the app has a rich exit-rule catalog, but automated search does not deliberately ask
"is the interesting part the exit?" This batch expands registry Discovery over curated exit presets,
lets genetic search seed/mutate exit policies independently of entries, computes exit-quality
diagnostics from OOS trades, and surfaces those diagnostics in Discover.

| #   | File                                                                                                 | Repo       | Depends on         |
| --- | ---------------------------------------------------------------------------------------------------- | ---------- | ------------------ |
| 79  | [WO79-backend-discovery-exit-preset-candidates.md](WO79-backend-discovery-exit-preset-candidates.md) | q_backend  | WO66 + WO31        |
| 80  | [WO80-backend-genetic-exit-policy-mutation.md](WO80-backend-genetic-exit-policy-mutation.md)         | q_backend  | WO39 + WO55 + WO66 |
| 81  | [WO81-backend-exit-quality-analytics.md](WO81-backend-exit-quality-analytics.md)                     | q_backend  | WO79 and/or WO80   |
| 82  | [WO82-frontend-discovery-exit-insights.md](WO82-frontend-discovery-exit-insights.md)                 | q_frontend | WO81 contract      |

### Dispatch order

```
WO79 ─┬─► WO81 ──► WO82
      └─► WO80 ─┘
```

WO79 and WO80 are independent backend tracks after the existing exit catalog and genetic operator
work. WO79 is the smaller first win: registry strategies get exit-preset variants without touching
genome operators. WO80 makes genetic search mutate exit policies directly. WO81 can start after one
of those lands but is most useful after both, because it explains which exits improved OOS behavior.
WO82 is frontend-only and must degrade against pre-WO81 payloads.

### Batch-specific review checklist

1. With exit-driven discovery configs omitted, is registry Discovery byte-compatible with the
   current WO31/WO32 path?
2. Are candidate exits searched on/off (`low == 0` for enable/magnitude params), not forced on?
3. Are non-candidate exits pinned off for interpretability when a candidate is named after one
   preset/policy?
4. Do exit-only genetic mutations preserve entry refs and remain deterministic under `init_seed`?
5. Are exit-quality diagnostics computed from stitched OOS trades only, with no in-sample leakage?
6. Do diagnostics stay optional/additive through live payloads, DB rebuilds, and old rows?
7. Does the frontend keep promote-to-backtest/optimizer payloads clean of diagnostic-only fields?
8. Did the agent actually run `uv run pytest` / `pnpm test:run` / typecheck/build as specified, or
   just claim green?

## Phase: Exit-Driven Discovery Follow-ups

Closes review findings from the first WO79-WO82 implementation pass. The backend work makes genetic
exit-policy metadata survive distributed execution and result reloads, and removes a duplicated OHLCV
load introduced by exit-quality diagnostics. The frontend work exposes the backend's exit-search knobs
in the Discover request flow and isolates an unrelated background-rendering rewrite from the exit
feature branch.

| #   | File                                                                                                                     | Repo       | Depends on         |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------ |
| 83  | [WO83-backend-discovery-exit-policy-metadata-persistence.md](WO83-backend-discovery-exit-policy-metadata-persistence.md) | q_backend  | WO80 + WO82 review |
| 84  | [WO84-backend-discovery-ohlcv-load-reuse.md](WO84-backend-discovery-ohlcv-load-reuse.md)                                 | q_backend  | WO81               |
| 85  | [WO85-frontend-discovery-exit-search-controls.md](WO85-frontend-discovery-exit-search-controls.md)                       | q_frontend | WO79 + WO80 + WO81 |
| 86  | [WO86-frontend-quant-background-scope-cleanup.md](WO86-frontend-quant-background-scope-cleanup.md)                       | q_frontend | WO82 review        |

### Dispatch order

```
WO83 ─┐
WO84 ─┼─► WO85
WO86 ─┘
```

WO83 and WO84 are independent backend fixes and can run in parallel. WO85 can start after the backend
request contracts from WO79-WO81 are stable, but should be reviewed after WO83 so genetic exit labels
survive reloads. WO86 is independent and should be handled separately from exit feature work to keep
the branch scope clean.

### Batch-specific review checklist

1. Does a distributed genetic candidate with an exit policy expose the same `exit_policy_*` fields in
   live results and DB-reloaded history results?
2. Do old strategy-search candidate rows with null/missing policy columns still serialize safely?
3. Does each distributed candidate worker load OHLCV once for the runner and exit diagnostics, proven
   by a call-count test?
4. Does the frontend send `exit_presets.enabled` only in registry mode and genetic exit seeding only
   under `genetic`?
5. With all new frontend toggles off, is the Discover request body behavior unchanged?
6. Was the `QuantBackground.tsx` rewrite either reverted out of this workstream or verified with
   typecheck/build and visual evidence?
7. Did the agent actually run the stated `uv` / `pnpm` verification commands, or just claim green?

## Phase: Constrained AI Strategy Builder

Adds a constrained AI authoring layer inside the existing Backtests `StrategyStudio`. The model does
not generate executable code. It translates natural language into a typed `StrategySpec`, the backend
validates it against generated capabilities, and a deterministic compiler maps it into Q's existing
runtime (`CompositeStrategy` genome or built-in strategy config).

| #   | File                                                                                             | Repo                   | Depends on          |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------- | ------------------- |
| 90  | [WO90-backend-ai-capability-registry.md](WO90-backend-ai-capability-registry.md)                 | q_backend              | —                   |
| 91  | [WO91-backend-strategy-spec-schema-validator.md](WO91-backend-strategy-spec-schema-validator.md) | q_backend              | WO90                |
| 92  | [WO92-backend-strategy-spec-compiler.md](WO92-backend-strategy-spec-compiler.md)                 | q_backend              | WO90 + WO91         |
| 93  | [WO93-backend-ai-strategy-interpret-endpoint.md](WO93-backend-ai-strategy-interpret-endpoint.md) | q_backend              | WO90 + WO91 + WO92  |
| 94  | [WO94-frontend-ai-strategy-panel.md](WO94-frontend-ai-strategy-panel.md)                         | q_frontend             | WO90-WO93 contracts |
| 95  | [WO95-frontend-ai-strategy-save-run-iterate.md](WO95-frontend-ai-strategy-save-run-iterate.md)   | q_frontend + q_backend | WO90-WO94           |

### Dispatch order

```
WO90 ──► WO91 ──► WO92 ──► WO93 ──► WO94 ──► WO95
```

WO90 first because every later step consumes generated backend truth. WO91 defines the user-facing
spec and structured validation. WO92 proves the core architectural claim by compiling valid specs
into existing runnable strategy payloads. WO93 adds the AI model only after validation and compilation
exist. WO94 integrates the authoring panel into the current Backtests `StrategyStudio`; it must not
create a new standalone Strategy page. WO95 finishes save/run/export/iteration with traceability.

### Batch-specific review checklist

1. Is the capability registry generated from backend truth rather than hand-maintained?
2. Does `StrategySpec` remain a wrapper/subset over existing Q capabilities, not an unbounded second
   runtime DSL?
3. Can a valid spec compile deterministically to `CompositeStrategy` or a built-in strategy without
   generated Python?
4. Does every model output pass backend validation before compilation, save, or run?
5. Are unsupported requests visible to the user and explicitly acknowledged before running/saving a
   closest-supported substitute?
6. Is the UI inside Backtests `StrategyStudio`, with no new standalone `/strategy` surface?
7. Do saved AI strategies preserve prompt/spec/capability/compiled-hash metadata while old custom
   strategies still load?
8. Did the agent actually run the stated `uv` / `pnpm` verification commands, or just claim green?

## Phase: Cinematic Performance Architecture

Preserves Q's cinematic direction while changing how the visuals are rendered so the app can scale.
This is not a "make it plain" performance pass. The goal is equal-or-better visuals with a more
deliberate rendering architecture: measured performance, one controlled cinematic scene, cheap
premium DOM materials, lazy feature islands, scalable result surfaces, and Tauri/Linux runtime gates.

| #   | File                                                                                                                             | Repo       | Depends on          |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------- |
| 96  | [WO96-frontend-cinematic-performance-instrumentation.md](WO96-frontend-cinematic-performance-instrumentation.md)                 | q_frontend | —                   |
| 97  | [WO97-frontend-cinematic-scene-renderer.md](WO97-frontend-cinematic-scene-renderer.md)                                           | q_frontend | WO96                |
| 98  | [WO98-frontend-premium-shell-material-system.md](WO98-frontend-premium-shell-material-system.md)                                 | q_frontend | WO96                |
| 99  | [WO99-frontend-feature-islands-code-splitting.md](WO99-frontend-feature-islands-code-splitting.md)                               | q_frontend | WO96                |
| 100 | [WO100-frontend-large-result-surfaces-workers-virtualization.md](WO100-frontend-large-result-surfaces-workers-virtualization.md) | q_frontend | WO96; WO99 helpful  |
| 101 | [WO101-frontend-tauri-linux-runtime-performance-gates.md](WO101-frontend-tauri-linux-runtime-performance-gates.md)               | q_frontend | WO96; after 97-100  |
| 102 | [WO102-frontend-performance-hud-runtime-fix.md](WO102-frontend-performance-hud-runtime-fix.md)                                   | q_frontend | WO96; WO101         |
| 103 | [WO103-frontend-backtest-worker-request-correlation.md](WO103-frontend-backtest-worker-request-correlation.md)                   | q_frontend | WO100               |
| 104 | [WO104-frontend-cinematic-particle-hot-loop-optimization.md](WO104-frontend-cinematic-particle-hot-loop-optimization.md)         | q_frontend | WO97; WO102         |
| 105 | [WO105-frontend-virtualization-layout-correctness.md](WO105-frontend-virtualization-layout-correctness.md)                       | q_frontend | WO100               |
| 106 | [WO106-frontend-main-bundle-reduction-gate.md](WO106-frontend-main-bundle-reduction-gate.md)                                     | q_frontend | WO99; WO102 helpful |

### Dispatch order

```
WO96 ─┬─► WO97 ─┐
      ├─► WO98 ─┼─► WO101
      ├─► WO99 ─┤
      └─► WO100 ┘

WO101 review follow-ups:

WO102 ─┬─► WO104
       └─► WO106
WO100 ─┬─► WO103
       └─► WO105
```

WO96 must land first because every later WO needs instrumentation and budget language. WO97 and WO98
can run in parallel if file ownership is coordinated: WO97 owns the unified cinematic renderer,
while WO98 owns the reusable material system and repeated DOM surface cost. WO99 can run after WO96
and is mostly route/module architecture. WO100 can start after WO96, but benefits from WO99 if route
islands are already in place. WO101 should run after at least one architecture WO lands and then
become the recurring verification gate for future cinematic shell changes.

WO102-WO106 are follow-ups from the first implementation review. WO102 should land first because it
unblocks reliable runtime measurements. WO103 and WO105 address WO100 correctness risks. WO104
optimizes the WO97 cinematic loop without changing the visual direction. WO106 keeps WO99 honest by
turning the remaining large main chunk into a tracked startup-weight gate.

### Batch-specific review checklist

1. Does the change preserve or improve the cinematic look? Side-by-side screenshots are required for
   shell/visual WOs.
2. Is there at most one always-on app-wide cinematic renderer outside visible feature-specific 3D
   surfaces?
3. Are dense cards/tables/panels free of repeated `backdrop-filter`, animated `box-shadow`, and
   per-frame pointer DOM work?
4. Do hidden/inactive panes stop polling, fetching, rendering charts, and mounting canvases?
5. Are large tables/lists virtualized or otherwise bounded before they can grow unbounded?
6. Does WO96 instrumentation show route/canvas/query/long-task behavior before and after?
7. Was Tauri/Podman runtime verification run for shell/cinematic work, or explicitly deferred with
   exact manual steps?
8. Did the agent actually run `pnpm test:run`, typecheck, and build as specified, or just claim green?

### Performance acceptance gates (WO101)

Recurring checklist for shell, cinematic, and routing work. Full procedure: [runtime-performance.md](../runtime-performance.md).

1. **No new always-on canvas** outside feature-specific 3D workspaces without a budget note in the PR and an update to `budgets.ts` if the ceiling changes.
2. **No app-wide animation loop** outside `CinematicScene` / registered feature renderers — shell chrome stays compositor-driven.
3. **No repeated `backdrop-filter`** on dense cards/tables; blur belongs on shell chrome, modal scrims, and single-instance chart floats.
4. **Hidden panes** must not poll, fetch, render charts, or mount heavy lazy islands while collapsed or off-route.
5. **Browser smoke:** `cd q_frontend && pnpm perf:smoke` with dev server running (`./dev.sh --mocks` or `--web`).
6. **Tauri smoke:** `./dev.sh --podman` manual checklist with `VITE_PERF_HUD=true`, or explicit deferral with recorded steps.
7. **WO96 before/after:** paste HUD or `[perf]` readings for `/`, `/backtests`, and one other workspace when claiming perf improvements.
8. **Visual guardrail:** runtime fixes must use cheaper rendering paths — not visual downgrade.

## Phase: Instrument-Specific Alpha Research

Moves Q from broad capability-building to three focused research programs whose terminal goal is a
**statistically credible candidate ready for paper trading**: CCM$ H1 swing, WIN$ H1 swing, and WDO$
M15 day trade. Each instrument may use a different strategy. The batch widens the causal information
set, admits features before strategy search, starts from named economic hypotheses, and applies a
separate repeated-seed/parameter-plateau/DSR/one-shot-lock-box acceptance contract. It does not claim
live profitability. Full design: [`../design/instrument-specific-alpha-research.md`](../design/instrument-specific-alpha-research.md).

This batch supersedes the stale implementation assumptions in WO42-WO46. WDO$ M5 remains deferred
until its historical cache gap is repaired; transaction-cost plumbing remains supported but is not
the critical path for this research batch.

| #   | File                                                                                                       | Repo                   | Depends on                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------ |
| 158 | [WO158-backend-feature-primitive-substrate-v2.md](WO158-backend-feature-primitive-substrate-v2.md)         | q_backend              | current genome + Feature Store |
| 159 | [WO159-backend-b3-context-multitimeframe-features.md](WO159-backend-b3-context-multitimeframe-features.md) | q_backend              | WO158                          |
| 160 | [WO160-backend-cross-instrument-context.md](WO160-backend-cross-instrument-context.md)                     | q_backend              | WO158                          |
| 161 | [WO161-backend-instrument-hypothesis-catalog.md](WO161-backend-instrument-hypothesis-catalog.md)           | q_backend              | WO159 + WO160                  |
| 162 | [WO162-backend-instrument-feature-evidence.md](WO162-backend-instrument-feature-evidence.md)               | q_backend              | WO159-WO161                    |
| 163 | [WO163-backend-strategy-robustness-acceptance.md](WO163-backend-strategy-robustness-acceptance.md)         | q_backend              | WO161 + WO162                  |
| 164 | [WO164-backend-alpha-research-experiment.md](WO164-backend-alpha-research-experiment.md)                   | q_backend              | WO161-WO163 + WO166            |
| 165 | [WO165-frontend-alpha-research-panel.md](WO165-frontend-alpha-research-panel.md)                           | q_frontend             | WO164 + WO166                  |
| 166 | [WO166-experiment-inconclusive-verdict-semantics.md](WO166-experiment-inconclusive-verdict-semantics.md)   | q_backend + q_frontend | independent; before WO164      |

### Dispatch order

```text
WO158 ─┬─► WO159 ─┐
       └─► WO160 ─┴─► WO161 ──► WO162 ──► WO163 ─┬─► WO164 ──► WO165
WO166 ────────────────────────────────────────────┘
```

WO158 lands first because every new primitive must use the current adaptive/latent-aware generation
contract. WO159 and WO160 are independent after that and can run **in parallel**: WO159 owns same-
instrument session/regime/multi-timeframe context, while WO160 owns cross-symbol loading/alignment.
WO161 freezes the profile and hypothesis contracts. WO162 then implements WO161's evidence-resolver
boundary and evaluates required features under those exact profile/horizon definitions. WO163
consumes both candidate and evidence contracts to define the paper-candidate verdict. WO166 is a
small independent correctness fix and can start immediately, but must land before WO164 so the
orchestrator and existing Discovery A/B consumers share honest insufficient-evidence semantics.
WO164 is the orchestration layer and must reuse those services; WO165 is last because it renders the
final backend contract.

### Batch-specific review checklist

1. Are CCM$ H1, WIN$ H1, and WDO$ M15 separate versioned profiles with no forced universal strategy?
2. Is every context value causal at the decision timestamp, including completed D1 values, opening
   ranges, previous-session levels, and backward-as-of exogenous joins?
3. Are the new primitives visible to both the Feature Store and genome runtime through one mathematical
   implementation, and are they actually reachable by seeded generation/mutation?
4. Does feature admission use only the early evidence segment with purge/embargo, fold stability,
   redundancy control, and a search-budget-aware permutation null floor?
5. Does the hypothesis provider emit a small, named, economically explained catalog rather than a new
   arbitrary combinatorial search?
6. Can a losing best-of-population candidate ever become `ready_for_paper`? It must not.
7. Are repeated seeds, parameter-neighborhood stability, DSR >= profile threshold, and the untouched
   lock-box hard acceptance evidence rather than decorative metrics?
8. Is missing/failed/zero-sample evidence `inconclusive`, never coerced to zero or `no_effect`?
9. Is the lock-box consumed once per split-manifest/champion hash, with no automatic retry after
   changing the candidate against the same tail?
10. Does the experiment persist the full provenance chain: data hashes, split manifest, profile and
    catalog versions, features, hypotheses, seeds, attempts, DSR inputs, criteria, and champion?
11. Does WDO$ M5 fail preflight until continuous history is available, while M15 remains the primary
    intraday research profile?
12. Did each worker run the exact targeted tests plus full repo verification stated in its WO?

## Phase: Paper and Live Execution

Adds Q's first forward-execution path for M15-and-slower closed-bar strategies. The initial usable
mode is an internal paper simulator driven by live MT5 bars/quotes. A broker-neutral domain keeps
strategy evaluation, risk, accounting, and operator controls independent of MT5. The live MT5 adapter
is implemented behind hard gates but remains `LIVE LOCKED` and operationally unvalidated until a
controlled trading account exists. Full design:
[`../design/paper-live-execution.md`](../design/paper-live-execution.md).

Performance is a product contract: steady-state evaluation uses shared incremental bars and bounded
rolling windows, keeps REST/Redis/Dramatiq out of the hot path, and measures a 500 ms p95 budget from
completed-bar visibility to committed paper fill on the target machine. Tick/sub-second execution is
explicitly deferred.

| #   | File                                                                                               | Repo                   | Depends on         |
| --- | -------------------------------------------------------------------------------------------------- | ---------------------- | ------------------ |
| 167 | [WO167-backend-execution-domain-persistence.md](WO167-backend-execution-domain-persistence.md)     | q_backend              | current DB/runtime |
| 168 | [WO168-backend-paper-broker-ledger.md](WO168-backend-paper-broker-ledger.md)                       | q_backend              | WO167              |
| 169 | [WO169-backend-forward-strategy-evaluator.md](WO169-backend-forward-strategy-evaluator.md)         | q_backend              | WO167              |
| 170 | [WO170-backend-execution-worker-risk-recovery.md](WO170-backend-execution-worker-risk-recovery.md) | q_backend              | WO167-WO169        |
| 171 | [WO171-backend-execution-api.md](WO171-backend-execution-api.md)                                   | q_backend              | WO167 + WO170      |
| 172 | [WO172-backend-mt5-live-broker-locked.md](WO172-backend-mt5-live-broker-locked.md)                 | q_backend              | WO168 + WO170      |
| 173 | [WO173-frontend-execution-workspace.md](WO173-frontend-execution-workspace.md)                     | q_frontend             | WO171 contract     |
| 174 | [WO174-frontend-deploy-to-paper-promotion.md](WO174-frontend-deploy-to-paper-promotion.md)         | q_frontend + q_backend | WO171 + WO173      |

### Dispatch order

```text
WO167 ─┬─► WO168 ─┐
       └─► WO169 ─┴─► WO170 ─┬─► WO171 ──► WO173 ──► WO174
                              └─► WO172
```

WO167 lands first because every later path depends on its state/idempotency contract. WO168 and WO169
can then run **in parallel**: the former owns broker/paper accounting, while the latter owns market
bars/strategy evaluation. WO170 joins them into the standalone worker and freezes lifecycle,
recovery, risk, and performance contracts. After WO170, WO172 can run **in parallel** with the API and
frontend stream because it owns the locked live adapter. WO171 publishes the control/read contract;
WO173 builds the operational workspace; WO174 adds promotion only after the canonical deployment
flow exists.

### Batch-specific review checklist

1. Is every deployment one immutable strategy/config hash, symbol, and timeframe with one net
   position, rather than mutable Backtest form state?
2. Does each `(deployment, bar close)` produce at most one durable decision/order across polling,
   retry, restart, and lease takeover?
3. Does steady state fetch each symbol/timeframe once, exclude the forming bar, retain bounded rolling
   windows, and avoid full-history reloads?
4. Are buy/short-cover fills based on ask and sell/short-entry fills on bid, with spread, deterministic
   slippage, and fees accounted exactly once?
5. Does any persistence, lease, stale-data, or ambiguous-outcome failure block new orders rather than
   guess or resend?
6. Are pause, stop, flatten, and kill switch distinct and auditable, with pause/stop retaining open
   positions unless flatten is explicit?
7. Is the execution worker separate from API lifespan and Dramatiq, with REST/Redis/frontend absent
   from the order hot path?
8. Does the benchmark report phase timings and meet the documented 500 ms p95 M15/H1 paper budget on
   the target profile?
9. Does the MT5 adapter choose symbol-supported execution/fill settings, retain raw results/tickets,
   and reconcile orders/positions/deals instead of equating `order_send` acceptance with a fill?
10. Do all live gates default to denial, with the UI and docs saying `LIVE LOCKED` and operationally
    unvalidated because no controlled account test occurred?
11. Does the frontend stop polling off-route, bound audit history, and wait for backend acknowledgement
    rather than optimistically claiming destructive commands completed?
12. Can only immutable saved configs or frozen `ready_for_paper` champions create a reviewed draft,
    with no automatic start or live option?

## Phase: Execution Live Chart (next batch)

Gives the Execution workspace visual feedback. Today, after starting a paper deployment, the only
signal is JSON rows accumulating in the Decisions table — you can't see what the strategy sees or
why it hasn't acted. This batch adds a live chart per deployment: the backend exposes the exact
bounded bar window + strategy indicator series the forward evaluator consumes (same code path, so
backtest/forward parity is guaranteed by construction), and the frontend renders it with
decision/fill markers, the live forming bar, and a bar-close countdown that makes the closed-bar
evaluation contract obvious.

| #   | File                                                                                             | Repo       | Depends on     |
| --- | ------------------------------------------------------------------------------------------------ | ---------- | -------------- |
| 175 | [WO175-backend-deployment-chart-endpoint.md](WO175-backend-deployment-chart-endpoint.md)         | q_backend  | WO169 + WO171  |
| 176 | [WO176-frontend-execution-live-chart.md](WO176-frontend-execution-live-chart.md)                 | q_frontend | WO175 contract |

### Dispatch order

```text
WO175  ──►  WO176
```

Strictly sequential. WO175 **must paste the full chart JSON contract** (one real payload with
indicators on at least two panes) in its completion message — WO176 builds the entire panel
against it. WO176 must degrade cleanly against a pre-WO175 backend.

### Batch-specific review checklist

1. Do the endpoint and the evaluator share **one** indicator-augmentation helper (parity test
   proves identical values per bar), with no duplicated indicator math in the router?
2. Is display trimming done **after** indicator computation, so no warm-up NaNs reach the
   requested display window?
3. Does 5s polling recompute indicators only when a **new completed bar** lands (call-count spy),
   and is the `bars` param bounded?
4. Did bars/indicator series stay **out of Postgres** (compute-and-return only), and do reads
   funnel through `MarketDataService` (works under `auto`/`mt5`/`local`)?
5. Frontend: are strategy indicators rendered from **backend values only** (no client
   recomputation), and is the Market workspace chart pixel-identical?
6. Do hidden/off-route Execution views stop polling the chart, and does the page degrade
   (404 → unavailable panel, 503 → stale note) instead of an error wall?
7. Are markers sourced from persisted decisions/fills only (no optimistic rendering), with `hold`
   skipped?
8. Did the agent actually run `uv run pytest` / `pnpm test:run` for real, or just claim green?

## Phase: Premium Interaction Upgrade

Elevates the existing Q interface with seven owner-selected public components. The batch imports
signature interaction mechanics while retaining Q's visual system, chart stack, dock composition,
and cinematic environment. Selection record: [premium-component-upgrades.md](../design/premium-component-upgrades.md).

| #   | File                                                                                                           | Repo       | Depends on            |
| --- | -------------------------------------------------------------------------------------------------------------- | ---------- | --------------------- |
| 215 | [WO215-frontend-workspace-stripe-shutter-transition.md](WO215-frontend-workspace-stripe-shutter-transition.md) | q_frontend | current shell/routing |
| 216 | [WO216-frontend-execution-kill-switch-slide.md](WO216-frontend-execution-kill-switch-slide.md)                 | q_frontend | WO215 accepted        |
| 217 | [WO217-frontend-ai-builder-state-orb.md](WO217-frontend-ai-builder-state-orb.md)                               | q_frontend | WO216 accepted        |
| 218 | [WO218-frontend-active-job-status-island.md](WO218-frontend-active-job-status-island.md)                       | q_frontend | WO217 accepted        |
| 219 | [WO219-frontend-operational-failure-terminal.md](WO219-frontend-operational-failure-terminal.md)               | q_frontend | WO218 accepted        |
| 220 | [WO220-frontend-candidate-morphing-dialog.md](WO220-frontend-candidate-morphing-dialog.md)                     | q_frontend | WO219 accepted        |
| 221 | [WO221-frontend-quantitative-number-flow.md](WO221-frontend-quantitative-number-flow.md)                       | q_frontend | WO220 accepted        |

### Dispatch order

```text
WO215 -> VISUAL A -> WO216 -> VISUAL B -> WO217 -> VISUAL C -> WO218
      -> VISUAL D -> WO219 -> VISUAL E -> WO220 -> VISUAL F -> WO221 -> VISUAL G
```

Strictly sequential. Each visual checkpoint is an owner review of the live component at desktop and
mobile widths; passing automated checks alone does not unlock the next order. Work Orders must be
returned to `REVIEW`, not self-declared accepted.

### Batch-specific review checklist

1. Is the selected source's signature behavior visibly present, rather than a generic approximation?
2. Did Q keep its warm-black, brass, smoked-silver, typography, elevation, and chart language?
3. Did the change avoid a new always-on canvas, shell RAF, root listener, or unbounded animation?
4. Does reduced motion collapse decorative movement while preserving state, operation, and feedback?
5. Are keyboard, focus, screen-reader naming, and backend acknowledgement semantics intact?
6. Are screenshots and a short interaction capture included for the exact owner checkpoint?
7. Did the agent run targeted tests, `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
   `pnpm perf:smoke`, and the relevant Tauri/WebKitGTK check—or explicitly record an honest deferral?
8. Did the implementation preserve unrelated worktree changes, especially active edits in
   `spotlight-button.tsx` and `ExecutionWorkspace.tsx`?

## Review checklist (apply to every returned PR)

1. Does the compute path still work with Postgres **stopped**? (stop the container, run a backtest / a study)
2. Are new id fields (`run_id`, `study_id`) strictly **additive** — did any existing response field change shape?
3. Did anything sneak **trades / bars / indicator series into Postgres**? (must not — series belong in the Parquet lake, WO22+)
4. Did background threads use `session_scope()` and **not** a request-scoped session?
5. Did the agent actually **run the stated verification command**, or just claim green?
