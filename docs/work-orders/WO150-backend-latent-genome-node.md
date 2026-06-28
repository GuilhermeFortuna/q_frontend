# WO150 — Backend: `ind.latent` genome node + PIT-safe compute resolution

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry/npm.
Read `docs/design/neural-latents-in-discovery.md` first. Depends on the Phase-3 batch (**WO142–149**):
the Model Registry, the neural feature source (`features/compute.py::_compute_neural`), and promotion
(WO146) are all landed, and a model can be `PRODUCTION` for a `(symbol, timeframe)`.

This batch (WO150–152) bridges **production neural latents into GA discovery** — the follow-up flagged at
the end of WO146 ("Biasing GA discovery with PRODUCTION latent scores"). This first WO makes a latent
**addressable as a genome node**. It does not touch discovery seeding or the per-run universe — that is
**WO151**.

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/node_specs.py` — `NodeSpec` (kind, min/max inputs, input series types,
  output ports, port types, `allowed_param_keys`) and the `NODE_SPECS` dict. Note the precedent of
  **0-input source nodes** (`source.close`) and oscillator-typed outputs (`ind.rsi` → `{"out": "oscillator"}`).
- `src/q_backend/backtesting/genome/compile.py` — `compile_genome` / `compile_node`: builds the
  `CompiledNode` graph and `column_by_port` from `NODE_SPECS[node.kind]`. Adding a kind to `NODE_SPECS` is
  enough for it to compile; **evaluation is separate** (next bullet).
- `src/q_backend/backtesting/genome/composite_strategy.py` — `CompositeStrategy._evaluate_node(df, compiled)`
  is the kind dispatch (`elif kind == "ind.ma": …`) that writes each node's output column into `df`. The
  strategy knows `self.symbol` (ctor arg, default `"BTCUSDT"`) but **not** timeframe today. Signal columns
  are coerced with `.fillna(False)` (lines ~157–158) — so a `NaN` latent yields _no signal_, no crash.
- `src/q_backend/backtesting/genome/param_bounds.py` — `GENOME_PARAM_BOUNDS` maps each genome param key
  (e.g. `period`) to a `StrategyParamSpec` (min/max/step/default); `resolve_node_params` reads it.
- `src/q_backend/features/compute.py` — `_get_or_compute_latent_frame(model_hash, bars)` returns a
  `DataFrame` of **PIT-safe** latents (one `encoder.transform` fans out to all latents, cached;
  `NaN` for every bar at/before `train_end` — see `assert_neural_oos_only` / `to_utc_series`). `read_neural_model`
  loads the encoder; `_compute_neural` is the single-latent wrapper.
- `src/q_backend/storage/db/repositories.py` — `list_neural_model_versions(session, status=...)`; filter to
  `PRODUCTION` for a `(symbol, timeframe)` to find the run's encoder. `NeuralModelVersion.latent_names` gives
  the count + ordering.

## Goal

A genome can carry a node `{"kind": "ind.latent", "params": {"latent_index": 4}}` that, when backtested for
an instrument with a `PRODUCTION` neural model, evaluates to that model's `latent_004` series (PIT-safe), and
otherwise is **undefined/absent** (handled in WO151 — here we just make the node addressable + evaluable when
a model hash is supplied).

```python
# node_specs.py
"ind.latent": NodeSpec(
    "ind.latent", 0, 0, None, ("out",), {"out": "oscillator"}, frozenset({"latent_index"})
),
```

## Tasks

### 1. Register the node — `node_specs.py`

- Add the `ind.latent` `NodeSpec` above: **0 inputs**, single `out` port typed `"oscillator"` (latents are
  unbounded continuous values, like RSI/MACD oscillators — this lets the existing comparator/logic nodes wire
  to them), `allowed_param_keys = {"latent_index"}`.

### 2. Param bounds for `latent_index` — `param_bounds.py`

- Add `GENOME_PARAM_BOUNDS["latent_index"]` as an **integer** `StrategyParamSpec(min=0, max=<MAX_LATENTS-1>,
step=1, default=0)`. Use a module constant `MAX_LATENT_INDEX` (e.g. 31) as a static upper bound — the
  _actual_ per-model clamp to `n_latents-1` happens in WO151 where the production model is known. Document
  that out-of-range indices are clamped/ignored downstream.

### 3. Resolve the production encoder once per run — `composite_strategy.py`

- Thread the run's **timeframe** and resolved **production `model_hash`** into `CompositeStrategy` (ctor
  kwarg `latent_model_hash: str | None = None`, plus `timeframe`). Resolve it **once** (not per node, not per
  bar): the caller (WO151 / direct backtest) passes the `PRODUCTION` model hash for `(symbol, timeframe)`, or
  `None` when there is no production model. Store `self._latent_model_hash`.
- Rationale: genomes stay instrument-portable (no hash baked into the genome JSON); a retrain/repromote swaps
  the encoder transparently; and we avoid a DB lookup inside the hot evaluation loop.

### 4. Evaluate the node — `composite_strategy.py::_evaluate_node`

- Add `elif kind == "ind.latent":`:
  - If `self._latent_model_hash is None`, write an all-`NaN` column for `cols["out"]` (node present but no
    production model → contributes no signal). Do **not** raise.
  - Else compute the latent frame once via `_get_or_compute_latent_frame(self._latent_model_hash, df)` (cache
    it on `self` keyed by data length, mirroring `self._series_cache`, so multiple `ind.latent` nodes share one
    transform). Select the column for `latent_index`, **clamped** to `[0, n_latents-1]`; write it to `cols["out"]`.
  - The frame is already PIT-safe (`NaN` ≤ `train_end`); no extra masking here.

### 5. Leakage guard + determinism

- Reuse `assert_neural_oos_only` (or assert directly) in a test to prove the emitted column is `NaN` for every
  bar `<= train_end`. The evaluation must be deterministic given the same df + hash.

## Guardrails

> **PIT-safety is inherited, not re-implemented.** Latent values come **only** from
> `_get_or_compute_latent_frame`, which enforces the OOS-only contract. Never read raw encoder output or
> recompute latents with a different masking rule here.
> **No DB in the eval loop.** The production model hash is resolved once per run/strategy and passed in. The
> evaluation branch does no session/DB access.
> **No production model → all-NaN, never raise.** A genome with `ind.latent` must backtest cleanly (just no
> signal from that node) on an instrument without a production model.
> **Genome JSON carries no model_hash.** Only `latent_index`. The hash is run context, not genome content —
> keeps genomes portable and caches valid across retrains only by intent (a new hash changes the series).
> **Determinism.** Same df + same hash ⇒ identical latent columns.

## Tests

- `tests/backtesting/genome/test_latent_node.py`:
  - `ind.latent` is in `NODE_SPECS`, compiles via `compile_genome` (0 inputs, oscillator out), and
    `latent_index` is in `GENOME_PARAM_BOUNDS`.
  - With a stubbed/seeded production model (reuse the neural test fixtures that build a tiny PCA encoder over
    synthetic bars), a genome entering when `ind.latent > 0` backtests without error and the latent column is
    **NaN for all bars `<= train_end`**, finite after.
  - `latent_model_hash=None` → the node column is all-NaN and the backtest still runs (no signal, no raise).
  - `latent_index` beyond `n_latents-1` is clamped (no `IndexError`).
- Keep using `uv run pytest` (sync the neural fixtures for any DB the gate baseline needs, per
  `tests/neural/test_pipeline_integration.py`).

## Docs

- `docs/design/neural-latents-in-discovery.md`: note the node contract once implemented.
- Cross-link `neural-features-batch` memory + WO151/WO152.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `NODE_SPECS["ind.latent"]` definition and a short snippet/test output showing a
  latent column that is NaN ≤ train_end and finite after, for a seeded production model.

## Out of scope

- Putting `ind.latent` into the discovery genome universe / seeding / operators — **WO151**.
- Score-biased seeding — **WO152**.
- Resolving _which_ production model exists for a run (the `PRODUCTION` lookup + timeframe plumbing into the
  discovery population) — **WO151** owns that; here the hash is simply an input.
- Any frontend.
