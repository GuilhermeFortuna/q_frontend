# WO41 — Frontend: Discovery genetic mode (config · generations · genome · DSR/lock-box)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` · Typecheck: `pnpm typecheck` · Lint: `pnpm lint`
- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip.

**Context for this work:** batch "Generative Discovery". The backend now (WO38–WO40) supports
**genetic strategy synthesis** — evolving novel `CompositeStrategy` genomes, ranked on
out-of-sample robustness with a Deflated-Sharpe multiple-testing correction and a held-out
lock-box. **This WO surfaces it in the existing Discover workspace.** There is **no new
workspace** — a genetic run **is** a Discovery run with a different provider (design §6.3). The
additions are: a search-mode toggle + GA/lock-box config, generation-aware progress, a
generation selector + genome viewer on results, and a DSR/lock-box verdict panel. Build against
the **JSON contracts pasted in WO40's completion message**; degrade cleanly against a pre-WO40
backend. Design: **`docs/design/genetic-strategy-search.md` §5.4 and §6.3** (read them).

---

## How the pieces you're extending work today (read these files)

- `src/workspaces/discover/DiscoverWorkspace.tsx` — the workspace shell (config form + results
  panel + history). Add the mode toggle's state here; keep registry sweep the default.
- `src/components/discover/DiscoverConfigForm.tsx` — current registry-sweep config form. Add a
  **Search mode** toggle (Registry sweep · Genetic synthesis) that reveals GA + lock-box fields.
- `src/components/discover/DiscoverProgress.tsx` — renders `StrategySearchStatus`. Extend to show
  "Generation 2/5 — Candidate 7/40" when `generation`/`total_generations` are present.
- `src/components/discover/DiscoverResultsPanel.tsx` + `LeaderboardTable.tsx` +
  `CandidateDetailPanel.tsx` — leaderboard + row expansion. Add the generation filter, the
  **Genome** tab, and the run-header DSR/lock-box callout here.
- `src/types/strategySearch.ts` — the TS contracts (`StrategySearchConfig`, `GateConfig`,
  `CandidateResult`, `StrategySearchStatus`, `StrategySearchResults`, `StrategySearchSummary`,
  `DEFAULT_GATE_CONFIG`, the terminal-status helpers). **Extend additively** to mirror WO40.
- `src/api/queries/strategySearch.ts` — the start/status/results/history queries. Add the
  optional `GET .../candidates/{id}/genome` query (only fetched when a row's `genome` isn't inline).
- `src/lib/discover/promoteCandidate.ts` — `buildBacktestRequestFromCandidate` /
  `buildOptimizationConfigFromCandidate`. For a genetic candidate these must promote
  `strategy="CompositeStrategy"` carrying the **genome** so the Workbench reruns it (task 5).
- `src/lib/discover/candidateMetrics.ts` — metric glosses/formatters; reuse for new fields.
- `src/mocks/` strategy-search handlers/fixtures — add genetic fixtures (generations, genomes,
  DSR, lock-box) so the UI renders without a live backend.

---

## Goal

The Discover workspace runs a genetic synthesis search end-to-end against the WO40 backend:
configure GA + lock-box, watch generation-aware progress, browse a per-generation leaderboard,
inspect any candidate's evolved **genome**, read the champion's **DSR + lock-box verdict**, and
promote a genome to the Backtest Workbench — with registry sweep **pixel-identical** to today.

## Tasks

### 1. Types — extend `src/types/strategySearch.ts` additively (mirror WO40)

```ts
export type SearchProvider = 'registry' | 'genetic'

export type GeneticSearchConfig = {
  population_size: number
  generations: number
  elite_count: number
  crossover_rate: number
  mutation_rate: number
  tournament_size: number
  init_seed?: number | null
  max_nodes: number
  max_depth: number
  complexity_lambda: number
  complexity_mu: number
}
export type LockboxConfig = {
  enabled: boolean
  lockbox_pct?: number | null
  lockbox_days?: number | null
  min_trades: number
  max_drawdown_pct?: number | null
}
// StrategySearchConfig gains: genetic?: GeneticSearchConfig | null; lockbox?: LockboxConfig
// StrategySearchStatus gains:  generation?: number | null; total_generations?: number | null
// CandidateResult gains:       generation?: number | null; genome?: Genome | null
//                              genome_node_count?: number | null; dsr?: number | null
// StrategySearchSummary gains: champion_dsr / n_trials_effective / sr_observed /
//                              lockbox_metrics / lockbox_passed / generations_completed /
//                              total_genomes_evaluated  (all optional)
```

Add a `Genome` type (mirror WO38's `Genome`/`GenomeNode`/`NodeParam`) plus
`DEFAULT_GENETIC_CONFIG` / `DEFAULT_LOCKBOX_CONFIG` constants. Everything optional so a pre-WO40
backend (no fields) still type-checks and renders.

### 2. Config form — search-mode toggle (design §6.3.1)

In `DiscoverConfigForm.tsx`: a **Search mode** segmented control — **Registry sweep** (default,
existing form unchanged) vs **Genetic synthesis**. Genetic reveals:

- GA knobs: population size, generations, elite count, crossover/mutation rate, tournament size,
  init seed, max nodes, max depth (validated to the WO39 `Field` bounds via Zod).
- An **Advanced › Lock-box** section: enable + `lockbox_pct` (or days) + min trades + optional
  max drawdown.
- Complexity penalty (λ/μ) under Advanced.

On submit, genetic mode sends `genetic` + `lockbox` blocks; registry mode omits them
(byte-identical request to today). Keep the shared backtest/objective/walk-forward/study fields
in one place — do not fork them.

### 3. Progress — generation aware (design §6.3.2)

`DiscoverProgress.tsx`: when `status.total_generations` is set, show a generation bar/line
("Generation 2/5") above the existing candidate/window progress; otherwise render exactly as
today. No layout shift for registry runs.

### 4. Results — generation filter, genome viewer, verdict panel (design §6.3.3, §5.4)

- **Run header callout** (genetic runs only): champion **DSR** with a plain-language gloss
  ("adjusted for ~1,200 genomes tried"), `sr_observed`, generations completed, total genomes
  evaluated, and a **Lock-box** badge (pass/fail; show WF-OOS vs lock-box side by side, **red if
  they diverge**). Include the design §5.4 skeptic copy: "High DSR still does not guarantee live
  performance; lock-box is a single holdout — treat as screening, not proof."
- **Generation selector:** a dropdown filtering `LeaderboardTable` by `generation` (default:
  final/champion generation). Registry runs hide it.
- **Genome tab** in `CandidateDetailPanel.tsx`: a read-only view of the candidate's genome — a
  simple node/tree rendering (kind + params + edges) with a formatted-JSON fallback. Lazy-fetch
  via `GET .../candidates/{id}/genome` only when `genome` isn't inline.
- **Complexity line:** node count + param count on the candidate row/detail.
- An **"Evolved" badge** distinguishes `CompositeStrategy` rows from registry strategy names.

### 5. Promote a genome to the Workbench (design §6.3.4)

`promoteCandidate.ts`: for a genetic candidate, `buildBacktestRequestFromCandidate` /
`buildOptimizationConfigFromCandidate` must set `strategy="CompositeStrategy"` **and carry the
genome** (in `strategy_params` / fixed params as the backend's `fixed_params["genome"]` expects)
plus `best_params`, so "Send to Backtest/Optimizer" reruns the evolved strategy via the existing
`pendingBacktestConfig` / `pendingOptimizationConfig` seams. Registry candidates are unchanged.

### 6. Mocks — `src/mocks/`

Add genetic fixtures: a multi-generation run (status with `generation`/`total_generations`,
results with per-candidate `generation`/`genome`/`genome_node_count`/`dsr`, summary with DSR +
lock-box), and a `candidates/{id}/genome` handler. Keep an existing registry fixture so both
modes render under MSW.

## Guardrails

> **Registry sweep is pixel-identical.** With search mode = Registry sweep, the form, request
> payload, progress, leaderboard, and promote behavior must match today exactly. New fields are
> additive and gated on genetic mode / presence of the new status fields.

> **Degrade against a pre-WO40 backend.** Every new field is optional; a results payload without
> `genome`/`dsr`/`lockbox_*` renders the leaderboard normally (no genome tab, no verdict panel,
> no crash) — never an error wall.

> **Validate financial/GA inputs with Zod** (tech-stack rule). Population/generations/rates honor
> the WO39 bounds; lock-box pct in (0,1); reject contradictory `lockbox_pct` **and** `lockbox_days`.

> **One source of truth for shared fields.** The backtest/objective/walk-forward/study inputs are
> shared between modes — don't duplicate them per mode.

## Tests — `src/**/*.test.tsx` (Vitest + Testing Library; Playwright smoke optional)

- `DiscoverConfigForm`: toggling to Genetic reveals GA + lock-box fields; submit builds a request
  with `genetic`/`lockbox`; toggling back to Registry produces a request **byte-identical** to
  the pre-WO41 payload (snapshot test).
- `DiscoverProgress`: renders "Generation 2/5" when `total_generations` present; renders exactly
  as before when absent.
- `LeaderboardTable` / results: generation dropdown filters rows; champion DSR + lock-box callout
  render from summary; lock-box divergence shows the red state.
- `CandidateDetailPanel`: Genome tab renders the tree from an inline genome and lazy-fetches when
  absent; registry candidate shows no Genome tab.
- `promoteCandidate`: a genetic candidate builds a `CompositeStrategy` request carrying the genome
  - best_params; a registry candidate's output is unchanged (snapshot).
- Pre-WO40 payload (no genetic fields) renders the leaderboard with no genome tab / verdict and no
  errors.
- `pnpm test:run`, `pnpm typecheck`, `pnpm lint` all green.

---

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, `pnpm lint` pass. **Do not report completion until they do.**
- Registry-sweep Discover is pixel-identical and its request payload byte-identical (snapshot proof).
- A genetic run is fully usable end-to-end under MSW: configure → generation progress → per-generation
  leaderboard → genome tab → DSR/lock-box verdict → promote to Workbench.
- In your final message: note any field where WO40's actual JSON differed from the pasted contract,
  and confirm the pre-WO40 degrade path.

## Out of scope

- Backend genome/genetic/DSR/lock-box logic (WO38–WO40).
- A standalone genome **editor** (read-only viewer only this batch).
- Tick-engine genetic mode; comparing genetic runs in the WO26 run-comparison view (future).
- Animated genome-evolution playback / lineage graphs (v2 polish).
