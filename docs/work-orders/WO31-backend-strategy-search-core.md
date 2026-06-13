# WO31 — Backend: automatic strategy search core (walk-forward-gated leaderboard)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** this batch ("Discovery") adds **automatic strategy search**: point
the system at an instrument + date range, sweep every registered strategy, optimize each,
**walk-forward-validate each**, and return a leaderboard ranked on out-of-sample performance —
never in-sample. This is the platform's overfitting-aware "which strategy actually works
here?" answer. This WO builds the pure compute core: a candidate abstraction, an evaluator
that wraps the existing walk-forward runner, and an orchestrator that ranks results. It is
**backend only** — no API route, no DB, no Redis, no lake (all WO32).

**Design intent — build the seam, not just the sweep.** A later batch will add _genetic
strategy synthesis_ (evolving brand-new strategies). To make that a drop-in, this WO defines
the search over **candidates** behind a `CandidateProvider` protocol. The registry sweep is
one provider; the genetic engine will be another, reusing this WO's evaluator and runner
wholesale. Keep that boundary clean.

**Prerequisite shipped:** WO30 (`optimization/auto_search_space.py`).

---

## How the pieces you're composing work today (read these files)

- `src/q_backend/optimization/auto_search_space.py` (WO30) — `auto_search_space(name,
include_risk=...)` and `derive_strategy_search_space(name) -> (SearchSpaceConfig,
fixed_params)`. Use these to give each candidate its search space; merge `fixed_params`
  into the optimization config so unbounded params stay at their defaults.
- `src/q_backend/optimization/walkforward.py` — **reuse `WalkForwardRunner` as-is**, one
  instance per candidate.
  - `WalkForwardConfig(train_days, test_days, mode, min_windows)`.
  - `WalkForwardRunner(config: OptimizationConfig, wf_config, backtest_runner).run(
progress_callback, should_stop)` → `WalkForwardResult(windows, oos_equity_curve,
oos_metrics, efficiency)`; `WalkForwardWindowResult` carries `status`, `is_metrics`,
    `oos_metrics`, `best_params`, `oos_trades`.
  - Its `__init__` rejects multi-objective and `engine="tick"` with `ValueError` — you'll
    pre-filter so those never reach it.
- `src/q_backend/optimization/models.py` — `OptimizationConfig` (study/objective/backtest/
  search_space), `BacktestConfig`, `StudyConfig`, `ObjectiveConfig`, `ObjectiveMode`. Note
  `BacktestConfig`'s `_to_naive_local` normalization and the `start < end` validator.
- `src/q_backend/optimization/objectives.py` — `resolve_objective(metrics, mode)`; rank
  candidates on `resolve_objective(result.oos_metrics, objective.mode)` (single-objective
  only this batch). Mind the direction: `MINIMIZE_DRAWDOWN` is "smaller is better".
- `src/q_backend/optimization/backtest_runner.py` — `DefaultBacktestRunner.from_market_data_sliced`
  (load-once, then slice per window). WO32 constructs the runner on the request thread and
  passes it in; **your runner must accept an injected `backtest_runner` and never fetch data
  itself.**
- `src/q_backend/backtesting/strategy_registry.py` — `list_registered_strategies()` (each has
  `.name`, `.engine`), `get_registered_strategy(name)`.

---

## Goal

```python
StrategySearchRunner(config, backtest_runner).run(progress_callback, should_stop)
    -> StrategySearchResult        # a ranked leaderboard of CandidateResult, OOS-gated
```

Pure, in-memory, deterministic given a seed. One data load for the whole search (the
injected runner enforces it).

## Tasks

### 1. New module `src/q_backend/optimization/strategy_search.py`

**Config:**

```python
class GateConfig(BaseModel):
    min_completed_windows: int = Field(default=2, ge=1)
    min_oos_trades: int = Field(default=10, ge=0)
    efficiency_low: float = 0.3      # below → flagged "overfit"
    efficiency_high: float = 1.5     # above → flagged "suspicious" (OOS >> IS)

class StrategySearchConfig(BaseModel):
    # instrument / range / capital — reuse BacktestConfig field names & the _to_naive_local
    # + start<end validators (factor the validator or embed a BacktestConfig and override
    #   `strategy` per candidate; embedding is simplest — see task 3).
    backtest: BacktestConfig          # `strategy` here is just a placeholder/default
    objective: ObjectiveConfig        # single-objective only (reject multi — see guardrail)
    walkforward: WalkForwardConfig
    study: StudyConfig                # n_trials/seed/sampler/pruner applied to every candidate
    strategies: list[str] | None = None   # None → all registered candle strategies
    include_risk_search: bool = True       # pass-through to auto_search_space
    gates: GateConfig = Field(default_factory=GateConfig)
```

**Candidate seam:**

```python
@dataclass(frozen=True)
class SearchCandidate:
    candidate_id: str                 # registry sweep: == strategy name
    strategy: str                     # registry strategy name (or synthesized name later)
    search_space: SearchSpaceConfig
    fixed_params: dict[str, Any]      # merged into every trial (WO30 unbounded params)

class CandidateProvider(Protocol):
    def candidates(self) -> Iterable[SearchCandidate]: ...
    def report(self, results: list[CandidateResult]) -> None: ...  # generational hook; no-op here

class RegistryCandidateProvider:
    """Yields one SearchCandidate per selected candle strategy via WO30's auto_search_space.
    Skips tick-engine strategies (records them as unsupported — see task 4)."""
```

**Result types:**

```python
@dataclass
class CandidateResult:
    candidate_id: str
    strategy: str
    status: Literal["completed", "no_result", "unsupported", "error"]
    rank: int | None                    # 1-based among ranked candidates; None if not ranked
    objective_value: float | None       # resolve_objective(oos_metrics, mode)
    robustness_score: float | None      # objective_value oriented so "higher = better"
    efficiency: float | None
    gate_flags: list[str]               # e.g. ["few_windows","low_efficiency"]; empty = passed
    passed_gates: bool
    oos_metrics: dict[str, Any] | None
    is_metrics_summary: dict[str, Any] | None   # mean IS objective etc. for the IS/OOS view
    best_params: dict[str, Any] | None  # winning strategy_params + risk_params (best window)
    window_count: int
    completed_windows: int
    oos_equity_curve: pd.Series | None  # stitched OOS curve (WO32 writes it to the lake)
    error: str | None

@dataclass
class StrategySearchResult:
    candidates: list[CandidateResult]   # full leaderboard, ranked then gated-below-passing
    objective_mode: ObjectiveMode
    best: CandidateResult | None        # top passing candidate, else None
```

### 2. The evaluator (the shared half of the seam)

```python
def evaluate_candidate(
    candidate: SearchCandidate,
    config: StrategySearchConfig,
    backtest_runner: BacktestRunner,
    progress_callback=None,
    should_stop=None,
) -> CandidateResult:
```

- Build an `OptimizationConfig` from `config`: copy `backtest` but set
  `backtest.strategy = candidate.strategy`; set `search_space = candidate.search_space`;
  set `study` (suffix `study.name` with the candidate id, force `storage.type="memory"`);
  set `objective`. Merge `candidate.fixed_params` so unbounded params hold their defaults
  (put them where the runner applies constant strategy params — confirm against how
  `OptimizationRunner._build_backtest_config` passes `strategy_params`; if the cleanest
  insertion point is "seed every trial's strategy_params with fixed_params", do that in the
  config assembly, not by editing `OptimizationRunner`).
- Run `WalkForwardRunner(opt_cfg, config.walkforward, backtest_runner).run(...)`.
- Derive `objective_value = resolve_objective(result.oos_metrics, mode)` (guard empty
  `oos_metrics` → `no_result`). Compute `robustness_score` = objective value **oriented so
  higher is always better** (negate for `MINIMIZE_DRAWDOWN`). Apply `GateConfig` to produce
  `gate_flags` / `passed_gates`. Carry `result.efficiency`, the stitched
  `result.oos_equity_curve`, the best window's `best_params`, window counts.
- **Never raise for an expected failure.** A candidate whose walk-forward errors, finds no
  valid window, or yields zero OOS trades → `status` `"error"`/`"no_result"` with a message,
  not an exception that aborts the search.

### 3. `StrategySearchRunner`

```python
class StrategySearchRunner:
    def __init__(self, config: StrategySearchConfig, backtest_runner: BacktestRunner): ...
    def run(self, progress_callback=None, should_stop=None) -> StrategySearchResult: ...
```

- Resolve the provider (`RegistryCandidateProvider` for this batch, honoring
  `config.strategies` and skipping tick strategies → an `unsupported` `CandidateResult`).
- For each candidate: check `should_stop` (cooperative cancel between candidates), fire
  `progress_callback` (see SearchProgress below), call `evaluate_candidate`, collect.
- After the loop (or on a single-generation provider): call `provider.report(results)`
  (no-op for the registry provider — this is the genetic hook).
- **Rank:** passing candidates (`passed_gates and objective_value is not None`) sorted by
  `robustness_score` desc, assigned `rank` 1..k. Gated/`no_result`/`error`/`unsupported`
  candidates keep `rank=None` and are appended **after** the ranked block (stable order:
  gated-by-flag before no_result before error before unsupported, or document your order).
  `best` = rank-1 candidate or `None`.

**Progress:**

```python
@dataclass
class SearchProgress:
    current_candidate: int          # 1-based
    total_candidates: int
    candidate_id: str
    strategy: str
    phase: Literal["optimizing", "testing", "done"]   # mirror WalkForwardProgress phases
    window_index: int | None        # forwarded from the inner walk-forward callback
    total_windows: int | None
```

Wire the inner `WalkForwardRunner`'s `progress_callback` through so the UI can show
"candidate 3/9 — RSIMeanReversion — window 2/4 testing". WO32 forwards this to Redis.

### 4. Guardrails

> **One data load per search.** You do **not** fetch market data — WO32 injects a
> `from_market_data_sliced` runner and every candidate's `WalkForwardRunner` slices the same
> in-memory frame. A test must assert `get_ohlcv` is called **once** across a multi-candidate
> search (call-count spy on a fake market-data service feeding `from_market_data_sliced`).

> **Single-objective only.** Reject `MULTI_OBJECTIVE_RETURN_DRAWDOWN` at config validation
> with a clear `ValueError` (ranking needs a scalar). Tick-engine candidates are skipped as
> `unsupported`, not errors — the sweep over a mixed registry must still complete.

> **Don't fork the runners.** Reuse `WalkForwardRunner` and `OptimizationRunner` unchanged.
> If you find yourself editing them, stop and reconsider — the only sanctioned change in this
> batch is additive config assembly in `strategy_search.py`.

### 5. Tests — `tests/.../test_strategy_search.py`

- `RegistryCandidateProvider` yields one candidate per registered **candle** strategy and
  skips tick strategies; respects an explicit `strategies=[...]` subset.
- **End-to-end over synthetic data** (fake market-data service → `from_market_data_sliced`,
  2–3 strategies, 2 windows, 2 trials each): produces a `StrategySearchResult` whose ranking
  is by **OOS** `robustness_score` (assert order; construct strategies so the expected winner
  is deterministic).
- **One `get_ohlcv` call** across the whole search (call-count spy). This is the load-once
  guarantee.
- A candidate engineered to fail (e.g. a strategy that yields zero OOS trades, or a forced
  exception inside one candidate) is recorded `error`/`no_result` and ranked below passing
  ones — **the search still completes**.
- Gating: a candidate that completes but trips a gate (too few windows / low efficiency) is
  `passed_gates=False`, sorted after passing candidates, with the right `gate_flags`.
- `should_stop` returning True after candidate 1 stops the sweep cleanly.
- Multi-objective config → `ValueError` at construction.
- Existing optimization **and** walk-forward tests green and unmodified.

### 6. Docs

`q_backend/README.md`: a "Strategy search" subsection under backtesting — the concept
(sweep → optimize → walk-forward → leaderboard), walk-forward gating, and one line that the
`CandidateProvider` seam is what future genetic search will plug into.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `WalkForwardRunner` / `OptimizationRunner` unchanged; existing tests untouched and green.
- In your final message, paste the field lists of `StrategySearchConfig`, `GateConfig`,
  `SearchCandidate`, `CandidateResult`, `StrategySearchResult`, and `SearchProgress` —
  **WO32 serializes them to the API and WO33 renders them.** Note exactly where
  `fixed_params` is injected into the per-candidate `OptimizationConfig`.

## Out of scope

- API routes, Redis progress, Postgres, lake writes (all WO32).
- Genetic / synthesized candidates (WO34 design; this WO only ships
  `RegistryCandidateProvider` + the protocol the genetic provider will implement).
- Tick-engine search; multi-objective ranking; deflated-Sharpe / multiple-testing correction
  (WO34 design — note that with N candidates the naive best is optimistic, but don't
  implement the correction here).
- Parallelizing candidates (sequential is fine; each candidate's trials already parallelize
  inside the engine).
