# Instrument-Specific Alpha Research

**Status:** approved 2026-06-28 · **Scope:** CCM$ H1 swing, WIN$ H1 swing, WDO$ M15 day trade
· **Goal:** produce statistically credible candidates ready for paper trading

## Why this batch exists

Q already has genetic strategy synthesis, Optuna parameter search, walk-forward evaluation, DSR,
lock-box testing, exit-policy evolution, a Feature Store, and neural-feature experiments. Those are
useful research instruments, but the current genome vocabulary still consists primarily of OHLCV
sources plus conventional technical indicators. A genetic algorithm can only recombine information
that the grammar exposes; more generations cannot create information absent from the feature set.

WO42-WO46 described an earlier Feature Engine direction, but their implementation assumptions predate
the current Feature Store, neural-latent universe, score-biased seeding, adaptive operators, and
experiment-job infrastructure. WO158-WO165 supersede those implementation instructions while
preserving their central idea: widen the causal feature vocabulary, validate information before using
it in strategy search, and keep the final holdout untouched.

This batch is not intended to prove live profitability. Its terminal success state is narrower:

> At least one instrument-specific candidate has enough independent observations, stable walk-forward
> behavior, multiple-seed repeatability, a meaningful DSR, and one successful untouched lock-box
> evaluation to justify paper trading.

## Research tracks

| Profile        | Trading style      | Primary horizons | Initial hypothesis families                                                              |
| -------------- | ------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| `ccm_h1_swing` | CCM$ H1 swing      | 6, 12, 24 bars   | normalized trend, breakout/pullback, volatility regime, calendar/seasonality             |
| `win_h1_swing` | WIN$ H1 swing      | 4, 8, 16 bars    | trend/breakout, prior-session context, volatility regime, lagged WDO$ context            |
| `wdo_m15_day`  | WDO$ M15 day trade | 2, 4, 8 bars     | opening range, session windows, prior-day levels, volatility regime, lagged WIN$ context |

WDO$ M5 is not an initial profile because the current local cache has a substantial historical gap.
It can be added after a continuous-range data preflight passes. Each profile may produce a completely
different strategy; cross-instrument generality is not a requirement.

## Research funnel

```text
instrument profile
  -> causal context features
  -> feature evidence on an early discovery segment
  -> curated, economically named hypothesis templates
  -> parameter search + walk-forward on a disjoint middle segment
  -> repeated seeds and parameter-neighborhood stability
  -> DSR and acceptance gates
  -> one untouched tail lock-box evaluation
  -> ready_for_paper | inconclusive | rejected
```

The GA remains useful, but it is downstream of feature evidence and curated hypotheses. It should
recombine validated context and templates rather than search arbitrary technical-indicator trees as
the first step.

## Data split and leakage boundary

Every alpha-research run uses one immutable split manifest:

```text
[ feature evidence ][ walk-forward + repeated seeds ][ untouched lock-box ]
```

- Feature values may use only information available at or before the decision bar.
- Feature selection and hypothesis admission use only the feature-evidence segment.
- Parameter optimization and GA evolution use only the walk-forward segment.
- The lock-box is evaluated once for the selected champion. A failed lock-box is not reopened by
  changing thresholds, seeds, features, or parameters against the same holdout.
- Cross-instrument joins use backward as-of alignment plus an explicit availability lag.

## Acceptance contract

Acceptance is profile-aware and evidence-based. The defaults are intentionally stricter than the
normal Discovery leaderboard:

- Minimum completed OOS windows: 6.
- Minimum stitched OOS trades: 30 for H1 swing profiles; 100 for WDO$ M15 day trade.
- Positive median OOS-window return and positive aggregate OOS return.
- At least 4 of 5 optimization seeds produce a positive OOS result.
- The champion lies on a parameter plateau rather than an isolated optimum: a configurable fraction
  of valid neighboring parameter configurations remains profitable and retains most of the champion
  score.
- DSR is at least 0.95 after accounting for the effective number of attempted candidates.
- Untouched lock-box: positive return, positive Sharpe, profile minimum trades, and drawdown below the
  profile ceiling.

These defaults are configuration, not hidden constants. A result missing required evidence is
`inconclusive`, never `passed` or `no_effect` by default.

## Work-order map

| WO    | Responsibility                                                                                                                                                                                                                                                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| WO158 | **Implemented.** Normalization transforms (`transform.zscore`, `transform.rank`, `transform.pct_change`, `transform.clip`), `NodeSpec` generation fields (`gen_category`, `gen_random_init`, `gen_add_node`, `gen_swap`), param bounds (`window` 5–200, `change_bars` 1–100, `clip_low`/`clip_high` −5–5), Feature Store parity, GA reachability |
| WO159 | **Implemented.** B3 session/calendar/regime/HTF context (`feature.*` nodes), run-level `_ctx_*` columns via `prepare_evaluation_frame`, Feature Store parity, GA reachability via WO158 metadata                                                                                                                                                 |
| WO160 | **Implemented.** Causal cross-instrument context for WIN$ <-> WDO$ with backward as-of alignment, availability lag, completed-bar resampling, genome `source.exog.*` nodes, and run provenance fingerprints                                                                                                                                      |
| WO161 | **Implemented.** Versioned `InstrumentResearchProfile`/`HypothesisDefinition` models, `RESEARCH_PROFILES` (`ccm_h1_swing`, `win_h1_swing`, `wdo_m15_day`), curated `HYPOTHESIS_CATALOG` with stable IDs, and a deterministic `HypothesisCandidateProvider`                                                                                       |
| WO162 | **Implemented.** Profile-scoped `FeatureEvidence`, purged folds, block-permutation null floor, deflated IC score, redundancy admission, lake+DB persistence, `ProfileFeatureAdmissionResolver`                                                                                                                                                   |
| WO163 | **Implemented.** Repeated-seed robustness, parameter plateau, DSR deflation, lock-box consumption, structured criterion rows (`ready_for_paper \| inconclusive \| rejected`)                                                                                                                                                                     |
| WO164 | **Implemented.** `POST/GET /api/v1/experiments/alpha-research` resumable funnel job with lake checkpoints and artifacts                                                                                                                                                                                                                          |
| WO165 | **Implemented.** `AlphaResearchPanel` in Research → Experiments with profile launch, evidence funnel, criterion rows, and champion promotion                                                                                                                                                                                                     |
| WO166 | Independent correction for insufficient-evidence experiment verdicts and existing A/B UI                                                                                                                                                                                                                                                         |

## Explicit non-goals

- Live execution or a profitability guarantee.
- A single universal strategy across all instruments.
- Order-flow features without a reliable order-flow dataset.
- Automated acquisition of crop fundamentals, futures curves, macro series, ES/NQ, VALE3, or PETR4.
  Those can become later data-source work once the local-context funnel is proven.
- WDO$ M5 research before its historical gap is repaired.
- Making transaction-cost work the critical path. Existing cost configuration must remain supported,
  but this batch targets predictive information and robustness first.
- Transformer or larger neural architectures before classical/context features demonstrate payoff.

## B3 session and multi-timeframe context (WO159)

Run-level context columns (`_ctx_*`) are attached once per backtest/discovery run via
`prepare_evaluation_frame` in `backtest_runner` and reused across Optuna trials and GA candidates.
Genome evaluation calls the same path only when the genome contains `feature.*` nodes.

Default B3 session window: `09:00`–`18:00` (`SessionContextConfig.default_b3()`), aligned with
`BacktestRunConfig.day_trade_*`.

**Genome node kinds (`feature.*`)**

| Family           | Node kind                                      | Key params                                |
| ---------------- | ---------------------------------------------- | ----------------------------------------- |
| Session/calendar | `feature.minutes_from_open`                    | `session_open`                            |
|                  | `feature.time_of_day`                          | `session_open`, `session_close`           |
|                  | `feature.day_of_week`, `feature.month_of_year` | _(none)_                                  |
|                  | `feature.session_window`                       | `window_from`, `window_to`                |
| Regime           | `feature.vol_regime`                           | `window`, `regime_lookback` + close input |
|                  | `feature.trend_regime`                         | `ma_period` + close input                 |
|                  | `feature.range_compression`                    | `regime_lookback` + OHLC input            |
| Prior session    | `feature.prev_session_high/low/close`          | _(run context)_                           |
|                  | `feature.session_gap`                          | _(run context)_                           |
|                  | `feature.dist_prev_session_*_atr`              | `atr_period`                              |
|                  | `feature.opening_range_high/low`               | `session_open`, `range_minutes`           |
| HTF (D1)         | `feature.d1_prev_high/low/close`               | _(lagged completed daily bar)_            |
|                  | `feature.d1_trend`, `feature.d1_volatility`    | _(lagged completed daily bar)_            |

**Availability delay (warmup bars, profile-neutral)**

| Node / family                             | Delay | Notes                                                    |
| ----------------------------------------- | ----: | -------------------------------------------------------- |
| Calendar / session window / regime on-bar |     0 | Uses only data ≤ current bar                             |
| Opening range                             |     0 | NaN until configured range completes within session      |
| Previous session / gap / dist-atr         |     1 | Visible only after prior session closes                  |
| D1 prev levels / trend / vol              |     1 | Uses previous **completed** daily aggregate (`shift(1)`) |

GA reachability: all unary `feature.*` kinds expose WO158 metadata (`gen_add_node`, `gen_swap`, etc.)
and appear in `add_node_kinds()` derived from `NodeSpec` — no hardcoded per-mutation lists.

Feature Store names mirror the table (`minutes_from_open`, `prev_session_close`, `d1_prev_high`, …)
and dispatch through the same `evaluate_feature_node` implementation as genomes.

## Feature evidence and admission (WO162)

Feature selection runs only on the **evidence segment** of the immutable split manifest. Each result is
a versioned `FeatureEvidence` row keyed by:

```text
(profile_id, profile_version, feature_id, feature_version, target, horizon, split_manifest_hash)
```

**Recorded fields:** raw IC, rank IC, MI, purged fold diagnostics, sign consistency, median effect,
dispersion, regime breakdown, block-permutation null floor, deflated IC score, redundancy cluster,
decision (`admitted | rejected | inconclusive`), and structured rejection reasons.

**Default profile thresholds**

| Threshold                          | Default |
| ---------------------------------- | ------: |
| `min_obs`                          |     100 |
| `min_folds` / `min_valid_folds`    |   3 / 2 |
| `min_abs_rank_ic`                  |    0.02 |
| `min_sign_consistency`             |    0.67 |
| `max_rank_ic_dispersion`           |    0.20 |
| `min_deflated_score`               |    0.50 |
| `redundancy_correlation_threshold` |    0.90 |

Insufficient samples, missing folds, or failed preflight → `inconclusive` (never zero-effect evidence).
`ProfileFeatureAdmissionResolver` queries persisted evidence; `HypothesisCandidateProvider` and WO164
consume the same resolver — no parallel eligibility path.

Compact summaries live in `feature_evidence_rows`.

## Research acceptance (WO163)

Discovery `passed_gates` ranking is unchanged. Paper-candidate acceptance is a separate layer in
`optimization/research_acceptance.py` that returns:

```text
ready_for_paper | inconclusive | rejected
```

Each verdict includes structured criterion rows (`name`, `status`, `observed`, `threshold`, `reason`).

**Profile config (`ResearchAcceptanceConfig`)**

| Field                                               | H1 swing default | WDO$ M15 override |
| --------------------------------------------------- | ---------------- | ----------------- |
| `min_completed_oos_windows`                         | 6                | 6                 |
| `min_stitched_oos_trades`                           | 30               | 100               |
| `optimization_seeds` / `min_positive_seed_outcomes` | 5 / 4            | 5 / 4             |
| `min_dsr`                                           | 0.95             | 0.95              |
| `min_plateau_profitable_fraction`                   | 0.50             | 0.50              |
| `min_plateau_score_retention`                       | 0.70             | 0.70              |
| `lockbox_min_trades`                                | 5                | 10                |
| `lockbox_max_drawdown_pct`                          | _(none)_         | 0.25              |

**Repeated seeds:** every seed persists configuration, best parameters, OOS metrics, window returns,
and failure reasons under `research_acceptance/{acceptance_id}/seeds/{seed}.json`. Missing or failed
required seeds yield `inconclusive` — they are never converted to zero outcomes.

**Parameter plateau:** valid neighbors are generated from declared search-space steps/grids (or bounded
perturbations for continuous/log ranges), evaluated only on the walk-forward segment (never the
lock-box). An isolated optimum fails when profitable-neighbor fraction or median score retention falls
below profile thresholds.

**DSR multiplicity boundary:** `compute_effective_attempt_count` sums hypotheses, GA genomes, Optuna
trials, and optimization seeds. Feature-search multiplicity remains on WO162's permutation null floor;
do not add feature attempts when `ProfileFeatureAdmissionResolver` already applied admission.

**Lock-box consumption:** after a champion is frozen, the holdout is evaluated once. A consumption
record is keyed by `split_manifest_hash` under `research_acceptance/consumption/{manifest_hash}/`.
Re-evaluating a **modified** champion against the same manifest is refused (`HoldoutConsumedError`).
Idempotent re-read for the same champion hash returns the stored record.

**Lower-tail diagnostics** (worst window, p25 window return, losing-window streak, trade concentration,
regime contribution) are attached as evidence fields; profiles may promote them to hard gates via
`worst_window_return_gate`.

Final acceptance payloads persist to `research_acceptance/{acceptance_id}/result.json`.

## Alpha-research experiment API (WO164)

```http
POST /api/v1/experiments/alpha-research
GET  /api/v1/experiments/alpha-research/{job_id}
POST /api/v1/experiments/alpha-research/{job_id}/cancel
```

Stages (checkpointed in `experiments/alpha_research/{job_id}/checkpoint.json`):

```text
preflight -> feature_evidence -> hypothesis_eligibility -> candidate_evaluation ->
acceptance -> lockbox -> complete
```

Request body selects `profile_id`, immutable `[start, end]`, optional `catalog_version` /
`profile_version`, and bounded `compute_budget` (`study_n_trials`, `optimization_seeds`,
`walkforward` only). Profile acceptance thresholds cannot be overridden post-launch.

Preflight fails `inconclusive` on missing bars, continuity breaks, insufficient evidence-segment
bars, unknown profile version, or disallowed `WDO$ M5`.

**Sample completed result (WO165 contract)**

```json
{
  "verdict": "ready_for_paper",
  "profile_id": "ccm_h1_swing",
  "provenance": {
    "backend_version": "abc123…",
    "profile_id": "ccm_h1_swing",
    "profile_version": 1,
    "catalog_version": 1,
    "split_manifest_hash": "…",
    "data_fingerprint": "…",
    "optimization_seeds": [42, 43, 44, 45, 46],
    "frozen_champion_id": "ccm_h1_swing_v1_breakout",
    "champion_hash": "…"
  },
  "split_manifest": { "manifest_hash": "…", "evidence": {}, "walkforward": {}, "lockbox": {} },
  "feature_evidence_summary": [
    { "feature_name": "vol_regime", "decision": "admitted", "deflated_score": 0.62 }
  ],
  "hypothesis_manifest": [
    { "candidate_id": "ccm_h1_swing_v1_breakout", "hypothesis_id": "ccm_h1_swing_v1_breakout" }
  ],
  "champion": {
    "candidate_id": "ccm_h1_swing_v1_breakout",
    "champion_seed": 46,
    "genome": { "genome_id": "ccm_h1_swing_v1_breakout", "nodes": [] }
  },
  "acceptance": {
    "verdict": "ready_for_paper",
    "criteria": [{ "name": "seed_robustness", "status": "passed", "observed": 5, "threshold": 4 }],
    "lockbox_metrics": { "total_return_pct": 0.03, "sharpe_ratio": 0.8, "total_trades": 8 }
  },
  "stages": [
    { "name": "preflight", "status": "completed" },
    { "name": "lockbox", "status": "completed" }
  ],
  "inconclusive_reasons": [],
  "coverage": { "bar_count": 600, "manifest_hash": "…" }
}
```

Lake artifacts per job: `result.json`, `checkpoint.json`, `feature_evidence.json`,
`hypothesis_manifest.json`, `candidate_acceptance.json`, `frozen_champion.json`,
`lockbox_metrics.json`. Worker restart resumes pre-lock-box checkpoints; consumed holdouts are
never re-evaluated automatically.

## Cross-instrument context (WO160)

Exogenous context lets a single-instrument strategy read lagged, backward-aligned features from
another instrument without opening positions in that symbol.

**Join semantics**

- Each exogenous series is loaded once per `(symbol, source_timeframe)` on the caller thread.
- Finer bars may be aggregated to the primary timeframe with `last_completed` resampling (only closed
  source bars contribute).
- Values become available at source bar **close** plus `availability_lag_bars` primary-bar delays.
- Alignment uses `merge_asof(..., direction="backward")`; forward joins, negative lags, and future
  backfill are rejected.
- Attached columns are namespaced as `exog_{SYMBOL}_{recipe}` on the shared evaluation frame reused
  across Optuna trials and GA candidates.

**v1 mappings**

| Primary  | Allowed exogenous | Notes                                  |
| -------- | ----------------- | -------------------------------------- |
| WIN$ H1  | WDO$              | Source may be WDO$ M15 resampled to H1 |
| WDO$ M15 | WIN$ M15          | Same timeframe context                 |
| CCM$ H1  | _(none)_          | No exogenous requirement in v1         |

Run artifacts persist `exogenous_provenance`: source range, timeframe, lag, recipes, attached column
names, and a content fingerprint. Preflight fails on non-overlap, stale series, or gaps wider than
31 calendar days.

## Hypothesis Catalog (WO161)

The following stable hypotheses are registered in the system:

| Hypothesis ID                | Profile ID     | Expected Horizon | Rationale                                                                                             | Required Features                                                                      |
| ---------------------------- | -------------- | ---------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `ccm_h1_swing_v1_breakout`   | `ccm_h1_swing` | 6 to 24 bars     | Volatility-normalized breakout strategy capturing medium-term trend shifts on CCM$ H1 swing.          | `feature.vol_regime`                                                                   |
| `ccm_h1_swing_v1_pullback`   | `ccm_h1_swing` | 6 to 24 bars     | Swing pullback buys gated by a positive higher-timeframe trend filter on CCM$ H1 swing.               | `feature.d1_trend`                                                                     |
| `win_h1_swing_v1_trend`      | `win_h1_swing` | 4 to 16 bars     | HTF trend continuation pulling back to daily support/resistance zones on WIN$ H1 swing.               | `feature.d1_trend`                                                                     |
| `wdo_m15_day_v1_or_breakout` | `wdo_m15_day`  | 2 to 8 bars      | Opening-range breakout strategy after range definition completes, with intraday flatting on WDO$ M15. | `feature.opening_range_high`, `feature.opening_range_low`, `feature.minutes_from_open` |

### How to add a new hypothesis

To add a new hypothesis to the catalog:

1. Define the layout/nodes of the hypothesis template as a dictionary inside `src/q_backend/optimization/hypothesis.py`. Refer to parameter values using `{"param": "param_name"}` to designate them as optimizable search parameters.
2. Register the hypothesis definition as an entry in `HYPOTHESIS_CATALOG` in the same file. Be sure to specify its stable `hypothesis_id`, matching `profile_id`, human-readable `rationale`, expected holding horizon, permitted exit families, and the list of `required_features` that the data segments must expose to qualify it for evaluation.
3. The dynamic `HypothesisCandidateProvider` automatically queries `HYPOTHESIS_CATALOG`, validates its nodes using the shared compiler rules, and derives the search spaces without requiring changes to the backtest orchestrator or finalizer.
