# WO127 — Backend: FeatureSpec schema + FeatureRegistry

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/feature-intelligence.md` (the whole doc — it sets the PIT/leakage contract and the
Phase-1→2 map). This is the **foundation WO of the Feature Intelligence batch (WO127–136)**: it has
no dependencies; WO128–136 all build on the registry defined here.

**Principle:** a _feature_ is a named, versioned, parameterized recipe that turns bars into one
series. We are not inventing new math — we are giving names + metadata to the indicator/node
primitives Q already computes inline.

## How the pieces work today (read these files)

- `src/q_backend/backtesting/technical_indicators.py` — raw indicator functions: `compute_rsi`,
  `compute_atr`, `compute_macd`, `compute_bollinger_bands`, `compute_donchian_channels`,
  `compute_realized_vol`, `compute_yang_zhang`. **These are the leaf computations a FeatureSpec wraps.**
- `src/q_backend/backtesting/moving_averages.py` — `compute_ma`, `normalize_ma_type`.
- `src/q_backend/backtesting/genome/node_specs.py` — `NODE_SPECS: dict[str, NodeSpec]`, the existing
  primitive vocabulary (`ind.rsi`, `ind.ma`, `ind.ema`, `ind.macd`, `ind.bollinger`, `ind.donchian`,
  `ind.momentum`, `ind.realized_vol`, …) with `allowed_param_keys`, arity, and output-type tags.
  **The v1 feature catalog is derived from these `ind.*` specs — reuse `allowed_param_keys` so a
  feature's params can't drift from the primitive's.**
- `src/q_backend/backtesting/genome/composite_strategy.py::_evaluate_node` — the switch that maps each
  `ind.*` kind to its compute call (e.g. `ind.rsi` → `compute_rsi(source, period)`). **This is the
  ground truth for "which function + which params" each feature wraps.**

## Goal

A registry that lists named feature specs and resolves one by `(name, version, params)`.

```python
# src/q_backend/features/registry.py
@dataclass(frozen=True)
class FeatureSpec:
    name: str                       # "rsi", "atr", "realized_vol"
    version: int                    # bump when the recipe changes
    category: str                   # "momentum" | "volatility" | "trend" | "volume" | "price"
    node_kind: str                  # the NODE_SPECS key this wraps, e.g. "ind.rsi"
    param_keys: frozenset[str]      # == NODE_SPECS[node_kind].allowed_param_keys
    default_params: dict[str, Any]
    lookback_param: str | None      # which param drives warm-up ("period"), or None
    forward_window: int             # MUST be 0 for a feature (see design §1)
    output_type: str                # "oscillator" | "price_series"
    leakage_status: str             # "clean" | "suspect" | "unverified"
    description: str

def list_feature_specs() -> list[FeatureSpec]: ...
def get_feature_spec(name: str, version: int | None = None) -> FeatureSpec: ...  # None → latest
def resolve_params(spec: FeatureSpec, overrides: dict[str, Any]) -> dict[str, Any]: ...
def feature_id(spec: FeatureSpec, params: dict[str, Any]) -> str: ...  # stable hash id
```

## Tasks

### 1. New package `src/q_backend/features/` with `registry.py`

- Define `FeatureSpec` (frozen dataclass, fields above).
- Build `FEATURE_SPECS: dict[str, FeatureSpec]` for the v1 catalog. **One spec per `ind.*` node** in
  `NODE_SPECS` that produces a usable series — at minimum: `rsi`, `atr`, `macd` (with its line/signal
  ports — emit one spec per usable output port, suffix the name, e.g. `macd`, `macd_signal`),
  `bollinger` (band width / %b), `realized_vol`, `momentum`, `ma`, `ema`, `donchian` (channel
  position), `tsmom`, `trend_blend`. Each spec's `param_keys` **must equal**
  `NODE_SPECS[node_kind].allowed_param_keys` — assert this at module import so the catalog can't drift.
- All v1 specs are `version=1`, `forward_window=0`, `leakage_status="clean"` (they are causal
  rolling computations). Set `lookback_param` to the window param that drives warm-up (`"period"`,
  `"window"`, etc. — read each from `_evaluate_node`).
- `resolve_params`: start from `default_params`, apply `overrides`, reject any key not in `param_keys`
  (raise `ValueError`), return the merged dict.
- `feature_id(spec, params)`: `f"{spec.name}.v{spec.version}"` plus a short stable hash of
  `sorted(params.items())` — deterministic, used as the matrix column name and DB natural key.

### 2. Guard: `forward_window == 0` for every registered spec

Add a module-import assertion that no `FeatureSpec` has `forward_window != 0`. A non-causal recipe is
a _target_ (WO132), never a feature. Document this in a comment referencing design §1.

### 3. Category + leakage helpers

- `list_categories() -> list[str]` (sorted distinct categories).
- `assert_catalog_consistent()` — runs the param-key and forward-window checks; call it at import and
  expose it for the test.

## Guardrails

> **No computation here.** This WO defines the catalog + resolution only. The actual bars→series
> compute is WO128. `registry.py` must not import pandas-heavy compute modules at top level beyond
> what it needs for type hints.
> **Single source of param truth.** A feature's `param_keys` is _derived from_ `NODE_SPECS`, never
> hand-duplicated. If they disagree, fail at import.
> **Versioning is explicit.** Changing a recipe means a new `version`, never editing v1 in place.

## Tests

- `tests/features/test_registry.py`:
  - `assert_catalog_consistent()` passes; every spec's `param_keys == NODE_SPECS[node_kind]
.allowed_param_keys`.
  - every spec has `forward_window == 0`.
  - `get_feature_spec("rsi")` returns the latest version; `resolve_params` rejects an unknown key and
    merges a valid override.
  - `feature_id` is stable across calls and differs when a param differs.

## Docs

- `docs/design/feature-intelligence.md`: tick that the registry landed (no new doc).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the output of `list_feature_specs()` as `name.vN — category — params`, one
  line per spec, so the v1 catalog is reviewable.

## Out of scope

- Bars→series computation and PIT trimming — **WO128**.
- Matrix caching — **WO129**. DB persistence — **WO130**.
