# WO110 — Backend: multi-entry optimization search space

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/multi-entry-composition.md`. Depends on **WO108** (composite) + **WO109** (request
schema/normalization). Related prior work: WO87 (domain-grounded default search spaces) —
see memory [[search-space-derivation-paths]].

## How the pieces work today (read these files)

- `src/q_backend/optimization/search_space.py` — `suggest_params(trial, search_space)` namespaces
  optuna param keys (`strategy__<key>`, `risk__<key>`) and returns `TrialParams`.
- `src/q_backend/optimization/auto_search_space.py` — `derive_strategy_search_space(strategy_name)`
  reads `entry.info.params` and splits searchable vs fixed; `auto_search_space` merges risk dims.
- `src/q_backend/optimization/backtest_runner.py` — `build_strategy(config.strategy,
config.strategy_params, config.symbol)` (line ~189); the runner config object (line ~28) carries
  `strategy` + `strategy_params`.
- `src/q_backend/optimization/models.py` — `SearchSpaceConfig`, `TrialParams`, `SearchParam`.
- `src/q_backend/optimization/exit_preset_search_space.py` — how exit params get into the search
  space today (pattern reference for adding manager params).

## Goal

Optimize params **across all entry instances** in a multi-entry setup (each instance's params
namespaced by slot), plus optional manager params, while exits keep being searched as today.

```
strategy__e0__short_period, strategy__e0__long_period,
strategy__e1__rsi_period, ...
manager__vote_threshold
```

## Tasks

### 1. Per-instance search-space derivation — `auto_search_space.py`

Add `derive_multi_entry_search_space(entries: list[EntryInstance], manager: EntryManagerConfig)
-> tuple[SearchSpaceConfig, dict]`:

- For each instance at slot `e{i}`, call the existing per-spec logic (`_search_param_from_spec`)
  over `get_registered_strategy(name).info.params`, but key each searchable param `e{i}__<name>`
  (and fixed params `e{i}__<name>` in `fixed_params`).
- If the manager exposes searchable params (e.g. `majority.vote_threshold`), add them under a
  `manager__<name>` namespace (extend `SearchSpaceConfig` with a `manager_params` dict, or fold
  into a clearly-prefixed bucket — keep symmetry with `strategy_params`/`risk_params`).

### 2. Suggest + reassemble — `search_space.py`

- `suggest_params`: emit `strategy__e{i}__<key>` and `manager__<key>` keys.
- Add a reassembly helper `entries_from_trial_params(strategy_params: dict, entries_template) ->
list[EntryInstance]` that regroups the flat `e{i}__<key>` values back into per-instance param
  dicts (template provides the slot→strategy-name mapping + any fixed params).

### 3. Runner wiring — `backtest_runner.py`

- The runner config gains `entries` / `entry_manager` / `exit_params` (mirror WO109's normalize).
- When `entries` present: rebuild instances via `entries_from_trial_params`, resolve the manager
  (`get_manager(kind, manager_params)`), and call `build_composite_entry(...)` instead of
  `build_strategy(...)`. Single-entry path unchanged.

### 4. Auto-mode default

When the optimizer is asked to auto-build a search space for a multi-entry config, iterate the
instances (don't just read one `strategy_name`). Keep WO87's domain-grounded per-strategy bounds —
they already live on each `StrategyParamSpec` (`search_min`/`search_max`/`search_scale`), so
per-instance derivation inherits them for free.

## Guardrails

> **Determinism:** identical seed + identical multi-entry config ⇒ identical trial params and
> trades. Namespacing must be stable (sort instances by slot index, not by dict order).
> **Single-entry parity:** a one-instance config must derive the same effective search space as
> `derive_strategy_search_space(name)` modulo the `e0__` prefix — add a test asserting the param
> set matches after stripping the prefix.
> Exits keep their existing search treatment — do not move exit params under the `e{i}__` namespace
> (exits are position-level / shared).

## Tests

- `tests/optimization/test_multi_entry_search_space.py`:
  - Two instances (incl. a **duplicate** strategy type with different bounds) derive disjoint
    `e0__*` / `e1__*` param keys; no collisions.
  - `manager__vote_threshold` appears only for the `majority` manager.
  - `entries_from_trial_params` round-trips: derive → suggest (stub trial) → reassemble yields the
    original instance/param structure.
  - Single-entry parity test (prefix-stripped key set equals `derive_strategy_search_space`).
  - A short optimization run over a 2-instance config completes and the best trial rebuilds a valid
    `CompositeEntryStrategy`.

## Docs

- None beyond the design doc.

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the namespaced param-key list for a 2-instance majority config, and
  confirmation the single-entry parity test passes.

## Out of scope

- Frontend Optimize UI for instances/manager — **WO112**.
- Genetic discovery search space — untouched (out of scope for this batch).
