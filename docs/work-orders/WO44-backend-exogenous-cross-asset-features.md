# WO44 — Backend: exogenous (cross-asset) data plumbing + `source.exog.*` primitives

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Feature Engine". The project trades **one** instrument with
limited capital — but reading _other_ symbols as **inputs** costs no capital and is where much B3
edge lives. WIN is heavily driven by **WDO (USD/BRL)** and **overnight ES/NQ**, and lags
**PETR4/VALE3**. This WO threads one-or-more **exogenous symbols** into the backtest frame as extra
columns and exposes them as `source.exog.*` genome leaves the GA can compose with. It is the
single most valuable Brazil-specific feature work — and the most plumbing. Design:
**`docs/design/feature-engine.md` §3d, §4** (read it).

**Single-symbol stays single-symbol.** Exogenous series are _features_, never positions. The
engine still trades exactly `backtest.symbol`; exogenous frames only contribute input columns.

---

## How the pieces work today (read these files)

- `src/q_backend/optimization/backtest_runner.py` — the data seam:
  - `DefaultBacktestRunner.load_sliced_frame(market_data_service, symbol, timeframe, start, end)`
    fetches one symbol's OHLCV **once on the caller thread** and returns a naive-local frame.
  - `from_frame_sliced(df)` serves walk-forward windows by slicing that in-memory frame per run
    (honors `warmup_bars`). `from_market_data_sliced` = load + `from_frame_sliced`.
  - `BacktestRunConfig` is what each run receives; `run()` calls `build_strategy(...)` then the
    engine. **Exogenous columns must be present on the frame `from_frame_sliced` slices** so every
    window/trial sees them with zero refetch.
- `src/q_backend/market_data/service.py` — `MarketDataService.get_ohlcv(symbol, timeframe, start,
end)` (the one-load source; MT5 must be called from the caller thread).
- `src/q_backend/backtesting/genome/composite_strategy.py` — `_evaluate_node`; `source.close`
  reads `df["close"]`. Exogenous leaves read pre-attached columns (e.g. `df["exog__WDO$__close"]`).
- `src/q_backend/optimization/strategy_search.py` — `StrategySearchConfig` (where an
  `exogenous` config block is added); the strategy-search job constructs the runner on the request
  thread (WO32) — the natural place to also load + align exogenous frames.

---

## Goal

```python
# Config declares exogenous symbols; the runner loads + aligns them once, as extra frame columns;
# source.exog.* genome leaves read them; alignment is backward-as-of + lag → causal, no refetch.
StrategySearchConfig(..., exogenous=[ExogenousSeriesConfig(symbol="WDO$", timeframe="M5",
                                                           lag_bars=0, alias="wdo")])
```

## Tasks

### 1. `ExogenousSeriesConfig` (additive on `StrategySearchConfig`)

```python
class ExogenousSeriesConfig(BaseModel):
    symbol: str
    timeframe: str | None = None     # default: primary timeframe
    alias: str                       # column namespace, e.g. "wdo" → exog__wdo__close
    lag_bars: int = 0                # >=0; bars to shift the aligned series back (causality margin)
    fields: list[str] = ["close"]    # which OHLCV fields to attach
```

Add `exogenous: list[ExogenousSeriesConfig] = []` to `StrategySearchConfig` (additive; empty →
behavior identical to today). Validate unique aliases and `lag_bars >= 0`.

### 2. Load-and-align helper — new `optimization/exogenous.py`

```python
def attach_exogenous(
    primary: pd.DataFrame,
    market_data_service: Any,
    specs: list[ExogenousSeriesConfig],
    *, start: datetime, end: datetime,
) -> pd.DataFrame:
    """Load each exogenous symbol once (caller thread) and attach aligned columns to `primary`."""
```

- For each spec: `get_ohlcv` **once** (same caller-thread, naive-local normalization as
  `load_sliced_frame` — factor/reuse that normalization, don't duplicate the tz logic by hand).
- **Align with `pd.merge_asof(direction="backward")`** onto the primary index, then `.shift(lag_bars)`.
  Backward-as-of guarantees bar _i_ reads only the most recent exogenous bar with timestamp ≤ the
  primary bar's timestamp. Attach as `f"exog__{alias}__{field}"` columns (e.g. `exog__wdo__close`).
- **Missing/short data is tolerated:** forward-fill within a bounded gap; leave NaN where no prior
  exogenous bar exists (downstream comparisons against NaN yield no signal — matches existing
  `fillna(False)` handling). A missing exogenous symbol logs a warning and attaches all-NaN columns
  — it must **not** abort the run.
- Call `attach_exogenous` in the strategy-search job **right after** `load_sliced_frame` for the
  primary symbol and **before** `from_frame_sliced`, so the enriched frame flows unchanged through
  every window/trial/genome. This preserves the one-load-per-symbol guarantee.

### 3. `source.exog.*` primitives (design §3d) — node specs + evaluator

Add to `NODE_SPECS` (`category="source"` leaf, `generatable=True`, 0 inputs):

| Kind                 | output port → type   | params                  |
| -------------------- | -------------------- | ----------------------- |
| `source.exog.close`  | `out` → price_series | `alias` (fixed literal) |
| `source.exog.return` | `out` → oscillator   | `alias`, `change_bars`  |
| `source.exog.zscore` | `out` → oscillator   | `alias`, `window`       |

- In `_evaluate_node`: resolve the column `exog__{alias}__close`; `return` = `col / col.shift(k) − 1`;
  `zscore` = causal rolling z-score (reuse WO42's `transform.zscore` math). `alias` is a **fixed
  literal** identifying which attached column (not an Optuna dim); `change_bars`/`window` are
  optimizable via `GENOME_PARAM_BOUNDS`.
- A genome referencing an `alias` with no attached column must fail **validation** with a clear
  error (so a genome can't silently read a symbol the run didn't load) — see task 4.

### 4. Validation (validate.py)

- `source.exog.*` nodes require an `alias` param that is a literal string. Add a parse-time check
  that the alias is non-empty. (Whether the alias is _loaded_ is a run-time concern — the column
  may be all-NaN; that's tolerated, not a validation error. But an alias not present in the run's
  `exogenous` config should be caught where the genome meets the config — assert in the job/runner
  wiring with a clear message, and cover it with a test.)

### 5. Operator reachability + initial population awareness

`source.exog.*` are generatable **only when** the run declares exogenous symbols — otherwise the GA
must not emit them (they'd reference missing columns). Thread the available aliases into
`build_random_genome` / `_mutate_add_node` so exog leaves are drawn **only** from declared aliases,
and are simply absent from the pool when `exogenous=[]`. This keeps the no-exogenous path identical.

## Guardrails

> **Causal alignment.** Backward-as-of join + `lag_bars` shift only. A test feeds a synthetic
> exogenous frame whose later bars are corrupted and asserts primary-bar signals are unchanged
> (no future exogenous leakage). Overnight-driver use (ES → B3 open) is expressed with `lag_bars`,
> never a contemporaneous future bar.

> **One load per symbol per run.** Each exogenous symbol's `get_ohlcv` is called **once** across a
> whole multi-generation genetic run (call-count spy), exactly like the primary frame. The aligned
> columns ride the reused `from_frame_sliced` frame.

> **Empty exogenous = byte-identical.** With `exogenous=[]`, the frame, the genomes the GA can
> emit, persistence, and payloads match pre-WO44 exactly. `source.exog.*` never appear.

> **Resilient to missing data.** A missing/short exogenous symbol degrades to NaN columns + a
> warning; the run completes. No crash, no abort.

## Tests — `tests/.../test_exogenous.py`

- **Alignment correctness:** a primary M5 frame + a coarser exogenous frame align backward
  (each primary bar reads the last exogenous bar at-or-before it); `lag_bars=1` shifts one bar.
- **Causality:** corrupting exogenous bars after time _t_ leaves primary signals at ≤ _t_ unchanged.
- **One load:** `get_ohlcv` called once per symbol (primary + each exogenous) across a 2-generation
  small-population genetic run (call-count spy).
- **`source.exog.*` numeric:** `close`/`return`/`zscore` read the right column and compute right.
- **Missing symbol:** an exogenous spec for an unavailable symbol → NaN columns + warning, run
  completes; genomes reading it produce no signal (no exception).
- **Alias-not-declared:** a genome with `source.exog.close(alias="x")` against a run that didn't
  load `x` is rejected with a clear error.
- **Empty-exogenous parity:** with `exogenous=[]`, a strategy-search run is byte-identical to a
  pre-WO44 snapshot, and the GA never emits `source.exog.*`.
- Existing data-load / one-load / genome / walk-forward tests green and unmodified.

## Docs

`q_backend/README.md`: a "Cross-asset features" note — exogenous symbols as inputs (not positions),
backward-as-of + lag alignment, the one-load guarantee, B3 examples (WIN reading WDO / overnight
ES / PETR4–VALE3). Link the design doc.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Empty-exogenous path byte-identical; existing tests untouched and green.
- In your final message, paste: the `ExogenousSeriesConfig` field list, the `attach_exogenous`
  signature + the attached column naming (`exog__{alias}__{field}`), the `source.exog.*` `NodeSpec`
  rows, and where in the strategy-search job `attach_exogenous` is invoked (between primary
  `load_sliced_frame` and `from_frame_sliced`). **WO45/WO46 read these columns.**

## Out of scope

- Feature discovery / IC validation (WO45); GA seeding + diversity (WO46).
- Trading or sizing any exogenous symbol (features only — never positions).
- Live/streaming exogenous data (backtest frame only).
- Any frontend (WO47).
