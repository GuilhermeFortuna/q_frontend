# WO84 — Backend: reuse Discovery OHLCV frames for exit diagnostics

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** WO81 added exit-quality diagnostics that need OOS trades and, when
available, the OHLCV bar path. A review found that distributed Discovery candidate workers now load the
same OHLCV frame twice per candidate: once to build `DefaultBacktestRunner.from_frame_sliced(...)`, and
again to pass `ohlcv` into `evaluate_candidate` for diagnostics. This directly hurts larger registry
and genetic discovery runs.

This WO is backend-only and should be a small performance/correctness cleanup. It must preserve WO81
diagnostics while restoring single-load behavior inside each candidate worker.

---

## How the pieces work today (read these files)

- `src/q_backend/api/strategy_search_jobs.py`
  - `_candidate_runner(request)` loads OHLCV and wraps it in `DefaultBacktestRunner.from_frame_sliced`.
  - `_candidate_ohlcv(request)` also loads OHLCV.
  - `run_candidate(...)` passes both `_candidate_runner(request)` and `_candidate_ohlcv(request)`.
  - `run_genetic_candidate(...)` does the same.
  - `_genetic_probe_frame(request)` loads an optional frame for viability screening.
- `src/q_backend/optimization/backtest_runner.py`
  - `DefaultBacktestRunner.from_frame_sliced(...)` and any private frame storage already available.
- `src/q_backend/optimization/strategy_search.py`
  - `evaluate_candidate(..., ohlcv=...)` and exit-quality attachment.
- Tests to read/extend:
  - `tests/api/test_strategy_search_persistence.py`
  - `tests/optimization/test_strategy_search.py`
  - any existing call-count/load-count tests around Discovery/genetic search.

---

## Review finding this fixes

The current distributed worker path does:

```python
result = evaluate_candidate(
    candidate,
    request,
    _candidate_runner(request),   # loads OHLCV
    ohlcv=_candidate_ohlcv(request),  # loads OHLCV again
)
```

The same pattern exists for genetic candidates. The exit-quality bar path is useful, but it should not
double market-data loading.

## Goal

Each distributed candidate worker loads the run's OHLCV frame once and reuses that frame for:

- the sliced walk-forward/backtest runner,
- exit-quality diagnostics passed to `evaluate_candidate`.

The in-process path should keep using the already-loaded runner frame. The genetic viability probe
should not introduce unnecessary extra loads beyond its current documented purpose.

## Tasks

### 1. Replace separate runner/frame helpers with one load seam

Introduce a helper in `strategy_search_jobs.py` such as:

```python
def _candidate_runner_and_ohlcv(request: StrategySearchConfig) -> tuple[DefaultBacktestRunner, pd.DataFrame]:
    frame = load_ohlcv_frame(...)
    return DefaultBacktestRunner.from_frame_sliced(frame), frame
```

Use it in:

- `run_candidate(...)`,
- `run_genetic_candidate(...)`,
- `_finalize_genetic(...)` if lock-box/finalization still builds a runner from a freshly loaded frame.

Remove `_candidate_ohlcv` if it becomes unused.

### 2. Preserve exit-quality behavior

`evaluate_candidate` must still receive the same bar frame for WO81 diagnostics. Do not degrade to
trade-only summaries when the frame is already available.

### 3. Audit genetic probe loads

`_genetic_probe_frame` is separate because it can be disabled and is used for seeding/repair/prescreen.
Do not blindly merge it with candidate evaluation if that changes behavior. Instead:

- keep it documented as a separate best-effort probe, or
- reuse a loaded frame only where the same worker already has one.

Add a short comment if the separate probe load remains intentional.

## Guardrails

> **No diagnostic regression.** Exit-quality path metrics should still be present when bars are
> available.

> **No ranking change.** Candidate scores and rank order must not change.

> **No broader cache redesign.** This WO is about eliminating the immediate duplicate load per worker,
> not building a distributed market-data cache.

> **No private-field dependence unless already established.** Prefer passing the local frame explicitly
> over reaching into runner internals from new code.

## Tests

- Add a call-count test that patches/spies on `load_ohlcv_frame`:
  - `run_candidate` loads once for one registry candidate;
  - `run_genetic_candidate` loads once for one evaluated genome, excluding any explicitly enabled
    probe-frame setup outside that worker.
- Existing exit-quality tests still prove bar-path metrics are attached.
- Existing strategy-search persistence/distributed tests still pass.

## Docs

`q_backend/README.md`: if it currently describes Discovery data loading, update it to state that
candidate workers reuse the loaded OHLCV frame for both walk-forward evaluation and exit diagnostics.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Call-count tests prove no duplicate `load_ohlcv_frame` call in the candidate worker path.
- Final message must paste:
  - the helper/seam used to share the frame,
  - the load-count tests added,
  - confirmation that exit-quality diagnostics still receive bar data.

## Out of scope

- A cross-process OHLCV cache.
- Frontend changes.
- Any change to ranking or exit-quality formulas.
