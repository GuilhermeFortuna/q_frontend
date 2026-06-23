# WO96 — Frontend: cinematic performance instrumentation and budgets

## Shared context (read first)

Two-repo project:

- **Backend** `q_backend` — Python/FastAPI, use `uv` only.
- **Frontend** `q_frontend` — React/TypeScript/Vite/Tauri, use `pnpm` only.
  - Tests: `pnpm test:run`
  - Typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit`
  - Build: `pnpm build`

**Context:** Q is intentionally cinematic. Recent WO88-WO95 work made the Backtests/AI setup path
heavier and exposed app-wide stutter, especially in the Tauri/Linux runtime. Do not solve this by
making the UI plain. This batch changes the rendering architecture so Q can keep or improve its
cinematic look while scaling to many more features.

This WO is the first step: add measurement. Later WOs must use this instrumentation to prove visual
performance improvements instead of guessing.

## Goal

Add a developer-only performance layer that makes shell/rendering regressions visible:

- frame-rate and dropped-frame estimate,
- long tasks,
- route/navigation timing,
- active canvas count,
- mounted cinematic/animation loop count where available,
- route-mount query count,
- optional compact HUD overlay.

The instrumentation must be cheap, dev-only, and disabled in production unless explicitly enabled.

## How the pieces work today

Read:

- `src/app/App.tsx`
- `src/app/router.tsx`
- `src/app/providers.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/background/QuantBackground.tsx`
- `src/components/brand/QuantEmblem.tsx`
- `src/components/effects/PointerSpotlight.tsx`
- `src/api/queries/*`
- `src/lib/env.ts`

Also inspect any current app-shell performance patches before editing; do not revert user changes.

## Tasks

### 1. Add a performance store and collector

Create a small module such as `src/lib/performance/performanceMonitor.ts` that:

- samples `requestAnimationFrame` deltas;
- computes approximate FPS and dropped frames;
- observes browser long tasks when `PerformanceObserver` supports `longtask`;
- counts `document.querySelectorAll("canvas").length`;
- records route path changes and time-to-settle after navigation;
- exposes a safe subscription API or Zustand slice.

Guard every browser API for Tauri/WebKit compatibility.

### 2. Add a developer HUD

Create `src/components/performance/PerformanceHud.tsx`.

Requirements:

- only renders when enabled by a dev flag, for example `VITE_PERF_HUD=true`;
- does not mount in production by default;
- compact, fixed, low-z-index enough not to block the app;
- shows FPS, long task count, canvas count, current route, recent route settle time.

Do not style it as product UI. It is an engineering instrument.

### 3. Add route/query counters

Add lightweight hooks around router and React Query:

- count initial query starts per route mount;
- capture repeated refetch/polling on inactive routes;
- expose the count to the HUD and console logger.

Do not change existing query behavior in this WO unless the instrumentation reveals an accidental
infinite loop; if so, document it and keep the fix separate.

### 4. Add budget constants

Add a documented budget file, for example `src/lib/performance/budgets.ts`:

- max always-on canvases outside explicit 3D workspaces: `0`;
- max app-shell animation loops outside cinematic renderer: `0`;
- max route-mount queries for launcher/backtests/discover/market-data;
- long-task warning threshold: `50ms`;
- target FPS: `55+` in browser dev, no repeated OS-level stutter in Tauri.

These budgets are observability first. Do not fail CI yet unless the repo already has a stable
browser perf test setup.

## Visual guardrails

> No visual regression is allowed. This WO should not change product visuals except adding an
> opt-in developer HUD.

> Do not remove cinematic effects here. Measure first.

## Tests

- Unit test the collector logic with fake `requestAnimationFrame`/performance entries where practical.
- Component test that the HUD is absent by default and present only when the enable flag is set.
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

Run at least:

- `pnpm dev` or `./dev.sh --web`
- navigate Launcher -> Backtests -> Discover -> Market Data
- confirm the HUD updates and reports canvas/query counts.

If possible, also run Tauri via `./dev.sh --podman` and capture HUD readings for the stuttering path.

## Definition of done

- Developer performance HUD and collector exist and are disabled by default.
- Current route FPS/long-task/canvas/query metrics are visible when enabled.
- No product visual changes except the opt-in HUD.
- Required test/typecheck/build commands pass.
- Final message pastes sample HUD readings for `/`, `/backtests`, and one other workspace.

## Out of scope

- Rewriting the cinematic renderer.
- Removing panel blur/shadows.
- Lazy-loading routes/features.
- Enforcing budgets in CI.
