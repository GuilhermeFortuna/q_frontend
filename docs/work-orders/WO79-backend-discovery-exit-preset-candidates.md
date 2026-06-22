# WO79 — Backend: discovery exit-preset candidate expansion

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** Discovery can already sweep registered strategies and genetic genomes, but
exit logic is not treated as a first-class discovery axis. That makes the search spend most of its
budget rediscovering entry variants while missing that many "interesting strategies" are really
ordinary entries with superior exit behavior. WO66 added an exit-rule catalog and named presets;
WO78 corrected Optimization semantics so selected exits are **search candidates** rather than
forced-on. This WO brings the same idea to **Discovery registry sweep**: every selected candle
strategy can be expanded into candidate variants that search a curated exit preset independently.

This is backend-only and additive. With the new config omitted, the current Discovery result must be
byte-compatible with WO31/WO32 behavior.

---

## How the pieces work today (read these files)

- `src/q_backend/optimization/strategy_search.py`
  - `StrategySearchConfig` — request model for Discovery.
  - `RegistryCandidateProvider.candidates()` — yields one `SearchCandidate` per selected candle
    strategy.
  - `SearchCandidate(candidate_id, strategy, search_space, fixed_params)` — what walk-forward
    evaluates.
  - `_FixedParamsBacktestRunner` — merges candidate `fixed_params` into every trial's
    `strategy_params`.
- `src/q_backend/optimization/auto_search_space.py`
  - `derive_strategy_search_space(strategy_name)` derives a search space from the full registry
    param list, including exit params.
  - `auto_search_space(strategy_name, include_risk=...)` optionally merges risk search.
- `src/q_backend/backtesting/exit_rules/presets.py`
  - `EXIT_PRESETS` — named curated exit parameter maps.
- `src/q_backend/backtesting/exit_rules/registry.py`
  - `list_exit_rules()`, `shared_exit_params()`, `all_param_specs()`.
- Tests to read/extend:
  - `tests/optimization/test_strategy_search.py`
  - `tests/optimization/test_auto_search_space.py`
  - `tests/api/test_strategy_search_persistence.py`

---

## Goal

Discovery can evaluate exit-policy variants explicitly:

```text
MACrossover
MACrossover__exit_fixed_pct_bracket
MACrossover__exit_atr_stop_chandelier
MACrossover__exit_donchian_channel_trail
RSIMeanReversion
RSIMeanReversion__exit_fixed_pct_bracket
...
```

Each exit candidate searches only the preset's intended exit family on/off and magnitude. Other
applicable exits are pinned off so candidates remain interpretable.

## Tasks

### 1. Add Discovery exit expansion config

Add an additive config object to `StrategySearchConfig`, for registry sweep only:

```python
class ExitPresetSearchConfig(BaseModel):
    enabled: bool = False
    preset_ids: list[str] | None = None        # None = all backend presets
    include_baseline: bool = True              # keep the no-preset strategy candidate
    pin_non_preset_exits_off: bool = True
```

Field on `StrategySearchConfig`:

```python
exit_presets: ExitPresetSearchConfig = Field(default_factory=ExitPresetSearchConfig)
```

Guardrail: when `genetic is not None`, this config is ignored or rejected with a clear validation
message. Genetic exit-policy evolution is WO80.

### 2. Build preset-specific search spaces

Add a helper near `auto_search_space.py` or in a small new module:

```python
derive_exit_preset_search_space(
    strategy_name: str,
    preset: ExitPreset,
    *,
    include_risk: bool,
    pin_non_preset_exits_off: bool = True,
) -> tuple[SearchSpaceConfig, dict[str, Any]]
```

Behavior:

- Entry params: unchanged, searchable as today.
- Preset-owned exit params: searchable ranges derived from registry specs.
- Preset enable params: ranges whose `low` includes `0`, so the optimizer can test entry-only and
  entry-plus-exit inside the same candidate.
- Shared required params such as `atr_period`: searchable only when a selected preset needs them.
- Non-preset applicable exit enable params: pinned fixed `0` in `fixed_params` when
  `pin_non_preset_exits_off=True`.
- Risk params: merged using the existing `include_risk_search` behavior.

The helper must use the exit catalog as the source of truth. Do not hardcode param names except in
tests.

### 3. Expand `RegistryCandidateProvider`

When `config.exit_presets.enabled`:

- Yield the baseline strategy candidate only when `include_baseline=True`.
- Yield one candidate per `(strategy, preset)` pair.
- Candidate id format:

```text
{StrategyName}__exit_{preset_id}
```

- Candidate `fixed_params` must include a metadata key that survives into `best_params`/candidate
  metadata where practical:

```python
{"_exit_preset_id": preset.id}
```

Do not pass private metadata into `build_strategy` if it would break validation; strip it at the
runner seam if needed.

### 4. Candidate metadata and result payload

Add optional candidate metadata for exit-expanded candidates:

```json
{
  "exit_preset_id": "atr_stop_chandelier",
  "exit_preset_label": "ATR stop + Chandelier trail",
  "exit_param_names": ["stop_loss_atr", "atr_period", "chandelier_atr_mult"]
}
```

Persist it through the existing candidate metadata path if available. If DB schema changes are
required, make fields nullable/additive.

## Guardrails

> **Default byte compatibility.** With `exit_presets.enabled=False`, registry Discovery must produce
> the same candidate ids, search spaces, request behavior, persistence, and API payloads as today.

> **Candidate exits are searched, not forced on.** A preset's enable param must include `0` in its
> sampled range. A preset candidate may still choose entry-only in some trials.

> **Non-preset exits are off.** If `pin_non_preset_exits_off=True`, every other applicable exit's
> enable param is fixed to `0`, so a candidate named for one preset remains interpretable.

> **No genetic change.** Genetic exit-policy mutation/initialization is WO80. Do not modify genome
> operators here.

> **No frontend dependency.** Existing Discover UI should continue to render candidates as rows even
> if it ignores the optional exit metadata.

## Tests

- `derive_exit_preset_search_space`:
  - fixed bracket preset emits `stop_loss_pct` and `take_profit_pct` as ranges with `low == 0`.
  - ATR/chandelier preset emits `atr_period` plus ATR/chandelier params.
  - unrelated exit enable params are pinned fixed `0`.
  - baseline derivation is unchanged.
- `RegistryCandidateProvider`:
  - default config yields exactly the old selected strategy ids.
  - enabled exit presets yield `strategy_count * preset_count` plus optional baselines.
  - tick strategies remain unsupported.
- `evaluate_candidate` smoke test:
  - an exit-expanded candidate merges params correctly and does not pass metadata keys into strategy
    construction.
- Persistence/API tests:
  - optional exit metadata survives result serialization when present.
  - old DB/API payload consumers still work when metadata is absent.

## Docs

`q_backend/README.md`: extend the Strategy Search section with the new `exit_presets` config, the
candidate id convention, and the "candidate exits are searched on/off, not forced on" semantics.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Registry Discovery can expand strategies by exit preset while default behavior is unchanged.
- Final message must paste:
  - the `ExitPresetSearchConfig` fields,
  - one sample `SearchCandidate` id + search-space shape,
  - how preset params are searched and non-preset exits are pinned off.

## Out of scope

- Genetic exit-policy operators or seeded genomes — WO80.
- Exit-quality analytics/MAE/MFE — WO81.
- Frontend exit insight UI — WO82.
