# WO12 — Backend: columnar tick loader + Numba/NumPy compatibility spike

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
  - Add deps with `uv add <pkg>` (writes `pyproject.toml` + `uv.lock`). NEVER hand-edit deps.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the platform backtests on OHLCV candles today, which can't resolve
what happens _inside_ a bar (a stop-loss and take-profit in the same candle — which hit
first?) and ignores the bid/ask spread on entry. We are building a **separate tick-data
backtest engine** (alongside, not replacing, the candle engine) that simulates fills at true
MetaTrader 5 tick resolution. The full engine arrives in WO13; **this work order is the
foundation**: the data layer that feeds it, plus resolving the one dependency risk that
gates the whole batch.

The dominating constraint is **performance**. A single liquid symbol produces 50k–200k
ticks/day → 1–4M ticks/month → tens of millions/year. The existing tick path builds a
Pydantic `Tick` object per row (see `get_ticks` in `metatrader.py`), which is fine for a
few hundred tape rows but would allocate gigabytes for a backtest. The tick engine's hot path
must stay **columnar** (NumPy arrays end to end, no per-row Python objects). This work order
delivers that columnar loader. This work order is **backend only.**

---

## How tick/market data works today (read these files)

- `src/q_backend/market_data/clients/metatrader.py` — `MetaTraderClient`. All MT5 calls are
  serialized through `_run_locked` (a `threading.Lock`) — **every new MT5 access you add MUST
  go through `_run_locked`**, MT5 is not thread-safe.
  - `get_ticks` (~line 404): existing tick fetch. Calls `mt5.copy_ticks_range(symbol, start,
end, flags)`, then **iterates the structured array building a `Tick` per row** — exactly
    the pattern to avoid for the engine. Leave it alone (the tape endpoint uses it).
  - `_fetch_ohlcv_range_chunked` (~line 205): the **pattern to mirror** for chunked range
    fetching — cursor loop, `_MAX_HISTORY_CHUNKS` cap, advancing the cursor past the last
    returned row's time, `np.concatenate` of chunks. Note `_to_naive_local` (~line 35):
    MT5 expects naive local datetimes; reuse it.
  - `_rates_to_ohlcv_list` (~line 46): note how it reads structured-array columns by name
    (`rates["time"][i]`) and checks `rates.dtype.names` for optional fields. The MT5 tick
    structured array has fields: `time` (int seconds), `bid`, `ask`, `last`, `volume`,
    `time_msc` (int milliseconds), `flags`, `volume_real`. Confirm names at runtime via
    `ticks.dtype.names` — do not assume every build has every field.
- `src/q_backend/market_data/service.py` — `MarketDataService`. Thin pass-through to the
  client (`get_ohlcv`, `get_ticks` ~line 101). Add your new method here too, same style.
- `src/q_backend/market_data/models.py` — `Tick` Pydantic model (the per-row shape we are
  bypassing for the engine; keep it for the existing tape path).
- `pyproject.toml` — current deps: `numpy>=2.4.4`, `pandas>=3.0.2`. `numba` and `pyarrow`
  are NOT present yet.

---

## Goal

Two deliverables:

1. **Resolve the Numba ↔ NumPy compatibility risk** (it gates WO13's compiled kernel), and
   record the outcome so WO13 can act on it without re-investigating.
2. A **columnar tick loader** — fetch MT5 ticks for a symbol/range as a dict of NumPy arrays
   (never a list of Pydantic objects), chunked over long ranges, with an on-disk cache so the
   same range isn't refetched on every run / every optimization trial.

## Tasks

### 1. Numba / NumPy compatibility spike (do this FIRST — it can change WO13's plan)

The backend pins `numpy>=2.4.4` and `pandas>=3.0.2`. Numba's supported NumPy range
historically lags the newest NumPy. Before committing the engine to Numba:

- Try `uv add numba`. Let the resolver pick a version. If it resolves and a trivial
  `@njit` function compiles and runs (`uv run python -c "..."` with a tiny kernel over a
  NumPy array), **Numba is viable** — record the resolved `numba` + `numpy` versions.
- If the resolver **downgrades NumPy below 2.4.4**, or refuses, or the `@njit` smoke test
  fails: **do not force it.** Numba is not viable on the current pin. Remove it
  (`uv remove numba`).

Write the outcome into a new doc `q_backend/docs/tick-engine-deps.md` (create the
`docs/` dir if absent):

- **Viable:** exact `numba`/`numpy` versions, the smoke-test snippet, and a note "WO13 kernel
  uses `@njit`".
- **Not viable:** state it plainly and record the fallback decision: WO13's kernel will be
  **pure NumPy with candidate-index reduction** (precompute the indices where a position
  could open/close, iterate only those in a plain Python/NumPy loop) — no Numba dependency.

> **GUARDRAIL — do not downgrade NumPy or pandas to satisfy Numba.** The rest of the backend
> depends on the current pins. If Numba can't coexist, the fallback is pure NumPy, not a
> downgrade. This is the single most important decision in the batch — get it right and
> document it.

### 2. Add `pyarrow` for the tick cache

`uv add pyarrow`. Used for fast columnar parquet read/write of the cache (task 4). This one
has no NumPy-pin conflict.

### 3. Columnar loader: `MetaTraderClient.get_ticks_columnar(...)`

Add a method that returns a **dict of NumPy arrays**, not Pydantic objects:

```python
def get_ticks_columnar(
    self,
    symbol: str,
    start: datetime,
    end: datetime,
    flags: int = mt5.COPY_TICKS_ALL,
) -> dict[str, np.ndarray]:
    """
    Returns aligned NumPy arrays for the range (no per-row Python objects):
      {
        "time_msc": int64[],   # epoch milliseconds, the canonical ordering key
        "bid":      float64[],
        "ask":      float64[],
        "last":     float64[],
        "volume":   float64[],
        "flags":    int32[],
      }
    All arrays share length N and are sorted ascending by time_msc.
    Returns empty arrays (length 0) when the range has no ticks.
    """
```

Requirements:

- **Go through `_run_locked`** and `_ensure_connected`, like the other methods.
- `mt5.symbol_select(symbol, True)` first; log a warning (don't raise) if it fails, matching
  `get_ticks`.
- **Chunk long ranges** by mirroring `_fetch_ohlcv_range_chunked`: cursor loop with a per-chunk
  span (a few days of ticks can be large — use a small span like `_RANGE_FETCH_DAYS` or
  smaller for ticks), `_MAX_HISTORY_CHUNKS` cap, advance the cursor past the last chunk's
  `time_msc`, collect chunks, `np.concatenate` once. Use `_to_naive_local(start/end)`.
- **Build arrays by column, never by row.** Read `arr["bid"]` etc. as whole columns
  (`.astype(np.float64)`), check `ticks.dtype.names` for optional fields (`last`, `volume`,
  `flags`, `time_msc`) and synthesize zero-filled arrays when a field is absent.
  - If `time_msc` is missing on a build, derive it as `time * 1000`.
- Add a module-level cap (e.g. `_MAX_TICKS`, ~50M) to refuse pathological ranges with a clear
  `ValueError`, mirroring `_MAX_OHLCV_BARS`.

### 4. On-disk parquet cache

Ticks get re-read constantly (re-running a backtest, and especially every optimization trial
in WO16). Add a small cache so a given (symbol, start, end, flags) is fetched from MT5 once.

- Add `tick_cache.py` under `src/q_backend/market_data/`:
  - `cache_dir()` — a configurable directory (env `Q_TICK_CACHE_DIR`, default a `tick_cache/`
    under the repo's data/working dir — match how the project resolves other paths; check
    `configs/`/settings if a base data dir convention exists, otherwise a temp-style dir).
  - A deterministic cache key from `symbol`, `start`, `end`, `flags` (e.g. a slug +
    short hash). One parquet file per key.
  - `load(key) -> dict[str, np.ndarray] | None` and `store(key, arrays)` using
    `pyarrow.parquet`. Round-trip must preserve dtypes (`int64` time_msc, `float64` prices).
- Wire it into `get_ticks_columnar`: check cache → on miss, fetch from MT5 → store → return.
  Add a `use_cache: bool = True` param so tests and forced refetches can bypass it.

> **GUARDRAIL — cache only, never the source of truth.** A corrupt/partial cache file must
> degrade gracefully (treat as a miss and refetch), never crash a backtest. Wrap loads in a
> try/except that falls through to MT5 on any read error.

### 5. Surface on `MarketDataService`

Add `get_ticks_columnar(self, symbol, start, end, flags=...) -> dict[str, np.ndarray]` as a
pass-through to the client, matching the existing `get_ticks` delegation style. WO13's engine
and WO16's optimizer will call this, not the client directly.

### 6. Tests

Follow the existing MT5-test approach (find how current tests fake the MT5 client /
`mt5.*` — look under `tests/` for `copy_rates`/`copy_ticks` mocking; **no live terminal in
tests**). Build a fake structured NumPy array with the tick dtype as fixtures.

- Structured-array → arrays conversion: correct dtypes, correct field mapping, ascending
  `time_msc`, optional-field synthesis when a dtype lacks `last`/`flags`.
- Chunking: a fake client returning multiple chunks concatenates correctly with no gaps/dupes
  at chunk boundaries; cursor advances past the last `time_msc`.
- Empty range → length-0 arrays (not `None`, no exception).
- Cache: `store` then `load` round-trips arrays byte-equal; corrupt file → miss → refetch;
  `use_cache=False` always hits the client.
- `_MAX_TICKS` guard raises `ValueError` past the cap.

### 7. Docs

- Create `q_backend/docs/tick-engine-deps.md` (task 1 outcome).
- Update `q_backend/README.md`: note the new `get_ticks_columnar` loader and the tick cache
  (env var, location, how to clear it).

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `q_backend/docs/tick-engine-deps.md` exists with a clear **viable / not-viable** verdict and
  the resolved versions.
- In your final message, paste:
  1. The exact `get_ticks_columnar` signature and the **array dict contract** (keys + dtypes)
     — WO13's `TickStrategy`/engine and WO16's optimizer build against this.
  2. The Numba verdict (one line: viable @ versions X/Y, or not-viable → pure-NumPy fallback).
  3. The cache key scheme and cache-dir env var.

## Out of scope

- The tick engine, `TickStrategy`, the kernel (WO13).
- Any API endpoint or request/response change (WO14).
- Any frontend change (WO15).
- The optimization tick runner (WO16).
- Touching or changing the existing `get_ticks` / `Tick` tape path.
- Streaming/live ticks — this is historical-range loading for backtests only.
