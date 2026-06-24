# WO112 — Frontend: multi-entry instances + manager in Optimize setup

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/multi-entry-composition.md`. Depends on **WO110** (backend per-instance search
space) + **WO111** (the Simulation multi-entry UI + `useBacktestConfig` instance model to mirror).

## How the pieces work today (read these files)

- `src/components/optimize/setup/OptimizeSetupPanel.tsx` — Optimize setup. Left column =
  `StrategyLibrary` (single-select entry) + `ExitStrategyCards`; right = `OptimizeStrategyDetailPanel`.
- `src/components/optimize/setup/OptimizeStrategyDetailPanel.tsx` — stacks the selected entry's
  **search-space ranges** then each candidate exit's ranges (`StrategySearchSpaceFields`).
- `src/lib/optimize/useOptimizeConfig.ts` — config hook. Holds `strategy` (single, default
  `'MACrossover'`), `candidateExitRuleIds`, `candidateExitParamSpecs`; `toggleExitRule`;
  `buildOptimizationConfigPayload` (returns `{ strategy, ... }` at line ~224).
- `src/lib/optimize/exitSearchSpace.ts` — `filterApplicableExitRules` (shared with Simulation).

## Goal

The Optimize setup mirrors WO111: choose **multiple entry instances** (duplicates allowed) + a
manager; the right panel shows each instance's **search ranges** (not single values), and the
optimization payload carries the namespaced multi-entry search space (WO110).

## Tasks

### 1. Config hook — `useOptimizeConfig.ts`

- Replace the single `strategy` with an `entries: EntryInstanceState[]` model (same shape as
  WO111's `useBacktestConfig`) + `entryManager`. Reuse WO111's instance state type/helpers — factor
  shared logic into `src/lib/strategies/` if it avoids duplication.
- For each instance, derive its searchable specs (the same partition used today for the single
  strategy) keyed per slot. `buildOptimizationConfigPayload` emits `entries` + `entry_manager` +
  `exit_params` so the backend (WO110) derives the `e{i}__*` / `manager__*` search space.
- Keep exit search-space selection (`candidateExitRuleIds`) exactly as today — exits stay shared.
- Hydration accepts legacy single `strategy` or an `entries` array.

### 2. Multi-select entry cards + manager — `OptimizeSetupPanel.tsx`

- Reuse the WO111 multi-select entry grid (`LibraryCard`) + `EntryManagerSelector` (shared
  component). Add/remove instances, duplicates allowed, manager segmented control.

### 3. Per-instance ranges — `OptimizeStrategyDetailPanel.tsx`

- Render one search-space section per entry instance (label `e{i} · <strategy label>`, remove
  button) via the existing `StrategySearchSpaceFields`, then the candidate-exit ranges (unchanged),
  then manager params (`vote_threshold` range/value when Majority).
- Keep the "Select … to include it in the search" hint pattern.

## Guardrails

> Reuse `EntryManagerSelector`, `StrategySearchSpaceFields`, `LibraryCard`, `filterApplicableExitRules`,
> and the WO111 instance helpers — no parallel re-implementation.
> Exits stay a single shared search set (position-level).
> Single-instance + OR must derive a payload equivalent to today's single-strategy optimize payload
> (assert in a test) so existing studies are unaffected.

## Tests

- `useOptimizeConfig` test: multi-instance payload from `buildOptimizationConfigPayload` carries
  `entries` + `entry_manager`; duplicate instances stay independent; single instance + OR yields a
  back-compatible payload.
- `OptimizeSetupPanel` test: selecting two entry cards renders two per-instance search-space
  sections + the manager selector; exit candidate cards still add their ranges.
- `OptimizeStrategyDetailPanel` test: Majority manager surfaces a `vote_threshold` control.

## Docs

- `docs/design/multi-entry-composition.md`: tick the Optimize box.

## Definition of done

- `pnpm test:run`, `pnpm exec tsc -p tsconfig.app.json --noEmit`, and `pnpm build` all pass —
  **do not report completion until they do.**
- Paste-in-final-message: confirm (a) multi-instance optimize payload carries namespaced entries +
  manager, (b) single-entry+OR payload is back-compatible.

## Out of scope

- Backend search-space derivation — **WO110** (done).
- Genetic discovery UI — untouched.
