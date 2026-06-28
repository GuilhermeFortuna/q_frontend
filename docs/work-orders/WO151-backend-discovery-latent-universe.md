# WO151 — Backend: auto-join production latents into the per-run discovery universe

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry/npm.
Read `docs/design/neural-latents-in-discovery.md`. **Depends on WO150** (the `ind.latent` node + PIT-safe
evaluation + `CompositeStrategy(latent_model_hash=…, timeframe=…)` ctor args). This WO makes GA discovery
**use** that node: when a `PRODUCTION` neural model exists for the run's `(symbol, timeframe)`, its latents
join the genome universe; when none exists, discovery behaves **exactly as today**.

Background: there are **two separate search-space paths** (optimization vs GA discovery — see
`search-space-derivation-paths` memory). This WO touches **GA discovery only** (`backtesting/genome/*` +
`optimization/{genetic_search,strategy_search}`).

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/operators.py` — `INDICATOR_KINDS` (module constant: `NODE_SPECS` filtered
  to `ind.*` minus `{ind.diff, ind.ratio, ind.tsmom}`) is used as a **global** in random-genome construction
  and mutation (`mutate_indicator_kind` builds `compatible` from `INDICATOR_KINDS`, filtered by output type +
  `min_inputs`). A 0-input oscillator node slots in beside `ind.atr` naturally.
- `src/q_backend/optimization/genetic_search.py` — the GA engine. `backtest.symbol` / `backtest.timeframe`
  are available (≈ lines 188–189); `population()` (≈ line 297) seeds the initial genomes via the seeding
  helpers; `self._rng = random.Random(genetic_config.init_seed)` (≈ line 251) is the determinism source.
- `src/q_backend/optimization/strategy_search.py` — wraps discovery; constructs `CompositeStrategy` per
  candidate (now needs `latent_model_hash` + `timeframe` from WO150).
- `src/q_backend/backtesting/genome/param_bounds.py` — `GENOME_PARAM_BOUNDS["latent_index"]` (WO150) has a
  static `max = MAX_LATENT_INDEX`; the **per-run** clamp to `n_latents-1` lives here.
- `src/q_backend/storage/db/repositories.py` — `list_neural_model_versions(session, status="production")`;
  filter to the run's `(symbol, timeframe)`. `NeuralModelVersion.{model_hash, latent_names}` give the hash +
  `n_latents`.

## Goal

A single resolver that turns the run's instrument into `(indicator_kinds, latent_model_hash, n_latents)`,
threaded through population construction, operators, and the candidate `CompositeStrategy` — so latent nodes
appear in discovery **iff** a production model exists.

```python
# new: backtesting/genome/latent_universe.py
def resolve_latent_universe(session, symbol, timeframe) -> LatentUniverse:
    """PRODUCTION model for (symbol, timeframe) → its hash, n_latents, and
    indicator kinds incl. 'ind.latent'; or the static universe when none exists."""
```

## Tasks

### 1. Per-run universe resolver — `backtesting/genome/latent_universe.py`

- `LatentUniverse` dataclass: `indicator_kinds: tuple[str, ...]`, `latent_model_hash: str | None`,
  `n_latents: int` (0 when none).
- `resolve_latent_universe(session, symbol, timeframe)`: look up the single `PRODUCTION`
  `NeuralModelVersion` for `(symbol, timeframe)`. If present → `indicator_kinds = (*INDICATOR_KINDS,
"ind.latent")`, `latent_model_hash = version.model_hash`, `n_latents = len(version.latent_names)`. If
  absent → `indicator_kinds = INDICATOR_KINDS`, `latent_model_hash = None`, `n_latents = 0`.

### 2. Parameterize the operators on `indicator_kinds`

- The random-genome and `mutate_indicator_kind` operators currently read the `INDICATOR_KINDS` **global**.
  Add an explicit `indicator_kinds: Sequence[str] = INDICATOR_KINDS` parameter to those operator entry points
  (default keeps every existing non-discovery caller byte-for-byte identical), and use the passed value.
- When sampling params for an `ind.latent` node, draw `latent_index` from `[0, n_latents-1]` (use the run's
  `n_latents`, not the static `MAX_LATENT_INDEX`). Centralize this clamp so seeding and mutation agree.

### 3. Thread the universe through discovery — `genetic_search.py` / `strategy_search.py`

- At engine construction (where `backtest.symbol`/`timeframe` are known), call `resolve_latent_universe` once
  in a `session_scope()`; stash `indicator_kinds` / `latent_model_hash` / `n_latents` on the engine.
- Pass `indicator_kinds` into `population()` seeding + every operator call.
- Construct each candidate `CompositeStrategy(..., timeframe=backtest.timeframe,
latent_model_hash=self._latent_model_hash)` (WO150 ctor args).

### 4. Determinism

- Resolution happens once per run; the universe is fixed for the whole GA. Latent-index sampling uses the
  existing `self._rng` so a given `init_seed` reproduces the same population whether or not latents are present
  (latents only _expand_ choices when a model exists; with no model the RNG stream is unchanged).

## Guardrails

> **No production model ⇒ zero behavior change.** With no `PRODUCTION` model for the instrument,
> `indicator_kinds == INDICATOR_KINDS`, `latent_model_hash is None`, and the seeded population + RNG stream are
> identical to today. Prove this with a test asserting genome equality against the pre-WO151 path.
> **Universe keyed strictly to the run's `(symbol, timeframe)`.** Never pull a different instrument's model.
> Exactly one `PRODUCTION` per instrument is guaranteed by WO146's promotion guardrail; assert/handle the
> defensive "more than one" case (take newest, log).
> **Resolve once, not per genome/bar.** One DB lookup per run; the hot loop never touches the session.
> **`latent_index` always in range for the run.** Clamp to `[0, n_latents-1]`; never emit an index a genome
> can't evaluate.
> **Production trigger:** the discovery job (`optimization/strategy_search.py` via `strategy_search_jobs.py`)
> — universe resolution runs at population construction. Name it in the WO completion note.

## Tests

- `tests/backtesting/genome/test_latent_universe.py`:
  - `resolve_latent_universe` with a seeded `PRODUCTION` model → kinds include `ind.latent`, correct hash +
    `n_latents`; with none → static `INDICATOR_KINDS`, `None`, `0`.
  - two production versions for one instrument (defensive) → newest chosen.
- `tests/optimization/test_discovery_latents.py` (end-to-end, mirror
  `tests/neural/test_pipeline_integration.py` — stub only `read_ohlcv`, seed `sync_registry_to_db` + a tiny
  PCA production model):
  - a run on the instrument **with** a production model produces a population that can include `ind.latent`,
    and a hand-built latent-entering genome backtests to a result (latents NaN ≤ train_end → no in-sample
    signal).
  - a run on an instrument **without** a production model yields a population **byte-identical** to the
    pre-WO151 path for the same `init_seed` (regression-lock the "no change" guarantee).

## Docs

- `docs/design/neural-latents-in-discovery.md`: mark WO151 landed; document the resolver + the "no model = no
  change" guarantee.
- Update `neural-features-batch` + `search-space-derivation-paths` memories (latents now reach GA discovery).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: (a) `resolve_latent_universe` output for a seeded production instrument vs a bare
  instrument; (b) proof that a no-model run reproduces the pre-WO151 population for a fixed seed; (c) the
  production trigger (discovery job) in one sentence.

## Out of scope

- Biasing _which_ kinds get seeded by their IC — **WO152** (this WO makes latents _available_ and uniformly
  reachable; it does not weight them).
- The `ind.latent` node itself / its evaluation — **WO150**.
- Optimization (Optuna) search space — untouched (the other search-space path).
- Any frontend / per-run opt-out toggle — deferred (capability is automatic).
