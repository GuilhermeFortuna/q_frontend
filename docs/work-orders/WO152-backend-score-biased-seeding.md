# WO152 — Backend: feature-score-biased discovery seeding (classical + latent)

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry/npm.
Read `docs/design/neural-latents-in-discovery.md`. **Depends on WO150 + WO151** (latents are addressable
nodes and already join the per-run discovery universe when a `PRODUCTION` model exists). This WO biases
**which** indicator kinds get seeded into the initial GA population toward the ones that actually scored well
in the Feature Store — classical **and** latent — instead of sampling kinds uniformly.

GA discovery only (the second of the two search-space paths — `search-space-derivation-paths` memory).

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/operators.py` — **already has weighted selection**: the helper around
  line 149 picks from `choices` using a `weights: dict[str, float]` (default weight 1.0, clamped ≥ 0). This
  is the hook — supply node-kind weights and seeding is biased with no new sampling machinery. Random-genome
  construction draws indicator kinds (from the per-run `indicator_kinds`, WO151).
- `src/q_backend/optimization/genetic_search.py` — `population()` (≈ line 297) seeds the initial genomes with
  `self._rng`; WO151 already threads `indicator_kinds` here. Add the weights alongside.
- `src/q_backend/neural/gate.py` — the read helpers to reuse (do **not** re-query by hand):
  - `_find_completed_run(session, *, symbol, timeframe, target_name, horizon, start, end)` →
    latest `COMPLETED` `EvaluationRun`.
  - `find_latest_latent_evaluation_run(session, …)` → most recent run that scored latents for the instrument.
  - `_load_score_rows(session, run_id)` → the `FeatureScoreRow`s (`feature_name`, `ic`, `rank_ic`, …).
- `src/q_backend/storage/db/models.py` — `FeatureScoreRow.feature_name` is the Feature Store name:
  classical `"rsi"`, `"macd_signal"`, …; neural `"latent_004@<hash12>"` (see the gate's catalog key
  `neural_catalog_key`). `EvaluationRun.{target_name, target_horizon}`.
- `src/q_backend/backtesting/genome/node_specs.py` — node kinds the weights must map onto (`ind.rsi`,
  `ind.macd`, …, and WO150's `ind.latent`).

## Goal

A builder that turns the latest feature scores for the run's instrument into a `dict[node_kind -> weight]`,
fed into the existing weighted seeding so high-`|IC|` kinds (classical and latent) appear more often in the
initial population. No scores ⇒ uniform (today's behavior, exactly).

```python
# new: backtesting/genome/score_bias.py
def build_kind_weights(session, *, symbol, timeframe, n_latents) -> dict[str, float]:
    """Latest feature scores → indicator-kind weights (|IC|-based); {} when none."""
```

## Tasks

### 1. Name → node-kind map — `backtesting/genome/score_bias.py`

- `FEATURE_NAME_TO_KIND: dict[str, str]` for the classical features that have a genome node
  (`"rsi" -> "ind.rsi"`, `"ema" -> "ind.ema"`, `"macd"/"macd_signal"/"macd_histogram" -> "ind.macd"`,
  `"bollinger_*" -> "ind.bollinger"`, `"donchian_*" -> "ind.donchian"`, `"momentum" -> "ind.momentum"`,
  `"realized_vol" -> "ind.realized_vol"`, `"atr" -> "ind.atr"`, `"ma" -> "ind.ma"`, …). Multiple score rows
  can map to one kind (a kind's multiple ports/params) — **take the max `|IC|`** across them.
- Neural: `"latent_<NNN>@<hash>"` → `"ind.latent"` (the per-kind weight is the **max `|IC|`** over that
  model's latents). Parse `NNN` defensively; ignore latents with index ≥ `n_latents`.
- Unmapped names (no genome node) are dropped — they simply don't bias anything.

### 2. Weight builder — `score_bias.py::build_kind_weights`

- Pick the source run: reuse `_find_completed_run` for `(symbol, timeframe)` with a **documented default
  target/horizon** (`fwd_return`, `horizon=5` — the gate's default), falling back to
  `find_latest_latent_evaluation_run` for the instrument so latent biasing works even if the classical run
  used a different target. Document the precedence in the module docstring.
- `_load_score_rows` → map names to kinds → aggregate to `max(|ic|)` per kind.
- Normalize to a usable weight: `weight = 1.0 + ALPHA * (|ic| / max_abs_ic)` (so the best kind ≈ `1+ALPHA`,
  unscored kinds default 1.0 in the weighted helper). Use a module constant `ALPHA` (e.g. 2.0) — biasing,
  not hard filtering; every kind keeps non-zero probability.
- No completed run / no mapped rows → return `{}` (weighted helper then treats all weights as 1.0 = uniform).

### 3. Thread weights into seeding — `genetic_search.py`

- Build `kind_weights` once per run (same `session_scope()` as WO151's universe resolution — one DB trip).
- Pass `kind_weights` into `population()` seeding so the weighted helper uses it when drawing indicator kinds.
- Leave mutation/crossover unweighted for now (seeding-only bias keeps the change small and the GA still
  explores freely after gen 0). Note this scope choice in the WO.

### 4. Determinism

- Weights are derived deterministically from persisted scores; sampling still uses `self._rng`. A fixed
  `init_seed` + fixed scores ⇒ identical seeded population. With **no** scores, the seeded population must be
  **byte-identical** to WO151's uniform path for the same seed (the weighted helper with all-1.0 weights must
  reduce exactly to the uniform draw — verify this equivalence).

## Guardrails

> **Bias, never filter.** Every kind in the run's universe keeps non-zero seed probability. Low/unscored
> features are less likely, never excluded — discovery must still be able to find signal the Feature Store
> missed.
> **No scores ⇒ no change.** Empty weights reduce exactly to WO151's uniform seeding for the same seed.
> Regression-lock this with a byte-equality test.
> **Read-only.** This WO never writes `feature_score_rows` / `EvaluationRun`; it only reads the latest. It does
> not trigger an evaluation.
> **Resolve once.** One DB read per run for scores (fold into WO151's single lookup); the GA loop never
> touches the session.
> **Latent + classical compete on the same axis.** Weights for `ind.latent` and `ind.rsi` come from the same
> `|IC|` scale so a strong latent genuinely out-seeds a weak classical.
> **Production trigger:** the discovery job — weight construction runs at population seeding. Name it in the
> completion note.

## Tests

- `tests/backtesting/genome/test_score_bias.py`:
  - `build_kind_weights` maps classical names → `ind.*` and `latent_NNN@hash` → `ind.latent`, aggregating to
    `max(|ic|)`; unmapped names dropped; out-of-range latent indices ignored.
  - No completed run → `{}`.
  - The weighted helper with `{}` weights reproduces the uniform draw for a fixed RNG (equivalence test).
- `tests/optimization/test_discovery_score_bias.py` (end-to-end, seed a production model + a completed
  `EvaluationRun`/`feature_score_rows` with one clearly-dominant feature, e.g. `latent_004` IC 0.17 vs others
  < 0.05; stub `read_ohlcv`):
  - the seeded population over many seeds contains the dominant kind **more often** than under uniform seeding
    (statistical assertion with a fixed master seed).
  - removing the scores returns the population to byte-identical uniform output for a fixed seed.

## Docs

- `docs/design/neural-latents-in-discovery.md`: mark WO152 landed; record the default target/horizon, `ALPHA`,
  and the seeding-only scope.
- Update `neural-features-batch` + `search-space-derivation-paths` memories (Phase-3 latents now _bias_ GA
  discovery — closes the "scores bias GA discovery" intent that was specced but unwired).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: (a) `build_kind_weights` output for a seeded instrument (showing a latent out-weighing
  classicals); (b) the over/under-sampling statistic proving the dominant kind is seeded more; (c) the
  no-scores byte-equality proof; (d) the production trigger in one sentence.

## Out of scope

- Weighting mutation/crossover by score (seeding-only here) — possible follow-up.
- Hard feature selection / pruning the universe by IC — explicitly rejected (bias only).
- The `ind.latent` node + the per-run universe — **WO150 / WO151**.
- Optimization (Optuna) search space; any frontend.
