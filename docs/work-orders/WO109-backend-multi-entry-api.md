# WO109 — Backend: multi-entry API schema + run wiring + managers catalog

## Shared context (read first)

Two-repo project on Windows. Backend `q_backend` uses `uv` (`uv run pytest`) — never pip/poetry.
Read `docs/design/multi-entry-composition.md` (**Architecture → Backend**). Depends on **WO108**
(`CompositeEntryStrategy` + `build_composite_entry`).

## How the pieces work today (read these files)

- `src/q_backend/api/schemas/backtest.py` — `BacktestRequest` (`strategy: str`,
  `strategy_params: dict`). Extend here.
- `src/q_backend/api/backtest_jobs.py` — `BacktestJobRequest` (mirrors the fields, line ~66),
  `_request_config` (persisted config dict), `_execute_candle` (line ~155) calls
  `build_strategy(request.strategy, request.strategy_params, request.symbol)` and
  `serialize_chart_data(strategy.compute_indicators(...), strategy)`. This is the candle run path
  to branch.
- `src/q_backend/backtesting/run_service.py` — `backtest_run_fields` / `backtest_run_list_item` /
  `backtest_run_detail` read `config["strategy"]` for list/detail display.
- `src/q_backend/api/routers/strategies.py` — catalog endpoints: `/api/v1/strategies`,
  `/api/v1/exit-rules`. Add the managers endpoint here.
- `src/q_backend/backtesting/signal_managers/registry.py` — `list_signal_managers()`,
  `get_manager()` (from WO107).

## Goal

A backtest request can carry multiple entries + a manager; the legacy single-strategy shape still
works untouched.

```jsonc
{
  "symbol": "WINFUT",
  "timeframe": "M5",
  "entries": [
    { "strategy": "MACrossover", "params": { "short_period": 10, "long_period": 30 } },
    { "strategy": "RSIMeanReversion", "params": { "rsi_period": 14 } },
  ],
  "entry_manager": { "kind": "majority", "params": { "vote_threshold": 2 } },
  "exit_params": { "stop_loss_atr": 2.0, "atr_period": 14 },
}
```

## Tasks

### 1. Schema — `schemas/backtest.py`

Add models + fields (all optional for back-compat):

```python
class EntryInstance(BaseModel):
    strategy: str
    params: Dict[str, Any] = {}

class EntryManagerConfig(BaseModel):
    kind: str = "or"
    params: Dict[str, Any] = {}

# on BacktestRequest:
entries: Optional[List[EntryInstance]] = None
entry_manager: EntryManagerConfig = EntryManagerConfig()
exit_params: Dict[str, Any] = {}
```

Mirror the same three fields on `BacktestJobRequest` in `backtest_jobs.py`.

### 2. Normalization helper

Add `normalize_entries(request) -> tuple[list[EntryInstance], EntryManagerConfig, dict]` (in
`backtest_jobs.py` or a small `backtesting/entry_config.py`):

- If `request.entries` is set → return `(entries, entry_manager, exit_params)`.
- Else (legacy) → split `strategy_params` into entry vs exit params using the registry: exit params
  are those whose `StrategyParamSpec.exit_group` is set (reuse `get_exit_strategy_params()` names);
  return `([EntryInstance(strategy=request.strategy, params=entry_part)],
EntryManagerConfig(kind="or"), exit_part)`. This guarantees the legacy path is just "one instance
  - OR" and keeps exits flowing to `ExitStrategy`.

### 3. Run wiring — `_execute_candle`

- Call `normalize_entries`. If a single instance **and** `kind == "or"` **and** no per-instance
  duplication, you MAY keep calling `build_strategy` (identical behavior); otherwise call
  `build_composite_entry(entries, manager.kind, manager.params, exit_params, request.symbol)`.
  Simplest correct option: **always** go through `build_composite_entry` — WO108's equivalence test
  proves it matches the legacy single path, so prefer one code path. Confirm `serialize_chart_data`
  works with the composite's `get_chart_indicators()` (namespaced keys).
- `_persist_run_start` / `get_or_create_strategy(session, name=...)`: for multi-entry, persist a
  human label like `"MACrossover+RSIMeanReversion (majority)"` as the run's `strategy` name so list
  views read sensibly. Keep `config` carrying the full `entries`/`entry_manager`/`exit_params` for
  detail/replay.

### 4. Config display — `run_service.py`

`backtest_run_fields`: when `config.get("entries")` is present, derive the display `strategy`
string from the instances + manager (e.g. join strategy names with `+`, suffix `(<kind>)`); else
fall back to `config.get("strategy")`.

### 5. Managers catalog endpoint — `routers/strategies.py`

```python
@router.get("/api/v1/signal-managers", response_model=SignalManagerCatalogResponse)
def list_signal_managers_catalog():
    return {"managers": list_signal_managers()}
```

Add `SignalManagerCatalogResponse` (`managers: list[SignalManagerInfo]`) in
`strategy_registry.py`. Also expose each manager's `param_specs()` so the frontend can render
`vote_threshold` (include a `params: list[StrategyParamSpec]` on `SignalManagerInfo`, or a sibling
field — keep consistent with how exit-rule params are surfaced).

## Guardrails

> **Back-compat is mandatory:** an existing payload with only `strategy`/`strategy_params` (exits
> mixed in) must produce byte-identical trades + chart data. Add a regression test that runs the
> same fixture through the old shape and the equivalent `entries` shape and asserts equal trades.
> Tick engine (`_execute_tick`) is **unchanged** — multi-entry is candle-only for now; reject
> `entries` for `engine == "tick"` with a clear 4xx (or ignore + document). State which in the PR.
> `config` persisted must round-trip (entries/manager/exit_params) so saved runs replay correctly.

## Tests

- `tests/api/test_backtest_multi_entry.py`:
  - POST with `entries` (2 instances + majority) returns a completed run; detail `config` carries
    `entries`/`entry_manager`/`exit_params`.
  - **Legacy equivalence:** old `strategy`/`strategy_params` payload and the normalized single-entry
    `entries` payload yield equal trade lists.
  - `GET /api/v1/signal-managers` lists 3 managers with `vote_threshold` exposed for `majority`.
  - List/detail `strategy` display string is the `A+B (kind)` label for multi-entry.

## Docs

- `docs/design/multi-entry-composition.md`: tick a box that the API shape landed (no new doc).

## Definition of done

- `uv run pytest` passes — **do not report completion until it does.**
- Paste-in-final-message: the exact `entries` request JSON you ran, and confirmation that the
  legacy-equivalence regression test passes.

## Out of scope

- Optimization search space — **WO110**. Frontend — **WO111/112**.
