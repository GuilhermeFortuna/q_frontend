# WO81 — Backend: exit-quality analytics for Discovery candidates

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** WO79/WO80 make exit policies a bigger part of Discovery. We now need to
know whether exits are actually better, not just whether the final OOS objective improved. This WO
adds exit-quality analytics to candidate results: exit reason distribution, PnL by exit reason,
holding period, MAE/MFE-style path quality, and "profit giveback" where data supports it. These
metrics feed diagnostics, candidate metadata, and later frontend insight panels.

This WO is backend-only and additive. It must not change ranking by default.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/models.py`
  - `Trade` fields and optional `exit_reason` if present.
- `src/q_backend/backtesting/registry.py`
  - closed trade collection and performance metrics.
- `src/q_backend/optimization/walkforward.py`
  - stitched OOS trades and aggregate OOS metrics.
- `src/q_backend/optimization/strategy_search.py`
  - `CandidateResult`, `evaluate_candidate`, candidate metadata.
- `src/q_backend/api/strategy_search_jobs.py`
  - candidate serialization/persistence/rebuild paths.
- `src/q_backend/storage/lake/artifacts.py`
  - OOS trade artifacts.
- Tests to read/extend:
  - `tests/optimization/test_walkforward.py`
  - `tests/optimization/test_strategy_search.py`
  - `tests/api/test_strategy_search_persistence.py`

---

## Goal

Every Discovery candidate can explain its exit behavior:

```json
{
  "exit_quality": {
    "total_closed_trades": 42,
    "by_reason": {
      "fixed_sl": { "trades": 12, "total_pnl": -4200.0, "win_rate": 0.0 },
      "chandelier": { "trades": 19, "total_pnl": 15750.0, "win_rate": 0.58 },
      "signal": { "trades": 11, "total_pnl": 2100.0, "win_rate": 0.45 }
    },
    "holding_period": { "median_bars": 8, "p90_bars": 32 },
    "path_quality": {
      "avg_mfe_capture_ratio": 0.47,
      "avg_profit_giveback": 310.0,
      "avg_mae": -180.0
    }
  }
}
```

Metrics should be robust when bar path data is unavailable: compute what can be computed from trades
alone, and omit or null the rest.

## Tasks

### 1. Add an exit analytics module

Create `src/q_backend/optimization/exit_quality.py` with pure functions:

```python
def summarize_exit_reasons(trades: list[Trade] | pd.DataFrame) -> dict[str, Any]: ...
def summarize_holding_periods(trades: list[Trade] | pd.DataFrame, bars: pd.DataFrame | None = None) -> dict[str, Any]: ...
def summarize_trade_path_quality(trades: list[Trade] | pd.DataFrame, bars: pd.DataFrame) -> dict[str, Any]: ...
def summarize_exit_quality(trades: list[Trade] | pd.DataFrame, bars: pd.DataFrame | None = None) -> dict[str, Any]: ...
```

Rules:

- `exit_reason` missing/null maps to `"unknown"`.
- Long/short MAE/MFE signs must be normalized so favorable excursion is positive and adverse is
  negative.
- When bar data is absent, return reason and holding-period summaries only.
- Never raise on an empty trade list; return an empty but typed summary.

### 2. Wire into Discovery candidate evaluation

In `evaluate_candidate`, attach `exit_quality` to candidate metadata or to an additive optional field
on `CandidateResult`.

Preferred shape:

```python
class CandidateResult:
    ...
    diagnostics: dict[str, Any] | None = None
```

If changing `CandidateResult` is too broad, use existing `candidate_metadata` paths. Keep payload keys
optional.

Use OOS trades only. Do not calculate exit quality from in-sample optimization trades.

### 3. Persist/rebuild through API

Update `api/strategy_search_jobs.py` serialization and DB rebuild paths so `exit_quality` survives:

- live job result,
- persisted DB candidate,
- lake artifact rebuild if DB metadata is missing.

All fields are additive. Existing rows without `exit_quality` must rebuild safely.

### 4. Optional fitness hook, default off

Add config for future experimentation:

```python
class ExitQualityScoringConfig(BaseModel):
    enabled: bool = False
    min_mfe_capture_ratio: float | None = None
    max_profit_giveback_pct: float | None = None
```

Do **not** alter default ranking. When enabled, only add diagnostics or a soft metadata score unless
the tests explicitly cover score impact.

## Guardrails

> **OOS only.** Exit-quality summaries must use stitched OOS trades. Do not mix in the in-sample
> optimization windows.

> **Ranking unchanged by default.** Existing candidate order must not change unless an explicit new
> scoring config is enabled.

> **No storage bloat.** Keep aggregate summaries in Postgres JSON. Full OOS trades stay in the lake.

> **Bar path optional.** Reason distribution and PnL by reason must work even when bars are not
> available. MAE/MFE metrics are nullable/omitted when path data is missing.

> **No frontend requirement.** Old frontend payload consumers must ignore these optional fields.

## Tests

- Unit tests for `exit_quality.py`:
  - empty trades,
  - missing exit reasons,
  - PnL by reason,
  - long and short MAE/MFE normalization,
  - holding period by bars when bars are supplied and by timestamps when not.
- Strategy-search tests:
  - candidate receives OOS-only `exit_quality`.
  - default `_rank_results` order is unchanged with diagnostics present.
- API/persistence tests:
  - live payload includes optional `exit_quality`.
  - persisted/rebuilt results retain it.
  - old candidate rows without it still serialize.

## Docs

`q_backend/README.md`: document the `exit_quality` candidate diagnostic payload and clarify that it
does not affect ranking by default.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Candidate results expose exit-quality diagnostics from OOS trades without changing default
  ranking.
- Final message must paste:
  - the `exit_quality` JSON shape,
  - which metrics are trade-only vs bar-path-dependent,
  - confirmation that ranking is unchanged by default.

## Out of scope

- Creating exit-preset candidates — WO79.
- Genetic exit-policy mutation — WO80.
- Frontend visualization — WO82.
