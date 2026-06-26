# WO129 — Backend: Feature matrix builder + lake cache + provenance manifest

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md`. Depends on **WO127** (registry) + **WO128** (compute).
WO133 (evaluation) consumes the matrices this WO produces.

**Principle:** building a feature matrix for `(symbol, timeframe, date range, feature set)` is
expensive; compute once, cache by a content hash of its inputs, and ship a provenance manifest so any
matrix can be traced back to exactly which feature versions + params + bar range produced it.

## How the pieces work today (read these files)

- `src/q_backend/features/compute.py` (WO128) — `compute_feature(bars, spec, params) -> FeatureSeries`.
- `src/q_backend/features/registry.py` (WO127) — `get_feature_spec`, `resolve_params`, `feature_id`.
- `src/q_backend/market_data/local_store.py::read_ohlcv(symbol, timeframe, start, end)` — the bar
  source. `_bars_to_dataframe` shows the frame shape.
- `src/q_backend/storage/lake/artifacts.py` — `lake_root()`, `_run_dir`, and the
  `write_backtest_artifacts`/`read_backtest_artifact` parquet pattern. **Copy this storage shape for
  feature matrices — parquet under the lake, a sibling JSON manifest.**

## Goal

```python
# src/q_backend/features/matrix.py
@dataclass(frozen=True)
class FeatureRequest:
    name: str
    version: int | None
    params: dict[str, Any]

@dataclass(frozen=True)
class FeatureMatrix:
    matrix_id: str               # content hash (see Task 2)
    frame: pd.DataFrame          # index = bar time, columns = feature_id(s)
    manifest: dict[str, Any]     # provenance (see Task 3)

def build_feature_matrix(
    symbol: str,
    timeframe: str,
    start: datetime,
    end: datetime,
    features: list[FeatureRequest],
    *,
    use_cache: bool = True,
) -> FeatureMatrix: ...
```

## Tasks

### 1. Build

- Load bars once via `read_ohlcv` (one data load per call). For each `FeatureRequest`: resolve the
  spec + params, `compute_feature`, collect the series as a column named `feature_id(spec, params)`.
- Assemble into a single time-indexed DataFrame (outer-join on bar time; the index is the bar grid).
  The **union warm-up** (max `warmup_bars` across columns) defines `valid_from`; record it in the
  manifest but **do not drop rows** — consumers decide (evaluation trims, a chart may not).

### 2. Content-addressed cache under the lake

- `matrix_id = sha256` of a canonical JSON of `{symbol, timeframe, start, end, [ (feature_id, version,
sorted params) sorted ] }`. Identical inputs → identical id → cache hit.
- Storage: `lake_root()/features/<matrix_id>/matrix.parquet` + `manifest.json`. Add
  `write_feature_matrix(matrix_id, frame, manifest)` and `read_feature_matrix(matrix_id)` next to the
  backtest artifact helpers in `storage/lake/artifacts.py` (mirror their parquet read/write).
- `build_feature_matrix(..., use_cache=True)`: if `matrix_id` is on disk, load + return it without
  recomputing. `use_cache=False` recomputes and overwrites.

### 3. Provenance manifest

The `manifest.json` records exactly what produced the matrix:

```jsonc
{
  "matrix_id": "…",
  "symbol": "EURUSD",
  "timeframe": "H1",
  "start": "2020-01-01T00:00:00Z",
  "end": "2023-01-01T00:00:00Z",
  "bar_count": 18742,
  "valid_from": "2020-01-05T08:00:00Z", // after union warm-up
  "features": [
    {
      "feature_id": "rsi.v1.a1b2",
      "name": "rsi",
      "version": 1,
      "params": { "period": 14 },
      "warmup_bars": 14,
      "leakage_status": "clean",
    },
  ],
  "engine_version": 1, // bump if compute semantics change
  "built_at": "2026-06-26T12:00:00Z",
}
```

### 4. Invalidation rules (document + enforce)

- The cache key includes feature `version` and `engine_version`. Bumping either changes `matrix_id`,
  so old matrices are never silently served for new semantics. Document this in a module comment.
- No TTL — matrices are immutable artifacts keyed by content. A "refresh" is a new id, not a mutation.

## Guardrails

> **One bar load per build.** `read_ohlcv` is called exactly once; all features share that frame.
> **Immutable artifacts.** A `matrix_id` directory, once written, is never edited in place. Different
> inputs → different id.
> **Determinism.** Same inputs → same `matrix_id` and byte-stable parquet ordering (sort columns by
> `feature_id`, rows by time).
> **No leakage smuggling.** The matrix carries each feature's `leakage_status` from WO128; it must not
> recompute or relax it.

## Tests

- `tests/features/test_matrix.py`:
  - `build_feature_matrix` for two features yields a frame with both `feature_id` columns and a
    `valid_from` past the larger warm-up.
  - cache: second call with `use_cache=True` returns the same `matrix_id` and does **not** recompute
    (monkeypatch `compute_feature` to assert it isn't called on the hit).
  - changing a param or feature `version` changes `matrix_id`.
  - manifest round-trips: `read_feature_matrix(matrix_id).manifest` equals what was written.

## Docs

- `docs/design/feature-intelligence.md`: tick matrix + cache landed; note the `engine_version` knob.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: one example `manifest.json` for a 2-feature matrix and confirmation a repeat
  build is a cache hit (no recompute).

## Out of scope

- DB persistence of feature definitions/usage — **WO130**. The HTTP API — **WO131**.
- Targets/labels — **WO132**.
