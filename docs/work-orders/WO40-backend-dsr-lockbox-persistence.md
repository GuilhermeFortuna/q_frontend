# WO40 — Backend: overfitting defense (DSR + lock-box) + persistence + API

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
  - Server: `uv run uvicorn q_backend.api.main:app --reload --port 8000`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "Generative Discovery". WO38 = genome DSL + interpreter;
WO39 = `GeneticCandidateProvider` + `GeneticStrategySearchOrchestrator`. **This WO is the
overfitting defense and the wiring** — the part that makes evolving thousands of genomes a
_research instrument_ instead of a data-mining trap. It adds: a **Deflated Sharpe Ratio**
finalize step (multiple-testing correction over all genomes tried), a **held-out lock-box**
segment evaluated once on the champion, the **additive** Postgres/lake persistence, and the
**API payload extensions** wiring genetic runs into the existing strategy-search job. Design:
**`docs/design/genetic-strategy-search.md` §5 and §6** (read them).

**Why DSR + lock-box are mandatory, not optional.** Registry AutoML over ~10 strategies
tolerates a naive "best OOS". Evolving `population × generations` genomes does not — the top
genome is selected from so many candidates that some look great by pure luck. DSR adjusts the
champion's Sharpe for the **effective number of trials**; the lock-box is a final untouched
holdout the champion never trained or validated on. This WO ships both as the run's verdict.

---

## How the pieces you're composing work today (read these files)

- `src/q_backend/optimization/strategy_search.py` (WO31) + WO39's orchestrator — the genetic
  run yields a `StrategySearchResult` plus per-generation results. **Add the finalize step to
  `GeneticStrategySearchOrchestrator`, post-rank/post-gates** (design §5.1) — do **not** touch
  `evaluate_candidate`.
- `src/q_backend/optimization/walkforward.py` — `WalkForwardConfig` and the window splitter.
  The lock-box must be carved off **before** any WF window (design §5.2): WF windows tile only
  the train/test region; the lock-box tail is never seen during evolution.
- `src/q_backend/optimization/backtest_runner.py` — `DefaultBacktestRunner.from_market_data_sliced`.
  The lock-box one-shot champion backtest reuses the **already-loaded** frame (slice the tail);
  do not refetch.
- `src/q_backend/api/routes/` strategy-search route + `optimization_jobs` / strategy-search job
  module (WO32) — the Redis-backed job that runs `StrategySearchRunner`, forwards `SearchProgress`,
  and persists to Postgres/lake. Wire genetic via WO39's `select_search_orchestrator` switch.
- `src/q_backend/storage/db/` models + `repositories.py` + Alembic — `strategy_search_runs`,
  `strategy_search_candidates`, `result_summary` JSON. Additions here are **additive nullable
  columns + JSON keys only** (design §6.1); a schemaless `config`/`result_summary` JSON column
  needs **no migration**.
- The Parquet lake module (WO22) — `strategy_search/{run_id}/...` artifact layout.

---

## Goal

A genetic strategy-search run, driven through the **existing** strategy-search API + job, that:
carves a lock-box, evolves G generations (WO39), computes the champion's DSR over the effective
trial count, runs one lock-box backtest of the champion, and persists everything additively —
so WO41 can render generation-by-generation leaderboards, the genome, the DSR, and the lock-box
verdict. Registry-sweep requests (no `genetic`, no `lockbox`) behave **byte-identically to today**.

## Tasks

### 1. `LockboxConfig` (design §5.2) — additive on `StrategySearchConfig`

```python
class LockboxConfig(BaseModel):
    enabled: bool = False                 # default off → registry sweep unchanged
    lockbox_pct: float | None = 0.15      # tail fraction reserved (xor lockbox_days)
    lockbox_days: int | None = None
    min_trades: int = 5                   # lock-box gate
    max_drawdown_pct: float | None = None # optional lock-box gate
```

Add `lockbox: LockboxConfig = LockboxConfig()` to `StrategySearchConfig` (additive). When
`enabled`, the splitter reserves the **final** `lockbox_pct`/`lockbox_days` of the date range
**before** WF windows are carved; the orchestrator's WF region excludes it.

### 2. Lock-box evaluation (design §5.2) — in `GeneticStrategySearchOrchestrator.finalize()`

After the last generation, ranked & gated:

- Take the champion's `best_params` (no re-optimization).
- Run **one** backtest of the champion `CompositeStrategy` over the **lock-box slice** of the
  already-loaded frame.
- Persist `lockbox_metrics` (full metrics dict) and `lockbox_passed` (min trades, optional max
  drawdown). Lock-box failure **flags the run** (`lockbox_passed=False`) but does not error.

### 3. Deflated Sharpe Ratio (design §5.1) — finalize step, post-rank

```text
DSR = Φ( (SR_observed − E[max SR]) / σ[SR] )
E[max SR] grows with the effective number of independent trials
         ≈ total_genomes_evaluated  (conservative upper bound)
```

- `SR_observed` = champion's **OOS** Sharpe (from `oos_metrics`; if the active objective ≠
  Sharpe, compute DSR on OOS Sharpe **alongside** the primary objective).
- Implement the Bailey–López de Prado estimator (Φ = standard normal CDF; σ[SR] from the OOS
  return series' skew/kurtosis per the standard formula). Store `dsr`, `n_trials_effective`,
  `sr_observed` on the run summary and the champion candidate row.
- **Plug-in point:** `finalize()` only — **do not** alter per-candidate `evaluate_candidate`
  (keeps WO38/WO39 pure). Optionally store per-candidate `dsr` for top-k, but it is champion-focused.

### 4. Persistence — **additive** (design §6.1)

**`strategy_search_runs.config`** JSON: already carries `genetic` + `lockbox` (no migration if
JSON). Add `provider: "registry" | "genetic"` (derived) for filtering.

**`result_summary`** JSON: add `generations_completed`, `total_genomes_evaluated`,
`champion_dsr`, `n_trials_effective`, `sr_observed`, `lockbox_metrics`, `lockbox_passed`.

**`strategy_search_candidates`** — add **nullable** columns:

| Column               | Type  | Notes                                          |
| -------------------- | ----- | ---------------------------------------------- |
| `generation`         | int   | 0-based; null for registry sweep               |
| `genome`             | JSON  | full genome document (null for registry sweep) |
| `genome_node_count`  | int   | leaderboard sort/display                       |
| `dsr`                | float | nullable; champion-focused                     |
| `complexity_penalty` | float | nullable                                       |

Unique constraint stays `(run_id, candidate_id)` (= `genome_id`, unique per run). Alembic
migration **only** if these are real columns (not JSON keys) — additive, no backfill needed
(pre-WO40 rows leave them null).

**Lake** under `strategy_search/{run_id}/`: `generations/{g}/leaderboard.parquet` (or a
`generation` column on the existing leaderboard), `candidates/{candidate_id}/genome.json`,
`lockbox/` (champion metrics + equity curve). Existing equity artifact paths **unchanged**.

### 5. Job + API wiring (design §6.2) — additive

- The strategy-search job calls WO39's `select_search_orchestrator(config)`: `genetic` set →
  `GeneticStrategySearchOrchestrator`, else `StrategySearchRunner` (frozen path).
- **Request body:** `StrategySearchConfig` already accepts optional `genetic` + `lockbox`
  blocks (Pydantic additive). Registry requests omit them → identical behavior.
- **Status payload:** add optional `generation`, `total_generations` (forward WO39's
  `SearchProgress` fields through Redis).
- **Results payload:** candidates include `generation`, `genome`, `genome_node_count`;
  summary includes `champion_dsr`, `n_trials_effective`, `sr_observed`, `lockbox_metrics`,
  `lockbox_passed`, `generations_completed`, `total_genomes_evaluated`.
- **New optional** `GET /api/v1/strategy-search/{run_id}/candidates/{id}/genome` for when the
  genome is too large to inline (otherwise inline it in the results list).

## Guardrails

> **Registry sweep is byte-identical.** With `genetic` omitted and `lockbox.enabled=False`, a
> strategy-search run, its persistence, and its API payloads must match today exactly. Prove it
> with a pre-existing strategy-search test run both ways.

> **No leakage into the lock-box.** Every WF window's test range falls **strictly inside** the
> train/test region; the lock-box tail is evaluated **once**, after evolution, with no
> re-optimization. A date-assertion test proves windows never overlap the lock-box.

> **DSR is post-rank, evaluate is pure.** Compute DSR/lock-box in `finalize()` only. Do not
> edit `evaluate_candidate`, `WalkForwardRunner`, or `OptimizationRunner`.

> **Best-effort persistence, both ways.** A genetic run **completes with Postgres stopped**
> (summary/candidates simply not written) **and with the lake unwritable** (genome/leaderboard
> artifacts skipped); the HTTP result still returns. Series/trades/genomes-as-series stay out
> of Postgres — genome JSON is summary metadata (allowed), per-candidate equity curves go to the
> lake (WO22 pattern).

> **One data load.** The lock-box backtest slices the same in-memory frame the WF windows used —
> never a refetch. Keep the WO31/WO39 one-`get_ohlcv`-per-run guarantee intact.

## Tests — `tests/.../test_genetic_persistence.py`, `test_dsr.py`, `test_lockbox.py`

- **Backward compat:** a registry-sweep run (no `genetic`/`lockbox`) produces byte-identical
  result + persisted rows vs. pre-WO40 (snapshot the payload + summary).
- **Lock-box split:** with `lockbox.enabled`, assert every WF test-window timestamp is `<` the
  lock-box start; the champion lock-box backtest runs exactly once over the tail; `lockbox_passed`
  reflects the min-trades/max-dd gates.
- **DSR monotonicity:** holding `sr_observed` fixed, increasing `total_genomes_evaluated`
  **decreases** DSR (the multiple-testing penalty bites). DSR on a known toy series matches a
  hand-computed Bailey–López de Prado value within tolerance.
- **Additive persistence:** genetic run writes `generation`/`genome`/`genome_node_count`/`dsr`
  on candidate rows and DSR/lock-box keys on `result_summary`; the `(run_id, candidate_id)`
  unique constraint holds across generations (genome_ids unique).
- **Resilience:** genetic run **completes with Postgres stopped** and **with the lake
  unwritable** (best-effort both ways); status forwards `generation`/`total_generations`.
- **Genome endpoint:** `GET .../candidates/{id}/genome` returns the stored genome; 404 for an
  unknown id and for registry-sweep candidates (no genome).
- Existing strategy-search / walk-forward / optimization tests green and **unmodified**.

## Docs

`q_backend/README.md`: under strategy search, an "Overfitting defense" note — DSR over the
effective trial count, the held-out lock-box, the parsimony penalty (WO39) — framed as
"screening, not proof" (design §5.4 copy). Link the design doc.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Registry-sweep path byte-identical; existing tests untouched and green.
- In your final message, **paste the full JSON contracts** WO41 builds against: the genetic
  `StrategySearchConfig` request body (with `genetic` + `lockbox`), the status payload (with
  `generation`/`total_generations`), the results payload (candidate `generation`/`genome`/
  `genome_node_count`; summary `champion_dsr`/`n_trials_effective`/`sr_observed`/
  `lockbox_metrics`/`lockbox_passed`/`generations_completed`/`total_genomes_evaluated`), and the
  `GET .../candidates/{id}/genome` response.

## Out of scope

- All frontend (WO41).
- The evolution engine itself, genome DSL (WO38/WO39 — done).
- Tick-engine genetic search; multi-objective; per-candidate DSR as a hard gate (champion-only
  this batch); White's Reality Check / SPA (DSR is the v1 correction — note as a v2 follow-up).
