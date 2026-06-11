# WO14 — Backend: tick backtest API endpoint, chart resampling, persistence

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** we are adding a **tick-data backtest engine** alongside the candle
engine. WO12 (done) shipped the columnar tick loader; WO13 (done) shipped the engine. This
work order **exposes the tick engine through the HTTP API** so the frontend (WO15) can run
tick backtests, and persists them in the existing run history.

**WO13 (prerequisite) shipped — build against its completion-message contracts:**

- `tick.engine.TickBacktestEngine(strategy, sizing_config, initial_capital, point_value)` with
  `.run(ticks: TickArrays, parallel_mode=...) -> TradeRegistry`.
- `tick.factory.build_tick_strategy(name, params, symbol) -> TickStrategy`.
- `TickArrays` / `TickSignals` dataclasses; the strategy's `get_chart_indicators()` and
  optional `compute_indicator_series(ticks)`.
- Registered tick strategies carry `engine="tick"` in `StrategyInfo`, surfaced by
  `GET /api/v1/strategies`.

**WO12 shipped:** `MarketDataService.get_ticks_columnar(symbol, start, end, flags)
-> dict[str, np.ndarray]` (`time_msc` int64 ms, `bid/ask/last/volume` float64, `flags` int32).

This work order is **backend only.** The frontend toggle/types are WO15.

---

## How the candle backtest endpoint works today (read these files)

- `src/q_backend/api/main.py`:
  - `class BacktestRequest` (~line 105): `symbol, timeframe, start, end, initial_capital,
point_value, strategy, strategy_params, position_sizing`. **You extend this** (additive).
  - `class BacktestResponse` (~line 125): `{metrics, trades, bars, indicators, run_id}` with
    `bars: List[OhlcvBarResponse]` and `indicators: List[ChartIndicatorSeries]`. **Reuse this
    response shape unchanged** — the tick path resamples ticks into the same `bars` contract.
  - `run_backtest` `POST /api/v1/backtest/run` (~line 830): fetch OHLCV → DataFrame → build
    strategy → `serialize_chart_data` → `BacktestEngine.run(...)` → metrics/trades → persist.
    **You branch here** on `request.engine`.
  - `_to_naive_local` (used at ~line 838): MT5 expects naive local datetimes; reuse it.
  - `_start_backtest_run(request)` / `_finish_backtest_run(run_id, status, ...)` and the
    `RunStatus` enum — the persistence wrapper. `_start_backtest_run` serializes the request
    into the run's `config` dict (it persists run start, dedupes via
    `find_backtest_run_by_config`). `_backtest_run_fields` (~line 281) reads
    `symbol/strategy/timeframe` from that config for list/detail responses.
- `src/q_backend/backtesting/chart_data.py` — `serialize_chart_data(df, strategy)` →
  `{"bars": [...], "indicators": [...]}`. Bars are `{timestamp(ISO UTC), open, high, low,
close, volume}`; `_to_iso_timestamp` uses `mt5_datetime_to_utc_iso`. The tick path needs a
  **tick analogue** that resamples + samples indicators (task 3).
- `src/q_backend/storage/db/repositories.py` — `create_backtest_config`,
  `create_backtest_run`, etc. (imported at the top of `main.py`). The run `config` is a free
  JSON dict — additive fields are safe.

---

## Goal

`POST /api/v1/backtest/run` accepts `engine: "tick"` and runs the tick engine end to end:
load columnar ticks → run `TickBacktestEngine` → return metrics + exact-price trades +
**resampled display bars** + indicator series, persisted as a normal run with
`timeframe="TICK"`. The existing candle path is byte-for-byte unchanged.

## Tasks

### 1. Extend `BacktestRequest` (additive only)

```python
engine: Literal["candle", "tick"] = "candle"
# tick-only knobs (ignored when engine == "candle"):
display_timeframe: str = "M1"   # bar size to resample ticks into for the chart
tick_flags: Optional[str] = None  # "all" | "trade" -> COPY_TICKS_ALL / COPY_TICKS_TRADE
```

- SL/TP and other order params come from `strategy_params` (the tick strategy declares them,
  per WO13) — do **not** add separate top-level SL/TP fields; keep them strategy-driven so the
  schema-rendered form (WO15) covers them automatically.
- `timeframe` stays as-is for candle. For tick runs it's not used to fetch (ticks have no
  timeframe); `display_timeframe` only controls chart resampling.

> **GUARDRAIL — back-compat.** `engine` defaults to `"candle"`. An existing request with no
> `engine` field MUST behave exactly as today. No existing field changes name, type, or
> default. Verify with the existing backtest tests still green and unmodified.

### 2. Branch `run_backtest` on `engine`

Refactor minimally: keep the candle body as-is under `if request.engine == "candle"`. Add a
tick branch (extract a `_run_tick_backtest(request, start, end, run_id)` helper to keep the
route readable):

1. `arrays = market_data_service.get_ticks_columnar(symbol, start, end, flags)` — map
   `tick_flags` to the MT5 constant; default `COPY_TICKS_ALL`. 404 if no ticks in range.
2. Build `TickArrays` from the dict; `strategy = build_tick_strategy(...)`;
   sizing from `request.position_sizing`.
3. `registry = TickBacktestEngine(...).run(ticks, parallel_mode=DAY_TRADE)`.
4. `metrics = registry.get_performance_metrics(initial_capital)`;
   `trades = [t.model_dump() for t in registry.get_closed_trades()]` — same shape as candle,
   carrying the **exact tick entry/exit prices and times**.
5. Chart payload via the task-3 resampler.
6. Persist via the **existing** `_start_backtest_run`/`_finish_backtest_run`.

> **GUARDRAIL — MT5 affinity / no per-tick objects.** `get_ticks_columnar` already serializes
> MT5 access through the client lock; fetch on the request thread (as the candle path does).
> Do not convert the tick arrays to a list of dicts/Pydantic before handing them to the engine
> — pass the arrays. The only Pydantic trades are the closed trades from the registry.

### 3. Tick chart payload — resample ticks to display bars

The chart can't render millions of points. Add `serialize_tick_chart_data` (in
`chart_data.py` or a `tick/chart_data.py`) that returns the **same** `{"bars", "indicators"}`
contract as `serialize_chart_data`:

- Resample the tick mid-price (or `last` where present, else `(bid+ask)/2`) into OHLC bars at
  `display_timeframe` using `time_msc`. Volume = summed tick volume per bar. Timestamps ISO
  UTC via the same `mt5_datetime_to_utc_iso` path.
- Indicators: if the strategy exposes `compute_indicator_series(ticks)`, **sample each series
  at the last tick within each display bar** so indicator arrays align 1:1 with bars. Series
  keys/labels/panes/colors come from `get_chart_indicators()` (reused `ChartIndicatorSpec`).
- Cap the bar count defensively (e.g. if `display_timeframe` would yield >50k bars for a huge
  range, coarsen or cap) so a year of ticks can't produce an unbounded payload.

### 4. Persistence: tick runs in existing history

- Ensure the run `config` records `engine: "tick"`, `display_timeframe`, and `strategy_params`
  (so `find_backtest_run_by_config` dedupe and "continue" work). Set the persisted
  **`timeframe` to `"TICK"`** so `_backtest_run_fields` and the history list/detail render a
  clear label with **no schema change** (it's just a string in the JSON config).
- Nothing else in the persistence layer changes — no new tables, no migration.

> **GUARDRAIL — no trades/bars/ticks into Postgres.** Same rule as the candle path: only the
> run row + config + `result_summary` metrics are persisted. Tick arrays and resampled bars
> are response-only. (See the batch review checklist.)

### 5. `GET /api/v1/strategies` carries the engine tag

Confirm the schema endpoint emits WO13's `engine` field per strategy (`"candle"`/`"tick"`)
so WO15 can filter strategies by the selected engine. If WO13 added it to `StrategyInfo`,
this is just verifying the response includes it; if a response model in `main.py` needs the
field mirrored, add it (additive).

### 6. Tests

Follow the existing backtest endpoint tests (mock `market_data_service` /
`get_ticks_columnar` with synthetic arrays; **no live MT5**):

- `engine:"candle"` (and omitted `engine`) path unchanged — reuse/keep existing assertions.
- `engine:"tick"`: returns `metrics`, `trades` (with exact prices), `bars` (resampled to
  `display_timeframe`), `indicators` aligned to bars, and a `run_id`.
- Persistence: a tick run is listed by `GET /api/v1/backtests` with `timeframe == "TICK"`;
  detail config carries `engine:"tick"`.
- No ticks in range → 404; MT5 offline (loader raises/empty) → graceful error, not a 500 wall
  where the candle path would 503/404.
- Resampler unit test: a known tick stream → expected OHLC bars + bar-aligned indicator values.

### 7. Docs

Update `q_backend/README.md`: document `engine`/`display_timeframe`/`tick_flags` on
`POST /api/v1/backtest/run`, the `timeframe:"TICK"` history convention, and an example tick
request/response.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- The candle path is provably unchanged (existing tests green, untouched).
- In your final message, paste the **final request/response JSON for a tick run** (a
  `BacktestRequest` with `engine:"tick"` and the resulting `BacktestResponse`) — WO15 builds
  its TypeScript request type and MSW mocks against it. Note the `timeframe:"TICK"` history
  convention and that tick strategies are tagged `engine:"tick"` in `GET /api/v1/strategies`.

## Out of scope

- Any frontend change (WO15).
- The optimization tick runner (WO16).
- New persistence tables / migrations / storing ticks or bars in the DB.
- WebSockets / streaming.
- Changing or removing the candle path, the legacy `/api/v1/market-data/*` endpoints, or the
  `get_ticks` tape path.
