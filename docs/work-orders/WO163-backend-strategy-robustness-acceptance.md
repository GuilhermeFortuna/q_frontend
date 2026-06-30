# WO163 — Backend: repeated-seed robustness and paper-candidate acceptance

## Shared context (read first)

Read `docs/design/instrument-specific-alpha-research.md`. Depends on WO161 and WO162. This WO defines
what “statistically credible enough for paper trading” means. It is stricter than normal Discovery
ranking and does not change legacy ranking semantics.

Backend repo: `q_backend`, Python managed with `uv`.

## Files to read

- `src/q_backend/optimization/strategy_search.py`
- `src/q_backend/optimization/genetic_search.py`
- `src/q_backend/optimization/walkforward.py`
- `src/q_backend/optimization/dsr.py`
- `src/q_backend/optimization/lockbox.py`
- `src/q_backend/optimization/analytics.py`
- `src/q_backend/api/discovery_ab_jobs.py`
- `src/q_backend/storage/lake/artifacts.py`
- `tests/optimization/`

## Goal

Evaluate a hypothesis candidate across repeated optimization seeds and parameter neighborhoods, then
return one explicit verdict:

```text
ready_for_paper | inconclusive | rejected
```

The result must explain every satisfied, failed, and unavailable criterion.

## Tasks

1. Add `ResearchAcceptanceConfig` to each instrument profile with explicit defaults:
   - at least 6 completed OOS windows;
   - at least 30 stitched OOS trades for H1 swing or 100 for WDO M15 day trade;
   - positive aggregate and median OOS-window return;
   - 5 independent optimization seeds with at least 4 positive OOS outcomes;
   - DSR >= 0.95 using the full effective candidate/trial count;
   - positive lock-box return and Sharpe, profile minimum lock-box trades, and profile drawdown cap.
2. Implement repeated-seed aggregation. Persist every seed's configuration, best parameters, OOS
   metrics, window distribution, and failure reason. Missing/failed seeds cannot be converted to zero.
3. Add parameter-neighborhood analysis around the selected configuration. Generate valid adjacent
   values from the declared search-space step/grid (or bounded perturbations for log/continuous
   ranges), rerun them only on the walk-forward segment, and report profitable-neighbor fraction and
   relative-score retention. An isolated optimum fails plateau acceptance.
4. Compute lower-tail diagnostics: worst window, 25th-percentile window return, maximum losing-window
   streak, trade-count concentration, and regime contribution. These are evidence fields; profile
   configuration decides which are hard gates.
5. Compute DSR from a conservative effective attempt count covering strategy hypotheses, GA genomes,
   Optuna trials, and repeated seeds. Feature-search multiplicity remains accounted for by WO162's
   permutation null floor; document the boundary so the same search burden is not double-counted.
6. Evaluate the lock-box exactly once, after a champion is frozen. Store a consumption record keyed by
   split manifest/champion hash. Refuse to re-evaluate a modified champion against the same consumed
   holdout as if it were fresh evidence.
7. Produce structured criterion rows (`name`, `status`, `observed`, `threshold`, `reason`) and the
   final verdict. Any required criterion without enough evidence yields `inconclusive`.

## Guardrails

- DSR and lock-box are hard acceptance evidence here, not decorative post-rank metrics.
- A losing strategy cannot be `ready_for_paper` because it was the best member of a weak population.
- Do not alter existing Discovery's `passed_gates` or history compatibility; add a separate research
  acceptance layer.
- Parameter-neighborhood runs never inspect or reuse lock-box results.
- One failed holdout cannot be retried by changing the candidate against the same tail and calling it
  untouched.
- Existing transaction-cost configuration flows through unchanged but is not the purpose of this WO.

## Tests

- Positive multi-seed/plateau/holdout fixture returns `ready_for_paper`.
- Best-of-weak-population fixture with negative returns is `rejected`.
- High champion score with DSR below threshold is `rejected`.
- Isolated parameter spike fails plateau acceptance while a broad stable region passes.
- Four completed seeds plus one failed required seed is `inconclusive`, not a fabricated five-seed
  result.
- Holdout-consumption test refuses modified-candidate reuse against the same manifest.
- Criterion serialization/persistence and old Discovery payload compatibility tests.
- Run targeted optimization, genetic, lock-box, DSR, persistence, and API tests, then full
  `uv run pytest`.

## Docs

Update the design doc with the final acceptance schema, profile thresholds, plateau definition, and
holdout-consumption rule.

## Definition of done

The backend can distinguish a promising paper-trading candidate from a leaderboard winner using
reproducible, inspectable evidence and honest inconclusive states.

## Out of scope

Paper-trading execution, live deployment, UI (WO165), and changing normal Discovery defaults.
