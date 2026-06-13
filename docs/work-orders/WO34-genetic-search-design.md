# WO34 — Design: genetic strategy synthesis (option 2) — paper, not code

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** the "Discovery" batch (WO30–WO33) shipped automatic strategy
search as an **AutoML sweep**: evaluate a fixed set of registered strategies and rank them on
walk-forward out-of-sample performance. This document designs the next step — **genetic
strategy synthesis**, where the system _invents_ new strategies by composing indicator/rule
primitives and evolving them. **This WO produces a design document only; it ships no code.**
Its job is to (a) confirm the WO31 candidate seam is sufficient, and (b) hand the eventual
implementation batch a concrete plan.

The deliverable is `docs/design/genetic-strategy-search.md` (create the `docs/design/` dir if
absent) plus this WO's completion message summarizing the verdict.

**Prerequisites shipped:** WO31 (`optimization/strategy_search.py` — the
`CandidateProvider` protocol + `evaluate_candidate` evaluator + `StrategySearchRunner`).

---

## What already exists that this must reuse (read these files)

- `src/q_backend/optimization/strategy_search.py` (WO31) — the seam:
  - `CandidateProvider` protocol: `candidates() -> Iterable[SearchCandidate]` and
    `report(results: list[CandidateResult]) -> None`.
  - `SearchCandidate(candidate_id, strategy, search_space, fixed_params)`.
  - `evaluate_candidate(...)` — the shared walk-forward-gated evaluator.
  - `StrategySearchRunner` — drives provider → evaluate → rank.
- `src/q_backend/backtesting/strategy.py` — `TradingStrategy` interface (the candle contract
  a synthesized strategy must satisfy). `src/q_backend/backtesting/strategy_registry.py` —
  `register_strategy` and `StrategyParamSpec`.
- `tests/.../test_strategy_causality.py` — the **causality test that auto-applies on
  registration** (closed-bar / next-bar-open, no look-ahead). Any synthesized strategy must
  pass it. This is the central correctness constraint of the whole design.
- The existing strategies (`backtesting/strategies/*.py`) — the vocabulary of indicators and
  entry/exit rules the DSL should be able to express (MA cross, RSI band, Bollinger, Donchian
  breakout, MACD, TRB/FMA, TSMOM). Mine these for the primitive set.

---

## The design document must cover

### 1. Verdict on the seam (do this first)

State plainly whether `CandidateProvider` + `evaluate_candidate` + `StrategySearchRunner`
(WO31) are sufficient for genetic search, and exactly what (if anything) must change. The
intended answer is: **option 2 = a new `GeneticCandidateProvider` + a `CompositeStrategy`
interpreter, and nothing in the evaluator/runner/job/UI changes.** If you find a required
change to WO31's core, call it out specifically with the minimal additive shape — but the
design should bend toward keeping the core untouched.

### 2. Rule DSL — the genome

Define the representation a genome encodes and how it serializes (JSON, since it flows through
the same config/lake plumbing). Cover:

- **Primitive set:** indicators (with parameter ranges), comparison/logic operators, the
  signal shape (entry long/short, exit). Keep it expressive enough to rediscover the existing
  registry strategies as special cases (a good sanity bar) but bounded enough to stay
  causal and finite.
- **Typing / closure:** how the DSL guarantees a generated tree is _valid and causal by
  construction_ (operates only on closed bars, no future reference) so it passes
  `test_strategy_causality.py` without per-candidate luck. Prefer a typed grammar that can't
  express look-ahead over a generate-then-reject loop.
- **Parameterization:** which numeric knobs become the candidate's `search_space` (so each
  genome is still _optimized_ per window by the existing Optuna path) vs. which are fixed
  structure. This is the elegant part: structure evolves, parameters optimize — the genome
  maps to a `SearchCandidate(search_space=..., fixed_params=...)`.

### 3. `CompositeStrategy` interpreter

A single `TradingStrategy` subclass that takes a genome + params and executes it on candle
data, honoring the closed-bar/next-bar-open contract. Specify how it registers (one
registry entry, or dynamic per-genome registration with synthesized names like `gen3-ind7`),
and how it satisfies the causality test. Note the performance posture (genomes are evaluated
thousands of times — vectorized/Numpy indicator eval, cache indicators across trials).

### 4. `GeneticCandidateProvider`

Implements `CandidateProvider`:

- `candidates()` yields the current generation as `SearchCandidate`s (each genome → a
  `CompositeStrategy` config + its derived search space).
- `report(results)` consumes the generation's `CandidateResult`s (walk-forward OOS scores,
  already gated) and produces the next generation: **selection** (on `robustness_score`, the
  OOS metric — never in-sample), **crossover**, **mutation**, elitism. Specify population
  size, generation count, and how `StrategySearchRunner` must loop generations (does the
  runner need a "multi-generation" mode, or does the provider drive the loop internally and
  expose each generation through repeated `candidates()` calls? — recommend the option that
  needs the least WO31 change; document it).

### 5. Overfitting defense at scale (the non-negotiable section)

AutoML over ~10 strategies tolerates a naive "best". Evolving thousands of genomes does
**not** — the best OOS score across thousands of trials is optimistic by selection. Specify:

- **Deflated Sharpe Ratio / multiple-testing correction** (Bailey & López de Prado): adjust
  the winner's significance for the number of candidates effectively tried; where it plugs in
  (a post-rank step in the evaluator or the provider's `report`).
- A **held-out final test segment** never seen by any generation's walk-forward (a true lock
  box) to validate the evolved champion once at the end.
- Complexity penalties (parsimony pressure in fitness) to resist baroque overfit genomes.
- What to surface in the UI so a user reads an evolved strategy with appropriate suspicion.

### 6. Persistence, API, and UI deltas

- What the WO32 tables/lake need (genome JSON per candidate, generation index) — additive
  columns only; confirm `strategy_search_*` tables extend cleanly.
- Whether the WO33 Discovery workspace renders generations as-is (it should: a generation is
  just a leaderboard) plus the minimal additions (generation selector, genome viewer,
  lock-box result).

### 7. Implementation batch outline

Propose the WO breakdown for the eventual build (e.g. WO_a DSL + interpreter + causality
proof; WO_b `GeneticCandidateProvider` + generational loop; WO_c deflated-Sharpe + lock box;
WO_d UI genome viewer + generation navigation), with dependencies and a one-line scope each.
Do not write those WOs — just outline them.

---

## Definition of done

- `docs/design/genetic-strategy-search.md` exists and covers sections 1–7.
- In your completion message: the **seam verdict** (one paragraph — is WO31 sufficient, and
  the single smallest change if not), the **DSL sketch** (the primitive set + one example
  genome JSON that reproduces an existing registry strategy), and the **proposed WO outline**.

## Out of scope

- Any code (this is a design doc). No new module, no test, no migration.
- Reinforcement-learning / neural strategy generation (a different research direction — name
  it as an alternative in one line, don't design it).
- Multi-asset / cross-sectional genomes (single-instrument candle only, matching the rest of
  Discovery).
