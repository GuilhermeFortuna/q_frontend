# Neural latents in GA discovery (WO150–152)

## The gap this closes

Phase 3 (WO142–149) gave us a Model Registry, a `NeuralEncoder` protocol (PCA control + torch
autoencoder), an IC gate, and an operator surface to train/inspect/promote models. After promotion,
a model's latents are computable as PIT-safe Feature Store features (`features/registry.py`,
`features/compute.py::_compute_neural`) and are scored into `feature_score_rows` by the gate.

**But GA discovery never sees them.** Discovery evolves strategy genomes over `INDICATOR_KINDS` —
`NODE_SPECS` filtered to `ind.*` (`backtesting/genome/operators.py`) — a universe entirely separate
from `features/registry.py::FEATURE_SPECS` where latents live. Grep confirms: nothing in
`optimization/{genetic_search,strategy_search,auto_search_space}.py` reads `feature_score_rows`, the
Feature Store catalog, or neural latents. So a strategy genome literally cannot reference
`latent_004@<hash>`, and the whole Phase-3 slice produces signal that discovery can't act on.

This batch builds the bridge: production latents become first-class genome nodes that compete with
classical indicators in the same backtest, and discovery's seeding is biased toward whatever actually
scored well (classical **and** latent).

## Decision: automatic when a PRODUCTION model exists

When a `PRODUCTION` neural model exists for the run's `(symbol, timeframe)`, its latents auto-join the
genome universe and feature-score biasing is on. No UI, no flag. When **no** production model exists
for the instrument, discovery behavior is byte-for-byte unchanged. This keeps the surface minimal and
ties the capability to the existing promotion decision (which already has an operator surface, WO146):
promoting a model _is_ the act of enabling its latents for discovery.

Rationale for "automatic" over a toggle: a toggle is more code (request field + frontend control) for a
capability whose on/off switch already exists — the model's `PRODUCTION` status. A UI surface can be
added later if operators want per-run control; this batch does not block it.

## Why this is safe (the leakage story)

Neural latents obey an OOS-only contract: `_compute_neural` emits `NaN` for every bar at or before the
model's `train_end` (enforced by `assert_neural_oos_only` / `to_utc_series`, fixed 2026-06-28). The
genome engine already coerces signal columns with `.fillna(False)` (`composite_strategy.py:157–158`),
so a latent node that is `NaN` in-sample simply produces **no entry/exit signal** there — no leak, no
crash, no special-casing. Discovery's walk-forward (optimize in-sample, score OOS) composes naturally
with this: the latent contributes signal only on the bars where it is defined.

## Architecture (3 backend WOs, numeric = exec order)

```
PRODUCTION model promoted (WO146)
        │  register_neural_model_features → latents computable, PIT-safe
        ▼
WO150  ind.latent genome node  ── 0 inputs, oscillator out, latent_index param
        │                          resolves via existing _compute_neural path
        ▼
WO151  per-run genome universe ── PRODUCTION model for run's (symbol,tf) →
        │                          its latent nodes join INDICATOR_KINDS / seeding /
        │                          operators / activity; none → universe unchanged
        ▼
WO152  score-biased seeding    ── read latest feature_score_rows for the run,
                                   map score names → node kinds, bias seed sampling
                                   toward high-|IC| nodes (classical + latent)
```

### WO150 — `ind.latent` node + PIT-safe compute resolution _(implemented)_

A new `NodeSpec("ind.latent", 0, 0, None, ("out",), {"out": "oscillator"}, frozenset({"latent_index"}))`.
`latent_index` selects which latent (`0…n_latents−1`) of the run's production model; bounds registered in
`GENOME_PARAM_BOUNDS` (`MAX_LATENT_INDEX = 31` static cap; per-model clamp at eval). At backtest time,
`CompositeStrategy` receives `latent_model_hash` (and `timeframe`) from the caller — **not** from genome
JSON — and evaluates the node via `features/compute.py::_get_or_compute_latent_frame` (one transform fans
out to all latents, cached on the strategy). OOS-only masking reuses `_oos_warmup_bars` / `_apply_warmup`
(the same contract as `_compute_neural`). No production model → all-NaN column, no signal, no raise.

**Follow-ups:** [WO151](work-orders/WO151-backend-discovery-latent-universe.md) (discovery universe),
[WO152](work-orders/WO152-backend-score-biased-seeding.md) (score-biased seeding). See also
`neural-features-batch` memory.

### WO151 — per-run discovery universe _(implemented)_

`resolve_latent_universe(session, symbol, timeframe)` in `backtesting/genome/latent_universe.py`
returns a `LatentUniverse` dataclass: `indicator_kinds`, `latent_model_hash`, `n_latents`. When a
`PRODUCTION` model exists for the run's `(symbol, timeframe)`, `ind.latent` joins the indicator kinds
and `latent_index` is sampled in `[0, n_latents-1]`; otherwise the static `INDICATOR_KINDS` universe
and empty hash are returned and discovery is **byte-for-byte unchanged** for the same `init_seed`.

**Production trigger:** the discovery job (`optimization/strategy_search.py` via
`strategy_search_jobs.py` → `dispatch_genetic_discovery`) calls `create_genetic_candidate_provider`,
which resolves the universe once per run before seeding generation 0.

**Follow-up:** [WO152](work-orders/WO152-backend-score-biased-seeding.md) (score-biased seeding).

### WO152 — feature-score-biased seeding _(implemented)_

Read the latest completed `EvaluationRun` / `feature_score_rows` for the run's `(symbol, timeframe, target,
horizon)`. Build a name→node-kind map (`rsi`→`ind.rsi`, `latent_004@<hash>`→`ind.latent`), and weight
seed-genome node sampling by `|IC|` so high-signal features (classical and latent) appear more often in the
initial population. Missing scores → uniform sampling (today's behavior). Deterministic under the existing
discovery seed.

**Defaults:** target `fwd_return`, horizon `5`; weight formula `1.0 + ALPHA * (|ic| / max_abs_ic)` with
`ALPHA=2.0`. **Scope:** initial population seeding only — mutation/crossover remain unweighted.

## Production triggers

- **WO150**: latent nodes are exercised whenever a genome that references `ind.latent` is backtested — by
  discovery (WO151) and by any direct genome backtest. No new lifecycle hook; the node registry is import-time.
- **WO151**: the discovery job (`optimization/strategy_search.py` via `strategy_search_jobs.py`) — the per-run
  universe resolution runs at genome-population construction.
- **WO152**: the same discovery job — score-biased seeding runs when the initial population is seeded.

## Out of scope

- Any frontend (a Discovery-page toggle, surfacing which latents a run used) — deferred; the capability is
  automatic and backend-only.
- Walk-forward _retraining_ of the encoder inside discovery — latents come from the fixed production model;
  the OOS-only contract is per the model's `train_end`, not per discovery window.
- Optimization (Optuna) search-space derivation — this batch touches **GA discovery only**
  (`backtesting/genome/*`, `optimization/{genetic_search,strategy_search}`), the second of the two
  separate search-space paths. See `search-space-derivation-paths` memory.
