# WO22 — Backend: Parquet data lake for backtest artifacts (trades + equity curve)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Research Validation") turns the platform from a
backtest runner into a research instrument: per-run artifacts on disk, walk-forward
analysis, and cross-run comparison. Today a backtest run persists only a `result_summary`
JSON blob to Postgres — the trades and equity curve are returned once in the HTTP response
and then **gone forever**. The schema has been waiting for this from day one:
`BacktestRun.lake_paths` (`storage/db/models.py` ~line 113) and `DataIngestionRun.lake_path`
exist, the `update_backtest_run` repository function already accepts `lake_paths`
(`storage/db/repositories.py` ~line 201), and `storage/settings.py` already defines
`data_lake_root: str = "data/lake"`. Nothing writes to any of it. This work order builds the
lake writer/reader and wires backtest runs in. It is the foundation for WO24 (walk-forward
persistence) and WO26 (run comparison UI). It is **backend only.**

---

## How things work today (read these files)

- `src/q_backend/storage/settings.py` — `data_lake_root` setting (env-overridable). Use it;
  do not invent a second root.
- `src/q_backend/storage/db/models.py` — `BacktestRun` with `lake_paths` JSON column.
- `src/q_backend/storage/db/repositories.py` — `update_backtest_run(..., lake_paths=...)`.
- `src/q_backend/api/main.py` — `run_backtest` (~line 1207): runs the engine, builds the
  response (trades, equity curve, metrics), and persists the run row. Find where
  `update_backtest_run` is called with the completed status — that's the wiring point.
  Note the persistence rule used throughout: **DB writes are best-effort** (the run must
  succeed and return even with Postgres stopped).
- `src/q_backend/market_data/` tick cache — the existing Parquet precedent
  (`data/tick_cache/`, written via pandas/pyarrow). The lake uses the same stack; no new
  dependency should be needed (verify `pyarrow` is already in `pyproject.toml` — it is,
  via the tick cache work; if not, add it with `uv add`).

---

## Goal

Every completed backtest run writes two Parquet files under the lake root and records
their paths; two new endpoints read them back. Postgres keeps **metadata and pointers
only** — no trades/bars/series in Postgres, same rule as ever.

```
{data_lake_root}/backtests/{run_id}/trades.parquet
{data_lake_root}/backtests/{run_id}/equity.parquet
```

## Tasks

### 1. Lake module

New `src/q_backend/storage/lake/__init__.py` (+ `artifacts.py`) with:

```python
def write_backtest_artifacts(
    run_id: str,
    trades: pd.DataFrame,        # one row per closed trade
    equity_curve: pd.DataFrame,  # time-indexed equity series
) -> dict[str, str]:             # {"trades": <path>, "equity": <path>} (relative to lake root)
def read_backtest_artifact(run_id: str, kind: Literal["trades", "equity"]) -> pd.DataFrame:
def delete_backtest_artifacts(run_id: str) -> None:
```

- Paths come from `storage/settings.py` `data_lake_root`; create directories on demand.
- Store **relative** paths in `lake_paths` (the lake root may move between machines).
- `read_backtest_artifact` raises `FileNotFoundError` when missing — callers map to 404.
- Keep the module import-light (pandas + settings only), importable from `api/main.py`
  and the walk-forward work (WO24) without circular imports.

### 2. Wire into `run_backtest`

After a successful run, where the run row is updated to `completed`: build the trades
DataFrame (from the closed trades already serialized for the response) and the equity
DataFrame (from the equity curve already computed for the response — do **not** recompute),
call `write_backtest_artifacts`, and pass the returned dict as `lake_paths` to
`update_backtest_run`.

> **GUARDRAIL — best-effort, like the DB.** A lake write failure (disk full, permission)
> must be caught and logged; the run response and the DB row (with `lake_paths=None`) still
> succeed. Symmetrically: if Postgres is stopped, the artifacts are **still written** (the
> path key is `run_id`, which exists before persistence) — artifact files with no DB row are
> acceptable orphans.

### 3. Artifact read endpoints

```
GET /api/v1/backtests/{run_id}/artifacts/equity  → {"run_id": ..., "points": [{"time": ISO, "equity": float}, ...]}
GET /api/v1/backtests/{run_id}/artifacts/trades  → {"run_id": ..., "trades": [...]}   # same trade shape as the live BacktestResponse
```

404 with a clear detail string when the run or the file is missing (old runs predating
this WO have no artifacts — the frontend must get a 404, not a 500). These endpoints read
Parquet directly; they must work with Postgres stopped if given a valid `run_id`.

### 4. Delete hygiene

`DELETE /api/v1/backtests/{run_id}` and the bulk-delete endpoint also call
`delete_backtest_artifacts` (best-effort) so the lake doesn't accumulate orphans from
deleted runs.

### 5. Tests

- Round trip: write artifacts for a synthetic run → read both back → frames equal
  (use `tmp_path` to override the lake root; check how `storage/settings.py` reads env —
  monkeypatch the settings object or `Q_DATA_LAKE_ROOT`).
- `run_backtest` flow (TestClient, faked market data service): completed run has
  `lake_paths` set and both files exist on disk.
- Lake write failure (monkeypatch writer to raise) ⇒ run response still 200, run row
  still `completed`, `lake_paths` null.
- Artifact endpoint 404s: unknown run id; known run with deleted files.
- Delete endpoint removes the artifact directory.

### 6. Docs

Update `q_backend/README.md`: flip the storage-tier table's "Analytical (future)" row to
present tense for backtest artifacts; document the layout and the two endpoints.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Existing backtest/persistence tests green and unmodified (the response shape is
  untouched; `lake_paths` was already in the schema).
- In your final message, paste: the exact artifact endpoint JSON shapes (WO26's frontend
  builds against them) and the lake layout convention (WO24 extends it with
  `walkforward/{run_id}/...`).

## Out of scope

- Walk-forward artifacts (WO24 reuses this module).
- OHLCV/tick ingestion into the lake (the ingestion-run plumbing exists but is a separate
  later phase; do not touch `DataIngestionRun`).
- Optimization-study artifacts (trials already persist to Postgres as metadata).
- Any frontend change (WO26).
- Retention policies / compaction / partitioning schemes beyond one directory per run.
