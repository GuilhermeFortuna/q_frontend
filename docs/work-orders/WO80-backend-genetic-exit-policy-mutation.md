# WO80 — Backend: genetic exit-policy seeding + mutation

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** WO79 makes registry Discovery search curated exit presets. Genetic
Discovery still evolves entry structure and a small set of genome exit nodes (`opposite_signal`,
`middle_band`, `fixed_holding`, `rebalance`) but does not aggressively explore the composable risk
exits that exist in the exit-rule catalog. This WO makes exit logic a first-class genetic mutation
surface: seed some genomes with strong exit policies, add exit-only mutation operators, and expose
their params through `derive_genome_search_space`.

This WO is backend-only. It must not change the registry-sweep path except through shared helpers
that are disabled by default.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/node_specs.py`
  - v1 genome primitive allowlist and output-type tags.
- `src/q_backend/backtesting/genome/operators.py`
  - `EXIT_BOOL_KINDS`, `MUTATION_OPERATORS`, `_mutate_swap_exit`, `build_initial_population`,
    `mutate_genome`, `crossover_genomes`.
- `src/q_backend/backtesting/genome/composite_strategy.py`
  - interprets `Genome` into entry/exit signal columns and `check_exit_conditions`.
- `src/q_backend/backtesting/genome/search_space.py`
  - `derive_genome_search_space` maps genome param refs to Optuna search dimensions.
- `src/q_backend/backtesting/genome/param_bounds.py`
  - bounds for genome param refs.
- `src/q_backend/backtesting/exit_strategy.py` and `exit_rules/`
  - composable exit-rule runtime used by registered candle strategies.
- `src/q_backend/optimization/genetic_search.py`
  - `GeneticCandidateProvider`, `search_candidate_for_genome`, fitness metadata.
- Tests to read/extend:
  - `tests/backtesting/test_genome_operators.py`
  - `tests/backtesting/test_genome_validation.py`
  - `tests/backtesting/test_composite_genome_causality.py`
  - `tests/optimization/test_genetic_search.py`

---

## Goal

Genetic search can improve a tradeable entry by changing only the exit policy:

```text
entry_long/entry_short unchanged
exit policy mutates:
  opposite_signal
  fixed_holding
  ATR stop + Chandelier trail
  Donchian trail
  breakeven + time stop
  profit ratchet + ATR stop
```

The GA should be able to breed entry structure and exit structure separately, so it does not destroy
a promising entry just to try a different exit.

## Tasks

### 1. Add genome-level exit-rule policy support

Introduce a genome representation for composable exit-rule policies. Prefer the smallest additive
shape that keeps existing genomes valid, for example:

```json
{
  "metadata": {
    "exit_rule_policy": {
      "preset_id": "atr_stop_chandelier",
      "params": {
        "stop_loss_atr": { "param": "exit_stop_loss_atr" },
        "atr_period": { "param": "exit_atr_period" },
        "chandelier_atr_mult": { "param": "exit_chandelier_atr_mult" }
      }
    }
  }
}
```

Alternative: add explicit `exit.rule_policy` node kind. If using a node kind, update validation,
port typing, compilation, and fixtures accordingly.

Existing genomes without this policy must behave exactly as they do today.

### 2. Wire `CompositeStrategy` to `ExitStrategy`

When a genome has an exit-rule policy:

- Construct `ExitStrategy` from the merged genome/trial exit params.
- Run it before or alongside the genome's own `check_exit_conditions`, matching `BacktestEngine`
  precedence for registered strategies.
- Preserve `exit_reason` with the exit rule id.
- Keep the closed-bar / next-bar-open execution contract unchanged.

### 3. Derive exit params into the genome search space

Extend `derive_genome_search_space` so exit-policy param refs become searchable dimensions using
central bounds.

Add bounds for exit-rule params to `GENOME_PARAM_BOUNDS` with names that avoid collisions with entry
params, e.g. `exit_stop_loss_atr`, `exit_atr_period`, `exit_donchian_exit_period`.

All enable/magnitude params must include `0` in their search range so the optimizer can turn an exit
off inside a candidate.

### 4. Seed initial population with exit-policy variants

Add `GeneticSearchConfig` fields:

```python
seed_exit_policies: bool = True
exit_policy_preset_ids: list[str] | None = None
exit_policy_seed_fraction: float = 0.25
```

During `build_initial_population`, clone a subset of registry-equivalent or random tradeable genomes
with curated exit policies attached. Respect `population_size`, `max_nodes`, `max_depth`, and
determinism.

### 5. Add exit-only mutation operators

Add mutation operators such as:

- `swap_exit_policy`
- `add_exit_stop`
- `replace_exit_with_preset`
- `drop_exit_policy`
- `nudge_exit_param_ref`

These operators should alter only the exit policy when possible, leaving `entry_long` and
`entry_short` unchanged. Add them to adaptive operator weighting from WO55.

### 6. Metadata

For every genetic candidate, persist additive metadata:

```json
{
  "exit_policy_id": "atr_stop_chandelier",
  "exit_policy_label": "ATR stop + Chandelier trail",
  "exit_param_names": ["exit_stop_loss_atr", "exit_atr_period", "exit_chandelier_atr_mult"],
  "last_exit_mutation_op": "swap_exit_policy"
}
```

## Guardrails

> **Existing genomes remain valid.** All current genome fixtures and registry-equivalent genomes
> must validate and backtest as before when no exit-rule policy is present.

> **Entry-preserving exit mutation.** Exit-only mutation tests must prove `entry_long` and
> `entry_short` refs are unchanged.

> **Causal and next-open semantics.** Exit policies can only read current closed-bar data and
> precomputed causal columns. They emit close signals that the engine fills at the next bar open.

> **No forced-on exits.** Exit-rule enable/magnitude search dimensions include `0`.

> **Determinism.** Same `init_seed` and config produces identical initial populations, mutations,
> and metadata.

## Tests

- Genome validation:
  - old genomes with no exit policy validate unchanged.
  - genomes with each supported exit preset validate.
- Search-space derivation:
  - exit-policy params appear as strategy params with `low == 0` for enable/magnitude fields.
- CompositeStrategy:
  - a genome with a fixed SL exits through `ExitStrategy` and records `exit_reason="fixed_sl"`.
  - genome signal exits still work when no exit-rule policy is attached.
  - precedence is deterministic when both an exit rule and a genome exit signal fire.
- Operators:
  - exit-only mutation preserves entries.
  - `swap_exit_policy` can move between at least three preset families.
  - adaptive operator metadata records the exit mutation op.
- Genetic provider:
  - `seed_exit_policies=True` inserts exit-policy variants into the initial population.
  - same seed produces identical policy distribution.
- Full regression:
  - existing genetic/search/walk-forward tests pass unchanged.

## Docs

`q_backend/README.md`: extend the genetic synthesis section with exit-rule policy seeding, exit-only
mutation operators, and how this differs from WO79 registry preset expansion.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Genetic search can seed and mutate exit policies independently of entries.
- Final message must paste:
  - the genome exit-policy shape,
  - added `GeneticSearchConfig` fields,
  - new mutation operators,
  - one sample candidate metadata payload.

## Out of scope

- Registry sweep exit-preset expansion — WO79.
- Exit-quality analytics and exit-family scoring — WO81.
- Frontend rendering — WO82.
