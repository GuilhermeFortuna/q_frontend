# WO153 — Backend: `latents_enabled` control-arm seam for discovery

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry/npm.
Read `docs/design/discovery-payoff-validation.md` first. This batch (WO153–157) builds the
**measuring instruments** for the Phase-3 payoff: a Discovery A/B harness + an Encoder Ablation,
surfaced in a new Research tab. This first WO is the **prerequisite seam** the A/B harness needs.

WO150–152 made production neural latents **automatic with no flag** — "promoting a model IS enabling
its latents for discovery." An honest A/B needs both arms on an instrument _where a PRODUCTION model
exists_, so the control arm must force latents **OFF despite a production model**. That override does
not exist today. This WO adds it as an **internal** param — never surfaced on the normal discovery
request or UI.

## How the pieces work today (read these files)

- `src/q_backend/optimization/genetic_search.py::create_genetic_candidate_provider(genetic_config,
search_config, probe_df=None)` (≈line 252) — **the single chokepoint**. Opens a `session_scope()`,
  calls `resolve_latent_universe(session, backtest.symbol, backtest.timeframe)` and
  `build_kind_weights(session, symbol=, timeframe=, n_latents=, start=, end=, latent_model_hash=)`,
  then constructs `GeneticCandidateProvider(... latent_universe=, kind_weights=)`.
- `src/q_backend/backtesting/genome/latent_universe.py` — `resolve_latent_universe(...) ->
LatentUniverse(indicator_kinds, latent_model_hash, n_latents)` and `default_latent_universe()`
  (returns `indicator_kinds=tuple(INDICATOR_KINDS)`, `latent_model_hash=None`, `n_latents=0` — i.e. the
  **no-latents** universe).
- `src/q_backend/backtesting/genome/score_bias.py::build_kind_weights(...)` — returns a
  `dict[str, float]`; empty dict ⇒ uniform seeding (the no-scores path).
- `src/q_backend/optimization/strategy_search.py::StrategySearchConfig` (≈line 147) — the per-run
  config Pydantic model (`backtest`, `objective`, `walkforward`, `gates`, `genetic`, `lockbox`, …).
- `src/q_backend/api/strategy_search_jobs.py` — four call sites invoke the factory as
  `create_genetic_candidate_provider(request.genetic, request)` (≈lines 517, 879, 1064, 1106).

## Goal

A discovery run can be told — internally only — to ignore any PRODUCTION model and run latents-OFF, so
the A/B harness (WO154) can pair a latents-OFF _control_ against a latents-ON _treatment_ on the same
instrument and seed.

```python
# strategy_search.py — StrategySearchConfig
latents_enabled: bool = True  # internal; never set by the frontend discovery form

# genetic_search.py
def create_genetic_candidate_provider(genetic_config, search_config, probe_df=None,
                                      latents_enabled: bool = True):
    if not latents_enabled:
        latent_universe = default_latent_universe()
        kind_weights = {}
    else:
        ...  # unchanged
```

## Tasks

### 1. Internal config field — `strategy_search.py`

- Add `latents_enabled: bool = True` to `StrategySearchConfig`. Document inline that it is an
  **internal harness override**, defaults to `True` (normal automatic behaviour), and is intentionally
  **not** part of the frontend discovery request surface.

### 2. Factory override — `genetic_search.py`

- Add a `latents_enabled: bool = True` parameter to `create_genetic_candidate_provider`.
- When `False`: do **not** open the latent `session_scope`/resolve path; set
  `latent_universe = default_latent_universe()` and `kind_weights = {}`. When `True`: behaviour is
  exactly as today (byte-for-byte — do not refactor the existing branch).

### 3. Thread the flag at the call sites — `strategy_search_jobs.py`

- At each of the four `create_genetic_candidate_provider(request.genetic, request)` sites, pass
  `latents_enabled=request.latents_enabled`.

## Guardrails

> **Internal only.** `latents_enabled` lives on `StrategySearchConfig` + the factory parameter. It is
> never added to the frontend discovery request form (WO156/157 add a _separate_ Experiments surface,
> not this field). Normal discovery stays automatic.
> **Byte-identical control.** `latents_enabled=False` must produce a population **byte-identical to the
> no-PRODUCTION-model path** for the same `init_seed`, even when a PRODUCTION model exists for the
> instrument. This is the contract the A/B harness depends on.
> **Default unchanged.** With `latents_enabled=True` (the default), every existing run — and every
> existing test — must behave exactly as before. Do not alter the `True` branch.
> **No DB when disabled.** The `False` branch must not open the latent `session_scope` at all.

## Tests

- `tests/optimization/test_latents_enabled_seam.py`:
  - **Headline regression:** seed a tiny PCA PRODUCTION model for `(symbol, timeframe)` (reuse the
    fixtures from `tests/neural/test_pipeline_integration.py` / `tests/optimization/test_discovery_latents.py`).
    Build two providers via `create_genetic_candidate_provider` with the same `init_seed`: one
    `latents_enabled=True`, one `latents_enabled=False`. Assert the `True` provider's initial population
    **contains** `ind.latent` somewhere (production model present) and the `False` provider's initial
    population is **byte-identical** to a provider built with **no** production model
    (same `init_seed`) — i.e. `default_latent_universe()` and no `ind.latent`.
  - Assert the `False` branch did not resolve a latent universe (e.g. `latent_universe.n_latents == 0`,
    `latent_model_hash is None`).
  - Revert-guard: with the seam removed (or `False` ignored), the byte-identical assertion must fail.
- Run the existing `tests/optimization/test_discovery_latents.py` + `test_discovery_score_bias.py`
  unchanged to prove the default path is untouched.

## Docs

- `docs/design/discovery-payoff-validation.md`: mark the WO153 seam as implemented.
- Cross-link the `latents-into-discovery-batch` memory + WO154.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the `create_genetic_candidate_provider` signature diff + test output showing
  the `latents_enabled=False` population is byte-identical to the no-model population for a fixed seed
  while `latents_enabled=True` carries an `ind.latent`.

## Out of scope

- The A/B orchestration job that _uses_ this flag — **WO154**.
- Encoder ablation — **WO155**.
- Any frontend / any new request schema field exposed to the discovery form.
- Changing the automatic "production model ⇒ latents on" default behaviour.
