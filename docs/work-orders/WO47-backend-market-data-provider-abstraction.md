# WO47 — Backend: Market-data provider abstraction (run with or without MT5)

## Shared context (read first)

You are working in a two-repo project. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this batch ("Local Data Store"):** the whole app is hard-wired to MetaTrader 5,
which is Windows-only. The owner wants to develop on **Linux**, where MT5 does not exist, by
carrying a **local parquet store** of market data on a USB drive. The end state: when MT5 is
available we use it; when it isn't, we read the same data from local parquet — selectable as a
setting on the System page (`auto` / `mt5` / `local`). This batch builds that. A later UI
("Storage") fills the parquet store from MT5 on Windows.

**This work order is the enabling refactor and is backend only.** It does two things and no
more: (1) make the backend **boot and run without `MetaTrader5` installed**, and (2) turn the
single MT5 wrapper into a **provider router** with a persisted data-source setting and two
System endpoints. It introduces a `LocalParquetClient` **stub** that satisfies the interface
but has no data yet — WO48 fills it. Nothing about MT5 behavior changes when MT5 is present.

**Prerequisite:** none. **Unblocks:** WO48 (local store + ingestion), WO50 (ticks).

---

## How things work today (read these files)

Everything that reads market data funnels through **one object**, `MarketDataService` — this
is the seam, and the reason this refactor is small.

- `src/q_backend/market_data/service.py` — `MarketDataService`: constructs a single
  `MetaTraderClient` and delegates `get_ohlcv`, `get_available_ohlcv_range`, `get_ticks`,
  `get_ticks_columnar`, `get_recent_ticks`, `search_symbols`, plus `initialize`/`shutdown`.
  **`import MetaTrader5 as mt5` at module top (line 7)** and `flags: int = mt5.COPY_TICKS_ALL`
  as a default arg (~line 115) — both must stop being import-time MT5 references.
- `src/q_backend/market_data/clients/metatrader.py` — `MetaTraderClient`, the only real
  provider today. **`import MetaTrader5 as mt5` at top (line 8)**, `TIMEFRAME_MAP` built from
  `mt5.TIMEFRAME_*` at import (~line 179), `get_ticks_columnar(..., flags=mt5.COPY_TICKS_ALL)`
  default (~line 612). Public method surface to preserve verbatim: see "Provider interface".
- `src/q_backend/api/main.py` — `import MetaTrader5 as mt5` (~line 33) and
  `from ...metatrader import _to_naive_local`. Constructs the module-level
  `market_data_service = MarketDataService()` (~line 481). Several endpoints **reach past the
  service into `market_data_service.mt5_client`** directly:
  - `.mt5_client._is_initialized` (~lines 805, 908, 956)
  - `.mt5_client.connect()` (~lines 985, 1196, 1223, 1246, 1276, 1371, 1449)
  - `.mt5_client.get_symbol_info(symbol)` (~lines 815, 1256, 1281)
    These couplings must move onto the service so no endpoint imports mt5 or assumes the active
    provider is MT5.
- `src/q_backend/tasks/worker_context.py` — each Dramatiq worker process builds its **own**
  `MarketDataService` lazily (`get_worker_market_data_service`, ~line 36). The data-source
  setting must therefore be readable from a **separate process**, not held in API memory.
- `src/q_backend/market_data/tick_cache.py` — precedent for parquet on disk and for resolving
  a configurable root relative to the project (`cache_dir()`, env `Q_TICK_CACHE_DIR`). Mirror
  its root-resolution + slug style in WO48.
- `src/q_backend/storage/settings.py` — `Settings(BaseSettings)`, `env_prefix="Q_"`. Add the
  new market-data root here (used in WO48). This WO adds the data-source runtime config.
- `pyproject.toml` — `MetaTrader5` is currently a hard dependency. It must become **optional /
  Windows-only** so `uv sync` on Linux doesn't fail and the import can be absent at runtime.

---

## Goal

1. The backend **imports, boots, and serves** with `MetaTrader5` absent.
2. `MarketDataService` becomes a **router** over an ordered set of providers, resolving the
   active one from a **persisted** data-source setting (`auto` | `mt5` | `local`).
3. A `LocalParquetClient` exists implementing the full interface (stubbed reads until WO48).
4. Two System endpoints expose and change the setting; health reports provider availability.

No engine/worker/`backtest_runner` call sites change — they keep calling the same service
methods.

---

## Tasks

### 1. Make `MetaTrader5` optional everywhere

- In `clients/metatrader.py`, `service.py`, and `api/main.py`, replace top-level
  `import MetaTrader5 as mt5` with a guarded import:

  ```python
  try:
      import MetaTrader5 as mt5
      MT5_IMPORTABLE = True
  except Exception:  # ImportError on Linux; DLL errors on misconfigured Windows
      mt5 = None
      MT5_IMPORTABLE = False
  ```

- Remove **all import-time** uses of `mt5.*`:
  - `TIMEFRAME_MAP` (metatrader.py): build lazily. Prefer a plain `{"M1": "M1", ...}` name map
    plus a function `_mt5_timeframe(name) -> int` that resolves `getattr(mt5, f"TIMEFRAME_{name}")`
    on demand (raises a clear error if `mt5 is None`). Keep the accepted timeframe **names**
    importable without MT5 (WO48 and validation need the list).
  - `get_ticks_columnar` / `get_ticks` default `flags=mt5.COPY_TICKS_ALL` → default to `None`
    in the signature and resolve to `mt5.COPY_TICKS_ALL` inside the body when MT5 is present.
- `MetaTraderClient.is_available() -> bool`: `MT5_IMPORTABLE and self.connect()` succeeds
  (cheap, lock-guarded; return `False` instead of raising when the terminal is unreachable).
- In `api/main.py`, remove the bare `import MetaTrader5 as mt5`. Any remaining endpoint use of
  `mt5.COPY_TICKS_ALL` (e.g. the tick-chart endpoint ~line 564) routes through the service
  (default flags resolved provider-side).

> **GUARDRAIL:** with MT5 present (Windows), behavior is **identical** to today — same
> timeframes, same flags, same results. The lazy resolution must produce the exact same MT5
> constants. Prove it with a test that `_mt5_timeframe("M5")` equals `mt5.TIMEFRAME_M5` when
> MT5 is importable, and that all 21 current `TIMEFRAME_MAP` keys still resolve.

### 2. Define the provider interface

New `src/q_backend/market_data/clients/base.py` — a `typing.Protocol` (or ABC)
`MarketDataProvider` declaring the surface the service delegates:

```python
def is_available(self) -> bool: ...
def connect(self) -> bool: ...
def disconnect(self) -> None: ...
def get_ohlcv(self, symbol, timeframe, start, end) -> list[OHLCV]: ...
def get_available_ohlcv_range(self, symbol, timeframe) -> OhlcvAvailableRange | None: ...
def get_ticks(self, symbol, start, end) -> list[Tick]: ...
def get_ticks_columnar(self, symbol, start, end, flags=None, use_cache=True) -> dict[str, np.ndarray]: ...
def get_recent_ticks(self, symbol, limit=200) -> list[Tick]: ...
def search_symbols(self, query) -> list[dict]: ...
def get_symbol_info(self, symbol) -> dict | None: ...
```

`MetaTraderClient` already satisfies all of these except `is_available` (add it). Do not
change `MetaTraderClient`'s method bodies beyond the optional-import edits in Task 1.

### 3. Data-source runtime config (cross-process)

New `src/q_backend/storage/runtime_config.py`:

- Reads/writes a small JSON file `data/runtime_config.json` (resolve the path the same way
  `tick_cache.cache_dir()` resolves its root; env override `Q_RUNTIME_CONFIG_PATH`). Shape:
  `{"data_source": "auto" | "mt5" | "local"}`. Default `"auto"` when the file is absent.
- `get_data_source() -> str` and `set_data_source(value) -> None` (validate the enum). Cheap;
  re-read per call (the file is tiny) so a setting change in the API process is observed by
  worker processes without a restart.

### 4. `MarketDataService` becomes a router

Rewrite `service.py` so the service:

- Builds the available providers once: a `MetaTraderClient` (always constructable — it just
  won't be _available_ without MT5) and a `LocalParquetClient` (Task 5).
- `_resolve_provider() -> MarketDataProvider`: read `get_data_source()`:
  - `"mt5"` → MetaTrader client (raise a clear `ConnectionError` if not available).
  - `"local"` → local client.
  - `"auto"` → MetaTrader client if `is_available()` else local client.
- Delegate **every** public method to `_resolve_provider()`. Keep the existing public method
  names and signatures byte-compatible (`get_ohlcv`, `get_ticks_columnar`, …) plus add:
  - `is_available()` (mt5 client availability), `get_symbol_info(symbol)`,
    `active_provider() -> Literal["mt5","local"]`, `mt5_available() -> bool`.
- Keep `initialize()`/`shutdown()` (lifespan) — `initialize()` connects MT5 **best-effort**
  (a failed MT5 connect must NOT crash startup; it just means `auto` resolves to local).
- Remove the assumption that `self.mt5_client` is the data path; endpoints will call the new
  service methods instead (Task 6). You may keep a `self.mt5_client` attribute for the
  MT5-specific endpoints that legitimately need live-only features, but they must guard on
  `is_available()` and degrade (see Task 6).

### 5. `LocalParquetClient` stub

New `src/q_backend/market_data/clients/local.py` implementing `MarketDataProvider`:

- `is_available()` → `True` (no external dependency).
- `connect()` → `True`; `disconnect()` → no-op.
- All read methods return **empty** results for now (`[]` / `_empty_ticks_columnar()`-shaped
  dict / `None` range) and log a debug line. WO48 replaces these bodies with parquet reads.
- This keeps `local` mode selectable end-to-end (it returns "no data" cleanly) before WO48.

### 6. Decouple endpoints from `mt5_client`

In `api/main.py`, replace direct `market_data_service.mt5_client.*` access:

- `.mt5_client._is_initialized` → `market_data_service.mt5_available()` (health/status
  endpoints report MT5 connectivity; in `local` mode this is just informational).
- `.mt5_client.connect()` guards → `market_data_service.is_available()` (and proceed via the
  service; don't hard-fail data reads in `local` mode).
- `.mt5_client.get_symbol_info(symbol)` → `market_data_service.get_symbol_info(symbol)`.
- **Live-only endpoints** (recent ticks / snapshots / time-and-sales / symbol search against
  the broker) have no offline source yet. In `local` mode they should **degrade**, not 500:
  return an empty list / a clear `provider: "local"` marker / 200-with-empty, never an
  exception wall. (WO48 makes `search_symbols`/`get_symbol_info` answer from the catalog; for
  now empty is fine.)

### 7. System endpoints

Add to `api/main.py`:

```
GET  /api/v1/system/data-source  → {"source": "auto"|"mt5"|"local", "mt5_available": bool, "active_provider": "mt5"|"local"}
PUT  /api/v1/system/data-source  body {"source": "auto"|"mt5"|"local"} → same shape as GET
```

Extend `GET /api/v1/system/health` (and the `SystemHealthResponse` model) additively with
`mt5_available: bool` and `active_provider: "mt5"|"local"`. Do not change existing health
fields' shapes (the frontend reads them).

### 8. Packaging — MT5 optional

In `pyproject.toml`, move `MetaTrader5` out of the always-installed dependencies into an
optional/platform-scoped group so `uv sync` succeeds on Linux. Prefer an environment marker
(`MetaTrader5 ; sys_platform == "win32"`) if the project's dependency table supports it;
otherwise an optional extra (`[project.optional-dependencies] mt5 = ["MetaTrader5"]`) and note
the Windows install command in the README. **Verify** `uv sync` still installs MT5 on Windows.

### 9. Tests

- Optional-import: monkeypatch `metatrader.mt5 = None` / `MT5_IMPORTABLE = False`, import the
  package and construct `MarketDataService` — no exception; `mt5_available()` is `False`;
  `active_provider()` is `"local"` under `auto`.
- Timeframe parity (MT5 present): `_mt5_timeframe` matches `mt5.TIMEFRAME_*` for all 21 names.
- Router resolution: with the runtime config set to each of `auto`/`mt5`/`local` (use
  `tmp_path` + `Q_RUNTIME_CONFIG_PATH`), `_resolve_provider()` returns the expected provider;
  `mt5` with MT5 unavailable raises a clear error.
- Endpoints (TestClient): `GET`/`PUT /system/data-source` round-trips and persists to the JSON
  file; `health` includes the two new fields.
- Existing market-data/backtest tests green and unmodified (faked services already bypass MT5).

### 10. Docs

Update `q_backend/README.md`: document the provider abstraction, the `auto/mt5/local` setting,
`Q_RUNTIME_CONFIG_PATH`, and the Windows-only MT5 install step.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- The package imports and `uvicorn` boots with `MetaTrader5` uninstalled (simulate by
  monkeypatching the import in a test; if you can, also try it in a clean Linux-like env).
- With MT5 present on Windows, OHLCV/tick behavior is unchanged.
- In your final message, **paste**: (a) the `MarketDataProvider` interface (method list +
  signatures) — WO48 implements it for parquet; (b) the exact `GET/PUT /system/data-source`
  and extended `health` JSON shapes — WO49 builds the System card against them.

## Out of scope

- Any actual parquet reading/writing (WO48) — `LocalParquetClient` stays a returns-empty stub.
- Tick parquet (WO50). Storage ingestion API/UI (WO48/WO49). Any frontend change (WO49).
- Changing engine/worker/`backtest_runner` call sites (they must keep working untouched).
