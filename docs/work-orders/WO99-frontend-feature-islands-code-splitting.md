# WO99 — Frontend: feature islands, lazy loading, and inactive-pane parking

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO96** instrumentation. Can run independently of WO97/WO98 after measuring current route
mount cost.

**Context:** Q will grow substantially. Heavy features such as AI strategy builder, 3D visualizers,
charts, Discovery results, Optimize terrain, history panels, and modals must not all mount eagerly.

## Goal

Introduce a feature-island architecture:

- route-level code splitting;
- heavy panel lazy loading;
- inactive workflow panes parked or unmounted with serializable state;
- no AI/3D/chart-heavy module loaded before the user reaches the relevant feature;
- current visual quality preserved.

## How the pieces work today

Read:

- `src/app/router.tsx`
- `src/workspaces/backtests/BacktestsWorkspace.tsx`
- `src/components/backtests/focus/BacktestFocusWorkbench.tsx`
- `src/components/backtests/setup/BacktestSetupPanel.tsx`
- `src/components/backtests/setup/AiStrategyPanel.tsx`
- `src/workspaces/backtests/OptimizeWorkflow.tsx`
- `src/components/optimize/OptimizationTerrain3D.tsx`
- `src/components/discover/LiveSwarmVisualizer3D.tsx`
- `src/components/charts/*`
- `src/store/useAppStore.ts`
- React Query hooks under `src/api/queries/*`.

## Tasks

### 1. Route-level lazy loading

Convert major workspaces to lazy-loaded route components:

- Launcher;
- Market Data;
- Storage;
- System;
- Backtests;
- Discover;
- WalkForward/Validate;
- News reader.

Use `React.lazy`/`Suspense` or TanStack Router-supported lazy patterns consistent with the codebase.
Keep fallbacks visually premium and lightweight.

### 2. Lazy-load heavy subfeatures

Lazy-load:

- `AiStrategyPanel` and AI strategy-builder types/helpers until Backtests setup is expanded and/or the
  AI panel is opened;
- `OptimizationTerrain3D` only when its results tab is visible;
- `LiveSwarmVisualizer3D` only when Discovery has results and the user opens the visualizer;
- chart modals and standalone heavy chart windows only when opened.

Do not hide missing functionality. Use polished skeletons/loading surfaces.

### 3. Park inactive panes intentionally

The current focus workbench keeps panes mounted for state preservation. Replace accidental mounting
with explicit parking:

- serialize setup state into the existing store when collapsing/unmounting;
- keep only cheap teasers mounted;
- remount full setup/results only when expanded;
- preserve user input and results.

Apply first to Backtests setup/results, then mirror the pattern for Optimize if safe.

### 4. Query lifecycle cleanup

Ensure inactive islands do not poll or fetch:

- queries should have `enabled` flags tied to visible state;
- history/results tabs should not fetch while hidden;
- AI capabilities should remain lazy as established by the stutter investigation;
- no route should fire heavy queries for hidden panes.

## Visual guardrails

> Loading states must be cinematic and branded, not generic spinners on blank white/black screens.

> Lazy loading must not create layout jumps. Reserve dimensions for major panes.

> State preservation is required. Do not trade performance for lost form state.

## Tests

- Route smoke tests still render each workspace.
- Backtests setup state survives collapse/remount.
- AI panel module/query does not load/fetch until opened or used.
- Hidden 3D visualizers do not mount canvases.
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

Using WO96 HUD:

- record route mount query count before/after for Backtests and Discover;
- confirm canvas count stays zero until 3D features are visible;
- confirm bundle chunks are split in `pnpm build` output.

## Definition of done

- Major routes and heavy subfeatures are lazy-loaded.
- Inactive panes are parked with state preservation.
- Hidden features do not poll/fetch/mount canvases.
- Visual loading states match the app’s cinematic language.
- Required test/typecheck/build commands pass.
- Final message includes before/after route query counts and chunking summary.

## Out of scope

- Rewriting backend job APIs.
- Changing backtest/optimization payload shapes.
- Building the cinematic renderer (WO97).
