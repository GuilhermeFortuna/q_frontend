# Feature Intelligence — design

Source roadmap: `Q_Feature_Intelligence_Roadmap.md`. This doc covers the **backend platform**
(Phase 1 Feature Store + Phase 2 Evaluation Pipeline). The neural phases (autoencoder, transformer)
and the Research Workspace frontend are **not** designed here — they are gated on Phase 2 evidence
(see "Go/no-go gate" below).

## Why

Q already has a classical feature engine, but features are not first-class. They are computed inline
during a backtest from a genome graph:

- `backtesting/technical_indicators.py` + `backtesting/moving_averages.py` — raw indicator functions
  (`compute_rsi`, `compute_atr`, `compute_macd`, `compute_bollinger_bands`,
  `compute_donchian_channels`, `compute_realized_vol`, `compute_ma`, …).
- `backtesting/genome/node_specs.py` — `NODE_SPECS`, the primitive vocabulary (`ind.rsi`, `ind.ma`,
  `ind.macd`, `ind.bollinger`, …) with arity + output-type tags.
- `backtesting/genome/compile.py` → `genome/composite_strategy.py::compute_indicators` /
  `_evaluate_node` — executes the graph into named columns (`g_<node_id>`) on the bar DataFrame.

There is **no** standalone "compute named feature → series on bars" entry point, no registry with
metadata/versioning/provenance, no cached feature matrices, and no point-in-time correctness
contract. Everything downstream (GA discovery, optimization) re-derives features ad hoc and nothing
governs or scores them.

## The two things that are first-class problems (not bullets)

### 1. Point-in-time (PIT) / leakage contract

Every feature value at bar `t` must be computable from bars `≤ t` only. This is a **cross-cutting
invariant**, not a per-feature checkbox:

- A `FeatureSpec` declares a `lookback` (bars of history it consumes) and a `forward_window` (bars of
  future it requires — **must be 0** for a feature; non-zero is a label, not a feature).
- The computation service computes on a window and **trims the first `lookback` bars** from the
  returned valid range (warm-up); it never forward-fills from the future and never uses
  `.shift(negative)`.
- Evaluation joins feature(`t`) to target(`t`) where the target's own forward horizon is applied to
  the **target series only** (see §2), with an **embargo** of `horizon` bars at the train/test
  boundary so a label built from future bars can't leak across the split.
- A static `leakage_status` is recorded per feature version: `clean` (passed checks), `suspect`
  (uses a primitive flagged as forward-looking), `unverified`.

### 2. Target / label definition

IC / Rank IC / MI are meaningless without a defined label. Targets are their own module, the single
source of truth for what every metric is measured against:

- `forward_return(horizon)` — `close.shift(-horizon)/close - 1`, the default family.
- `forward_log_return(horizon)`, `forward_vol_adj_return(horizon)` (return / realized vol),
  `forward_direction(horizon)` (sign, for classification/MI).
- A target carries its `horizon`; the embargo above derives from it.

Implemented in `q_backend.features.targets` (WO132):

| Name                 | Kind           | Formula                                      |
| -------------------- | -------------- | -------------------------------------------- |
| `fwd_return`         | regression     | `close.shift(-h)/close - 1`                  |
| `fwd_log_return`     | regression     | `log(close.shift(-h)/close)`                 |
| `fwd_vol_adj_return` | regression     | `fwd_return(h) / realized_vol(close)` at `t` |
| `fwd_direction`      | classification | `sign(fwd_return(h))` ∈ `{-1,0,1}`           |

Call `list_target_specs(horizons)` to expand the family for caller-supplied horizons (e.g.
`[1, 5, 10, 20]`). Trailing `horizon` rows are NaN; `purge_embargo` + `align_feature_target`
enforce leakage-safe evaluation joins.

## Go/no-go gate (end of Phase 2)

Phase 2 produces per-feature IC/MI vs. the classical engine's residual signal. **Before any neural
phase (autoencoder/transformer) is scheduled**, Phase 2 must answer: do classical features leave
exploitable headroom a latent space could capture? If the evaluation says the classical engine is at
its ceiling, the neural phases are deferred. The roadmap's Phase 3/4 are hypotheses, not committed
work.

**Neural latents (WO144):** trained encoder latents now flow through the same evaluation pipeline and
appear in the Feature Scoring leaderboard via `feature_score_rows` — no separate UI. The Phase-2
headroom question is answered empirically per model: `neural/gate.py` compares each latent's `|IC|`
against the best classical baseline on the same target and OOS window. See `neural-features.md`.

## Architecture (Phase 1 + 2)

```
read_ohlcv (bars)                 targets.py (labels)
        │                                 │
        ▼                                 │
FeatureRegistry  ──►  feature compute ──► feature matrix (cached, lake) ──► evaluation
  (FeatureSpec)        (PIT-safe)              │                              (IC/RankIC/MI/
        │                                       │                               stability/redundancy)
        ▼                                       ▼                                     │
   DB: FeatureDefinition / FeatureVersion  (provenance, status, usage)                ▼
        │                                                                    DB: EvaluationRun /
        ▼                                                                        FeatureScore
   Feature Store API  ◄───────────────── Feature Passport ◄─────────────────────────┘
        │
        ▼
   GA discovery search-space derivation (scores prune/weight the primitive pool)
```

## Work order map

Phase 1 — Feature Store:

- **WO127** — `FeatureSpec` schema + `FeatureRegistry` (adapt the indicator/node vocabulary into named
  feature specs with metadata + versioning). ✅ Registry landed in `q_backend.features.registry`.
- **WO128** — PIT-safe feature computation service + leakage contract (§1). ✅
  `q_backend.features.compute` + `q_backend.features.leakage`.
- **WO129** — Feature matrix builder + lake cache + provenance manifest. ✅
  `q_backend.features.matrix` + lake `features/<matrix_id>/` artifacts. Bump
  `ENGINE_VERSION` in `matrix.py` when compute semantics change (invalidates cache ids).
- **WO130** — Feature Store persistence (DB models + repositories + Alembic migration; status,
  provenance, usage count). ✅ `FeatureDefinition` / `FeatureVersion` tables,
  `q_backend.storage.db.repositories` helpers, and `q_backend.features.sync.sync_registry_to_db`
  (one-way, idempotent code → DB sync; never downgrades a human-promoted status).
- **WO131** — Feature Store API + Feature Passport payload. ✅ Phase 1 complete.
  - `GET /api/v1/features` — catalog list (`category`, `status` filters)
  - `GET /api/v1/features/{name}` — Feature Passport (detail)
  - `POST /api/v1/features/{name}/{version}/status` — promote/demote lifecycle status

Phase 2 — Evaluation Pipeline:

- **WO132** — Target/label module (§2). ✅ `q_backend.features.targets`.
- **WO133** — Evaluation metrics service (IC, Rank IC, MI, stability, regime robustness). ✅
  `q_backend.features.evaluation`. Metrics: Pearson IC, Spearman Rank IC, sklearn MI
  (`mutual_info_regression`, `random_state=0`), window stability, causal vol-regime Rank ICs.
- **WO134** — Redundancy/correlation clustering + global feature score + recommended sets. ✅
  `q_backend.features.scoring`. Global score weights: `0.4*|rank_ic| + 0.3*stability +
0.15*regime_consistency + 0.15*uniqueness`; leakage penalty `0.5` when not `clean`.
- **WO135** — Evaluation persistence + leaderboard API; scores feed the Feature Passport. ✅
  `q_backend.features.evaluation_service`, `EvaluationRun` / `FeatureScoreRow` tables.
  - `POST /api/v1/feature-eval` — run matrix → evaluate → score → persist
  - `GET /api/v1/feature-eval/{run_id}` — status, leaderboard, clusters, heatmap
  - `GET /api/v1/features/leaderboard` — latest `global_score` per feature
  - `GET /api/v1/features/{name}` — Passport backfills `score` + `evaluation_history`
- **WO136** — Wire feature scores into GA discovery search-space derivation (the payoff).

## Research frontend (WO137–141)

- **WO137** — Research workspace shell at `/research` with three tabs: **Feature Store**, **Feature
  Scoring**, and **Feature Lab**. Tab selection persists in `?tab=` for deep links. Typed react-query
  layer (`src/api/queries/features.ts`) and MSW mocks mirror the WO131/WO135 API contract so WO138–141
  can ship against fixtures without a live backend.
- **Neural Features** tab is intentionally deferred until backend Phase 3/4 (autoencoder/transformer)
  clears the Phase 2 go/no-go gate.
- **WO138** — Feature Store catalog table. ✅ Sortable/filterable table with server-side
  category/status filters, score formatting (`—` for null), and row selection hook for WO139.
- **WO139** — Feature Passport detail panel. ✅ Master-detail layout in the store tab; definition,
  versions, provenance, evaluation history, leakage badge, and optimistic status promotion.
- **WO140** — Scoring dashboard. ✅ Leaderboard, metric heatmap, stability lines, correlation
  clusters, recommended/weak panels, and live refresh while a run is in progress. Reuses the
  WO113–115 recharts idioms (`ParamImportancePanel`, `OptimizationAnalyticsTab` polling pattern).
- **WO141** — Feature Lab interactive evaluation. ✅ Symbol/timeframe/date pickers reused from
  backtests, feature multiselect with recommended-only shortcut, target + horizon, Evaluate → Scoring
  handoff, two-set comparison, and recent-run reopen. **Research frontend batch (WO137–141) complete.**
- **Neural Features** tab and regime-similarity / autoencoder actions remain deferred (roadmap
  Phase 3/4).

## Out of scope (this batch)

- Neural feature training, autoencoder/transformer UI, and "similar historical regimes" — roadmap
  Phase 3/4, deferred past WO141.
- Autoencoder (roadmap Phase 3) and Transformer (Phase 4) — gated on the WO133/134 evidence.
