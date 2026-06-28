# WO156 — Frontend: Research "Experiments" tab + Discovery A/B panel

## Shared context (read first)

Two-repo project on Windows. Frontend `q_frontend` uses `pnpm` (`pnpm test:run`, `pnpm typecheck`,
`pnpm build`) — never npm/yarn. Read `docs/design/discovery-payoff-validation.md` first. Depends on
**WO154** (Discovery A/B endpoint). Establishes the new Experiments tab shell + the A/B panel; the
ablation panel is **WO157**.

## How the pieces work today (read these files)

- `src/workspaces/research/ResearchWorkspace.tsx` — tabbed shell. `TAB_OPTIONS` (`{value,label}`) +
  `SegmentedToggle`; `tab` prop typed `ResearchTab`; `handleTabChange` writes `?tab=`. Tabs today:
  `store`, `scoring`, `lab`, `neural`.
- `src/types/features.ts` — `ResearchTab` union. The route allow-lists `?tab=` values (find the route
  module that validates the search param; mirror how `neural` was added in WO148).
- **Query/poll precedent:** `src/api/queries/neural.ts` (start-job mutation + `useXStatus(jobId,
{isRunning})` polling hook) and `src/api/queries/features.ts`. Client: `src/api/client.ts`
  (axios; long jobs are fire-and-poll, never synchronous on the request path).
- **Chart/live-poll panel precedents:** `src/components/optimize/OptimizationAnalyticsTab.tsx`
  (recharts/visx, our stack) and `src/components/research/FeatureScoringDashboard.tsx`.
- **Form-input precedents:** the Backtests symbol/timeframe/date pickers (reused across Storage/Feature
  Lab) — reuse, don't reinvent.
- **UI primitives:** `src/components/ui` (WO116–123 design system).

## Goal

A new `Experiments` tab in Research with a Discovery A/B panel: launch a latents-on/off A/B run, watch
it poll, and read a verdict (helps / no effect / hurts) with the two-arm distribution and effect size.

## Tasks

### 1. Register the tab

- Add `'experiments'` to `ResearchTab` (`src/types/features.ts`) and to `TAB_OPTIONS` in
  `ResearchWorkspace.tsx` (label `Experiments`). Add `'experiments'` to the `?tab=` route allow-list
  (same place `neural` is allowed). Render an `<ExperimentsWorkspace />` island for the tab.

### 2. Types + queries

- `src/types/experiments.ts` — mirror the WO154 payloads: `DiscoveryAbRequest`,
  `DiscoveryAbStatusResponse`, the result shape (`verdict`, `metric`, `control`/`treatment`
  `{values, mean}`, `paired_delta` `{values, mean, cohens_d, p_value}`, `n_seeds`).
- `src/api/queries/experiments.ts` — `useStartDiscoveryAb()` mutation (`POST .../discovery-ab`) +
  `useDiscoveryAbRun(jobId, {isRunning})` polling query (`GET .../discovery-ab/{job_id}`), mirroring
  `useStartFeatureEval`/`useFeatureEvalRun`.
- `src/mocks/experiments.ts` — MSW handlers for both endpoints (fixtures for **tests only**).

### 3. Experiments workspace shell

- `src/workspaces/research/ExperimentsWorkspace.tsx` (or `src/components/research/experiments/`): a
  sub-segmented layout with an `A/B Discovery` panel now and a placeholder slot for `Encoder Ablation`
  (WO157 fills it). Keep panels in separate files.

### 4. Discovery A/B panel

- `DiscoveryAbPanel.tsx`: launch form — reuse the Backtests symbol/timeframe/date pickers + a
  seed-count (or seed-list) field; submit builds a `StrategySearchConfig` + `seeds` and calls the start
  mutation. While running, poll and show progress.
- On completion: a distribution plot of the two arms (recharts/visx, mirroring
  `OptimizationAnalyticsTab`) and a **verdict badge** — `helps` / `no effect` / `hurts` — with mean
  delta, Cohen's d, and p-value. Echo the metric used (`lockbox_objective` or fallback).

### 5. Loading / error / empty discipline

- Distinguish **loading** (job running/poll in flight), **errored** (job `failed` or request error →
  surface `error`/`detail`), and **genuinely empty** (no run started yet → empty-state CTA). Do not
  conflate them (the bug class flagged in prior frontend WOs).

## Guardrails

> **No mocks in production paths.** No `@/mocks` import outside `__tests__`/`*.test.*`; component
> initial state is `null`/`[]`/empty-state, real data comes from queries. CI check (must be empty):
> `grep -rn "@/mocks" src --include=*.tsx --include=*.ts | grep -v __tests__ | grep -v '\.test\.' |
grep -v 'src/mocks/' | grep -v 'src/main.tsx'`.
> **Fire-and-poll only.** Never call the A/B endpoint synchronously and block; use the start-mutation +
> polling-query pattern.
> **Verdict honesty in UI.** `no effect` is a first-class state, visually distinct from `hurts`; always
> show effect size + p alongside the badge, never the badge alone.
> **Reuse pickers + primitives.** Symbol/timeframe/date pickers and `src/components/ui` primitives —
> do not hand-roll new ones.

## Tests

- `src/components/research/experiments/__tests__/DiscoveryAbPanel.test.tsx` (MSW + the standard render
  harness):
  - Submitting the form fires `POST .../discovery-ab` and transitions to a running/polling state.
  - A mocked completed run renders the verdict badge, both arm distributions, and mean delta / d / p.
  - A mocked `failed` run renders the error state (not empty, not loading); the initial no-run state
    renders the empty-state CTA.
- `ResearchWorkspace` test: the `experiments` tab is selectable and `?tab=experiments` resolves.

## Docs

- `docs/design/discovery-payoff-validation.md`: mark WO156 implemented.
- Cross-link WO154 (endpoint) + WO157 (ablation panel in the same tab).

## Definition of done

- `pnpm test:run`, `pnpm typecheck`, and `pnpm build` all pass — **do not report completion until they
  do.**
- Paste-in-final-message: a screenshot/markup of the Experiments tab with a completed A/B verdict, and
  confirmation the `@/mocks` grep check is empty.

## Out of scope

- The Encoder Ablation panel — **WO157** (fills the placeholder slot in this tab).
- Any backend change (WO153–155 own the backend).
- Multi-instrument aggregation UI.
