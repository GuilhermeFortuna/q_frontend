# WO55 — Backend: stronger genetic operators (subtree crossover + adaptive rates)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
  - Tests: `uv run pytest`
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.

**Context for this work:** batch "GA Discovery quality". With graded fitness (WO52) and
trade-viable genomes (WO53) the GA finally has a gradient to climb and a healthy population — but
its **variation operators are too weak to exploit them**, so it converges slowly and to thin
regions of the search space. Two concrete weaknesses in
`src/q_backend/backtesting/genome/operators.py`:

1. **`crossover_genomes` is not real recombination.** It picks one node in parent A and overwrites
   that **single node's** `kind` + `params` with a compatible node from parent B. No sub-DAG is
   exchanged, so building blocks (a whole indicator→comparison→logic chain) never transfer between
   parents. Recombination is the main engine of GP search and it's effectively disabled.
2. **Fixed rates / uniform operator choice.** `mutation_rate=0.15`, `crossover_rate=0.7` are
   constant, and `mutate_genome` chooses uniformly (1/6) among its six ops regardless of whether
   the population is stagnating or which ops have been productive.

This WO upgrades **variation diversity** (how children are made). **Selection diversity** (a
low-correlation _book_ via OOS-return decorrelation) and feature seeding are **WO46's** job — this
WO must compose with it, not duplicate it (see guardrail). Design:
`docs/design/genetic-strategy-search.md` §4.2.

---

## How the pieces work today (read these files)

- `src/q_backend/backtesting/genome/operators.py`
  - `crossover_genomes(rng, parent_a, parent_b, max_nodes, max_depth)` — single-node kind/param
    swap at a compatible cut (matches `_primary_output_type` + min/max inputs), then
    `_validate_or_raise`.
  - `mutate_genome` — uniform choice over `rewire / swap_indicator / nudge_param / swap_exit /
add_node / remove_node`; each clones, edits, `_validate_or_raise`.
  - `draw_valid_child` / `_draw_valid` — redraw-on-invalid (64 attempts).
- `src/q_backend/backtesting/genome/schema.py` — `Genome`, `GenomeNode` (`id`, `kind`, `params`,
  `inputs`), `NodeRef`. Inputs reference producer node ids (with optional `:port`).
- `src/q_backend/backtesting/genome/node_specs.py` — `NODE_SPECS`, `port_output_type`,
  output-type tags + `min_inputs`/`max_inputs` (the compatibility contract for splicing).
- `src/q_backend/backtesting/genome/validate.py` — `validate_genome` (DAG validity, depth/node
  caps, acyclicity, reachability) — the safety net every operator must satisfy.
- `src/q_backend/optimization/genetic_search.py` — `GeneticCandidateProvider._vary(parent_a,
parent_b)` (applies crossover then mutation at the configured rates), `report` (the generational
  step where stagnation can be measured), `GeneticSearchConfig` (rates live here).

---

## Goal

```python
child = crossover_genomes(rng, a, b, ...)   # exchanges a whole compatible SUB-DAG, not one node
# and, across generations:
#   mutation_rate rises when the population stagnates / loses diversity, falls when it improves;
#   mutation operator weights adapt toward ops that have produced fitness gains.
```

Faster, broader exploration that preserves DAG validity and determinism, composing cleanly with
WO46's correlation-aware selection.

## Tasks

### 1. Real subtree crossover

Rewrite `crossover_genomes` to exchange a **sub-DAG**:

- Choose a cut node in parent A (an `ind.*`/`cmp.*`/`logic.*` producing a given output type).
- Find a node in parent B with the **same output type** (and a compatible interface) as the root
  of a transplantable sub-DAG.
- **Copy B's sub-DAG** (the cut node and its transitive input producers) into A, **re-id** the
  imported nodes to avoid collisions, rewire A's consumer edge(s) to the imported root, and drop
  any nodes in A orphaned by the swap.
- `validate_genome` (depth/node caps, acyclicity, reachability, type-correct ports); **redraw on
  invalid** via `draw_valid_child`. Respect `max_nodes`/`max_depth` — if the splice would exceed
  caps, prune the imported sub-DAG or redraw.
- Keep the **single-node swap as a fallback** when no compatible sub-DAG exists.

### 2. Diversity / stagnation signal

Add a cheap population-diversity / stagnation measure used by `report` to drive adaptation —
**structural** (e.g. distribution of node-kind multisets / genome fingerprints) so it does **not**
require extra backtests and does **not** collide with WO46's **return-correlation** measure. Track
a stagnation counter (generations since `_best_fitness` improved).

### 3. Adaptive rates

In `GeneticCandidateProvider`, make `mutation_rate` (and optionally `crossover_rate`) adapt within
configured bounds: raise mutation when stagnation/low-diversity is detected, decay it back toward
the base when fitness is improving. Pure function of the seeded RNG + observed history → still
deterministic.

### 4. Operator-weight adaptation (lightweight)

Replace `mutate_genome`'s uniform 1/6 with **RNG-weighted** selection where weights nudge toward
operators that have recently produced improved children (credit assignment: tag each child with
the op that made it; update weights in `report` from realized fitness deltas). Keep it simple and
bounded; default weights reproduce current behavior when no history exists.

### 5. Config (additive to `GeneticSearchConfig`)

```python
mutation_rate_min: float = 0.10
mutation_rate_max: float = 0.50
stagnation_patience: int = 2          # generations w/o improvement before raising mutation
adaptive_operator_weights: bool = True
```

Defaults must reproduce a sensible baseline; setting `adaptive_operator_weights=False` and equal
min/max recovers fixed-rate behavior for A/B comparison.

## Guardrails

> **Validity is invariant.** Every child from crossover/mutation passes `validate_genome` (caps,
> acyclicity, reachability, port types). Invalid children are **redrawn, never emitted** — reuse
> `draw_valid_child`. Property-test this over seeded random parents.

> **Determinism.** All choices (cut points, sub-DAG selection, re-ids, adaptive rates, operator
> weights) flow through the seeded RNG. Same `init_seed` → identical population trajectory.

> **Don't duplicate WO46.** WO46 owns **selection** diversity (OOS-return decorrelation → a
> low-correlation book) and feature-seeding. This WO owns **variation** diversity (how children are
> bred). The diversity signal here is **structural**, computed without backtests. Coordinate the
> seam so both can be enabled together; if WO46 has landed, wire against its provider hooks rather
> than forking `report`.

> **Caps respected.** Subtree splice never exceeds `max_nodes`/`max_depth`; prune or redraw.

## Tests — `tests/backtesting/test_genome_operators.py` (extend)

- **Subtree exchange:** crossover transfers **more than one node** from B into A (assert imported
  sub-DAG size > 1 on a constructed case), re-ids avoid collisions, and the child is valid; orphan
  nodes are removed; caps respected.
- **Crossover validity property test:** over many seeded random tradeable parents, every child
  validates; fallback to single-node swap triggers only when no compatible sub-DAG exists.
- **Adaptive rate:** a synthetic stagnating fitness history raises `mutation_rate` toward
  `mutation_rate_max` after `stagnation_patience`; an improving history decays it back.
- **Operator weights:** an operator credited with repeated gains gains selection probability;
  with `adaptive_operator_weights=False`, selection is uniform (baseline parity).
- **Determinism:** same seed → identical children, identical adaptive-rate trajectory.
- **Diversity signal:** the structural measure drops when the population homogenizes and recovers
  after a mutation burst (no backtests invoked — assert via a spy).
- Existing operator / genetic-search tests green and **unmodified**.

## Docs

`q_backend/README.md`: extend the genetic section — crossover now exchanges whole sub-DAGs;
mutation rate and operator weights adapt to structural stagnation; note this is _variation_
diversity and is complementary to WO46's _selection_ (book) diversity.

---

## Definition of done

- `uv run pytest` passes. **Do not report completion until it does.**
- Subtree crossover demonstrably transfers multi-node building blocks and preserves validity.
- Paste in the final message: the new `crossover_genomes` approach (cut/splice/re-id/prune), the
  structural diversity signal, the added `GeneticSearchConfig` fields, and how it composes with
  WO46's selection-diversity hooks.

## Out of scope

- Selection-diversity / low-correlation book / feature seeding — **WO46**.
- Graded fitness — **WO52**. Trade-viability — **WO53**. Parallel evaluation/budget — **WO54**.
- New grammar primitives / multi-objective NSGA-II / island models (v2).
- API / DB / UI.
