# WO179 — Backend: silent-failure policy sweep

## Shared context (read first)

Part of the WO177–WO182 hardening batch (no new features). The failure mode this codebase must fear
most is not a crash but a silently wrong number: a swallowed exception in a research path degrades
results without anyone knowing. This WO establishes and enforces a policy for exception handling
and silent data loss.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest`).

## Files to read (the audit list, 2026-07-02)

Handlers that catch `Exception` and neither re-raise nor log within the following three lines:

- `src/q_backend/optimization/genetic_search.py:208` (data-provider failure → silently `return
None`, candidate scored as if data never existed)
- `src/q_backend/optimization/runner.py:80`, `strategy_search.py:607`,
  `research_acceptance_service.py:82`
- `src/q_backend/features/evaluation_service.py:152, 220, 298`
- `src/q_backend/api/backtest_jobs.py:329`, `strategy_search_jobs.py:1590, 1615`,
  `alpha_research_jobs.py:91`, `api/main.py:71`
- `src/q_backend/backtesting/custom_strategy_store.py:19`
- `src/q_backend/storage/health.py:21, 29`
- `src/q_backend/execution/quote_source.py:67`, `execution/service.py:476` (this one already
  transitions to UNKNOWN — verify it is fully handled by WO178 and only needs a log line)
- `src/q_backend/market_data/clients/metatrader.py:12, 403`
- `src/q_backend/api/services/news.py:59, 128` (128 is `except Exception: pass`)

Plus one silent-data-loss case that is not an exception handler:

- `src/q_backend/backtesting/session_context/frame.py:41–47` stores `_PREPARED_MARKER` and
  `session_context_config` in `DataFrame.attrs`, but the OHLCV cache round-trips frames through
  parquet (`src/q_backend/tasks/data.py:96`), which drops attrs (`UserWarning: Could not serialize
pd.DataFrame.attrs … defaulting to empty attributes` in the current test run). Cache-hit and
  cache-miss frames therefore carry different metadata.

## Goal

Every catch site fits one of three sanctioned patterns, chosen deliberately and visible in the code:

```python
# 1. must-surface: research/execution correctness depends on it
raise CandidateDataError(...) from exc          # typed, propagates to the job layer

# 2. best-effort: optional enrichment, absence is acceptable
logger.warning("news enrichment failed for %s: %s", symbol, exc)  # always logged, never bare pass

# 3. already-handled: state machine absorbs it (e.g. UNKNOWN order)
logger.exception(...)  # plus the existing transition
```

## Tasks

1. Classify each listed site into one of the three patterns. Default assumption: anything in
   `optimization/`, `features/`, `backtesting/`, or `execution/` is must-surface unless you can
   argue otherwise; `news.py` and `storage/health.py` are plausibly best-effort.
2. Apply the fix per site. For must-surface sites, make sure the raised error reaches the job/run
   record (failed status + message), not just the log — check how each `*_jobs.py` layer records
   failures and use it.
3. `genetic_search.py:208` gets special attention: decide with evidence what a data-provider
   failure should do to the candidate (fail the run vs. mark the candidate invalid with a counted,
   reported reason). Silent `None` is not an option; a discovery run must report how many
   candidates died and why.
4. Fix the session-context attrs loss: persist the marker/config outside `DataFrame.attrs` (e.g.
   re-derive on load, or store alongside the parquet), and make `prepare_session_context` behavior
   identical for cache-hit and cache-miss frames. Add a regression test that round-trips a prepared
   frame through the cache path.
5. Enforce the policy going forward: enable ruff rules `BLE001` (blind except) and `S110`
   (try-except-pass) in `pyproject.toml` for `src/q_backend`, with per-line `# noqa` plus a
   one-line justification for every sanctioned best-effort site. The codebase currently has no ruff
   section — add one scoped to just these rules so this WO does not turn into a lint-the-world
   exercise.

## Guardrails

> Do not change what any happy path computes — this WO changes only failure behavior.
> No new broad `except Exception` sites.
> If classifying a site requires understanding you don't have, stop and record the question in the
> final message rather than guessing must-surface vs best-effort.

## Tests

- Per must-surface site: a test that injects the failure and asserts the job/run ends failed with
  the typed error message (extend the existing `tests/optimization/`, `tests/features/`,
  `tests/api/` suites next to the code they cover).
- Discovery run with N failing candidates reports the count and reasons in its result payload.
- Session-context cache round-trip regression test (`tests/backtesting/`).
- `uv run ruff check src` passes with the new rules.

## Docs

Add a short "Exception policy" section to `q_backend/README.md` with the three patterns.

## Definition of done

`uv run pytest` passes and `uv run ruff check src` passes — do not report completion until both do.
Final message must include the classification table: site → pattern → change made.

## Out of scope

The UNKNOWN-order reconciler itself (WO178). Frontend error handling. The remaining ~880 pytest
warnings beyond the parquet-attrs one.
