# WO52 — Backend: graded genetic fitness (remove the `-inf` cliff)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "GA Discovery quality". A diagnosis of the Discovery run
history (`strategy_search_runs` / `strategy_search_candidates`) showed the genetic search is
**effectively running as random search**. Evidence from real `*_discover_*` runs:

- Only **132 / 1,152** evaluated genomes ever passed the OOS gates (~11%); in the most recent
  CCM\$ runs, **0 / 144** passed.
- Per generation, `max(robustness_score)` and `avg(objective_value)` show **no upward trend** —
  the signature of no selection pressure.

**Root cause this WO fixes:** `candidate_fitness()` in
`src/q_backend/optimization/genetic_search.py` returns `float("-inf")` for **any** genome that
is not `completed` or fails the gates or has no `robustness_score`. When the whole population is
`-inf`, `_tournament_select` is choosing among equals (random), and the `reproducers` fallback
(`genetic_search.py` ~L181) breeds from the **entire unranked population**. The fitness
landscape is a flat plateau with no gradient to climb. This WO replaces the binary fitness with
a **graded** fitness so the GA always has a gradient — even when no genome yet passes the gates.

This WO is **fitness/selection only**. Trade-viability of the generated genomes is WO53;
parallelism is WO54; operators are WO55. Design: `docs/design/genetic-strategy-search.md` §4.2,
§5.3 (read them).

---

## How the pieces work today (read these files)

- `src/q_backend/optimization/genetic_search.py`
  - `candidate_fitness(result, genome, genetic)` — returns `-inf` unless
    `status=="completed"` **and** `passed_gates` **and** `robustness_score is not None`;
    otherwise `robustness_score − (λ·node_count + μ·param_count)`.
  - `GeneticCandidateProvider.report(results)` — scores every result with `candidate_fitness`,
    tracks `_champion`/`_best_fitness`, builds `reproducers` (everything with `fitness > -inf`),
    falls back to the **whole population** when none qualify, then elitism + tournament.
- `src/q_backend/optimization/strategy_search.py`
  - `CandidateResult`: `status` (`completed`/`no_result`/`unsupported`/`error`),
    `robustness_score`, `objective_value`, `efficiency`, `gate_flags`, `passed_gates`,
    `completed_windows`, `window_count`, `oos_metrics`.
  - `GateConfig`: `min_completed_windows=2`, `min_oos_trades=10`, `efficiency_low=0.3`,
    `efficiency_high=1.5`. `_apply_gates(...)` returns `(flags, passed)`.
  - `_robustness_score(objective_value, mode)`, `_rank_results(...)` (final leaderboard, unchanged).
- `GeneticSearchConfig` (in `strategy_search.py`) — `complexity_lambda`, `complexity_mu`, etc.

The dominant gate-failure flags in history were `suspicious_efficiency` (478),
`few_oos_trades` (254), `low_efficiency` (226) — i.e. failures are **graded by how far off**
they are, which the current cliff throws away.

---

## Goal

```python
fitness = candidate_fitness(result, genome, genetic)
#   completed + passed gates  -> robustness_score − complexity_penalty            (unchanged, top band)
#   completed + failed gates  -> robustness_score − complexity_penalty − Σ gate_penalty   (a real, finite gradient)
#   no_result / zero trades   -> a finite floor shaped by partial progress (completed_windows, activity)
#   error / unsupported       -> the global minimum (still finite, still ordered)
```

Every genome gets a **finite, ordered** fitness, so tournament selection always has a gradient,
even in a generation where nothing passes the gates. The **reported champion / leaderboard rules
are unchanged** — `passed_gates` still decides what counts as a publishable strategy; only the
_selection signal that drives evolution_ becomes graded.

## Tasks

### 1. Fitness shaping config (additive to `GeneticSearchConfig`)

```python
# selection-signal shaping (does NOT change gates or the reported leaderboard)
gate_penalty_efficiency: float = 0.5     # per suspicious_efficiency / low_efficiency flag
gate_penalty_trades: float = 0.5         # scaled by trade shortfall (see task 3)
gate_penalty_windows: float = 0.5        # scaled by missing completed windows
no_result_floor: float = -2.0            # finite floor for no_result/zero-trade genomes
error_floor: float = -4.0                # finite floor for error/unsupported
```

All additive with defaults; `genetic is None` (registry sweep) path is untouched.

### 2. Graded `candidate_fitness`

Rewrite so the return is **always finite**:

1. `status in {"error","unsupported"}` → `error_floor`.
2. `status == "no_result"` (or `completed` with zero OOS trades) → `no_result_floor` **plus** a
   small progress bonus proportional to `completed_windows / max(window_count,1)` so a genome
   that ran 4/5 windows ranks above one that produced nothing. Never exceeds the failed-gates band.
3. `completed`:
   - base = `robustness_score − complexity_penalty` (today's formula).
   - subtract a **soft gate penalty** = Σ of per-flag penalties (task 3) when `passed_gates` is
     False. When `passed_gates` is True, penalty is 0 (top band, unchanged behavior).

Bands must not overlap pathologically: a passing genome with mediocre robustness should still
rank above the best failing genome **only when its robustness justifies it** — do **not** add an
artificial constant gap; let robustness + penalties order them. (A failing genome that is
genuinely close to viable _should_ be allowed to out-rank a barely-passing dud for **breeding**;
the champion rule in task 4 keeps the _reported_ best honest.)

### 3. Soft gate penalty (graded by distance, not binary)

Map `gate_flags` + metrics to a continuous penalty:

- `few_oos_trades`: `gate_penalty_trades · clamp((min_oos_trades − oos_trades) / min_oos_trades, 0, 1)`.
- `few_windows`: `gate_penalty_windows · (missing_windows / min_completed_windows)`.
- `low_efficiency` / `suspicious_efficiency`: `gate_penalty_efficiency · |log(efficiency / target_band)|`
  capped (target band centered in `[efficiency_low, efficiency_high]`). Use a bounded transform so
  one wild efficiency value can't dominate.

Read the raw numbers off `result.oos_metrics` / `result.efficiency` / `completed_windows`; do
**not** re-run anything.

### 4. Champion + reproducers

- **Champion** (`_champion` / `champion()`): only update from genomes that are `completed` **and**
  `passed_gates` — the reported best must remain a genome that actually passed. If none have ever
  passed, `champion()` returns `None` (unchanged contract). Track `_best_fitness` for breeding
  separately from the publishable champion.
- **Reproducers:** with graded fitness there is always a usable gradient, so drop the degenerate
  "all `-inf` → breed from the whole unranked population" branch; sort by graded fitness and
  select normally. Keep elitism selecting the top graded-fitness genomes.

### 5. Carry the graded fitness into metadata

Add the per-candidate graded `fitness` (and the soft-penalty breakdown) to
`GeneticStrategySearchOrchestrator._candidate_metadata[...]` so WO40's persistence and the
Discovery UI can show _why_ a genome did or didn't reproduce. Additive only.

## Guardrails

> **Gates and `evaluate_candidate` are read-only.** This WO changes only the **selection signal**
> in `genetic_search.py`. `_apply_gates`, `_robustness_score`, `evaluate_candidate`,
> `WalkForwardRunner` are untouched. The reported leaderboard (`_rank_results`) and `passed_gates`
> semantics are unchanged.

> **Champion stays honest.** Evolution may breed from near-viable failing genomes, but the
> reported champion is still only ever a gate-passing genome (or `None`).

> **Determinism.** Same `init_seed` → identical population trajectory. Fitness is a pure function
> of an already-computed `CandidateResult`; introduce no new randomness.

> **No artificial cliffs.** Every branch returns a finite float. Grep the final
> `candidate_fitness` for `inf` — there must be none.

## Tests — `tests/optimization/test_genetic_fitness.py`

- **Gradient without passers:** on a synthetic generation where **no** genome passes gates,
  `candidate_fitness` returns distinct finite values, and a genome with 8/10 trades ranks above
  one with 1/10 trades, which ranks above a `no_result`, which ranks above an `error`.
- **Top band preserved:** a passing genome with robustness R and a failing genome are ordered by
  the documented rule; two passing genomes still order by `robustness − complexity_penalty`
  (existing behavior unchanged).
- **Champion honesty:** champion is `None` when nothing passes; becomes the passing genome once
  one appears, even if a failing genome has higher graded fitness.
- **Selection pressure (regression for the bug):** over N seeded generations on a synthetic
  objective where viability is reachable by mutation, mean graded fitness is **non-decreasing**
  and strictly increases at least once — proving the GA now climbs (contrast: assert the old
  cliff would have produced a flat trajectory).
- **Determinism:** two runs, same seed → identical fitness sequences and population IDs.
- Existing genetic-search / strategy-search / walk-forward tests green and **unmodified**.

## Docs

`q_backend/README.md` genetic-synthesis section: add a "graded selection" note — selection uses a
continuous fitness (robustness minus complexity minus _soft_ gate penalties, with finite floors
for no-result/error) so the GA has a gradient before any genome clears the gates; gates still
decide the published leaderboard.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- `candidate_fitness` returns no `-inf`/`inf`; champion/leaderboard semantics unchanged.
- In your final message paste: the new **`candidate_fitness` body**, the **added
  `GeneticSearchConfig` fields**, and the **graded-fitness metadata key** added to
  `_candidate_metadata` (WO53/WO54 build on these).

## Out of scope

- Making genomes actually trade (generation/repair/viability) — **WO53**.
- Parallel evaluation / budget defaults — **WO54**.
- Crossover/mutation operators, diversity — **WO55** / WO46.
- Any gate threshold changes, API, DB columns, or UI.
