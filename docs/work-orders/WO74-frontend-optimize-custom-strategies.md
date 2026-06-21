# WO74 — Frontend: custom strategies selectable & optimizable in the Optimization tab

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context for this work:** the Strategy page is being folded into Backtests (**WO73**), so users now
author custom strategies right inside the Backtests Simulation setup. They must also be able to **run
optimizations on those custom strategies** in the Backtests **Optimization** tab. The Optimization
setup uses a plain strategy `<select>` whose search-space fields come from `selectedStrategy.params`
(entry + exit, flat). Saved customs already flow into `useStrategies()` after a save, and the
optimize select is fed the **unfiltered** strategy list — so this is largely a **guarantee + test**
WO, with fixes only if gaps exist.

This is **frontend-only**. Read the design doc: `q_frontend/docs/design/strategy-into-backtests.md`.

**Sibling WOs:** authoring/studio in Simulation is **WO73**; route/nav cleanup is **WO75**. This WO is
independent of WO73 and may run in parallel.

---

## How the pieces work today (read these files)

- `src/lib/optimize/useOptimizeConfig.ts` — optimize state: `strategies` (all, from `useStrategies`),
  `filteredStrategies` (engine-filtered), `selectedStrategy`, `searchSpace`, `handleStrategyChange`,
  the search-space init effect, and `buildRequest`/the request builder.
- `src/components/optimize/setup/OptimizeSetupPanel.tsx` — passes **`config.strategies`** (the
  unfiltered all-list) to `OptimizeStrategySection`.
- `src/components/optimize/OptimizeStrategySection.tsx` — renders the strategy `<select>` from the
  `strategies` prop (line ~191) and `StrategySearchSpaceFields` from `selectedStrategy.params`
  (line ~199).
- `src/components/optimize/StrategySearchSpaceFields.tsx` — turns each `StrategyParamSpec` into a
  min/max/step search-space field.
- `src/api/queries/customStrategies.ts` — save/delete invalidate `strategyKeys.list()`, so a saved
  custom reappears in `useStrategies()`.

---

## Goal

A saved custom strategy appears in the Optimization strategy selector (clearly tagged as custom), and
selecting it exposes its **full** param set (entry + exit) as search-space fields, so an optimization
run targets `strategy = <customName>` over those params — no different from a built-in.

## Tasks

### 1. Verify customs reach the optimize selector

Confirm `useOptimizeConfig` → `OptimizeSetupPanel` → `OptimizeStrategySection` lists saved customs in
the `<select>`. If the select is (now or later) fed an engine-filtered or built-in-only list that
drops customs, switch it to include them (match WO73's "Saved/Custom" treatment). Tag custom options
in the dropdown (e.g. a `— custom` suffix or `optgroup`) so they're distinguishable.

### 2. Verify entry + exit params become search-space fields

Confirm `selectedStrategy.params` for a custom includes the base strategy's full (entry + exit) specs
so `StrategySearchSpaceFields` renders them. If a custom carries only saved scalar values without
specs, resolve specs from its `base_strategy` (mirror the `loadCustom` spec-merge from **WO73**) before
building the search space. (See the assumption in the design doc — verify against a real saved custom.)

### 3. Verify the optimization request

Selecting a custom and building the request yields `strategy: <customName>` with the search space over
its params. No payload-shape change — just make sure a custom name flows through `buildRequest`.

## Guardrails

> **Guarantee, don't redesign.** No Entry/Exit tabs in Optimize, no new search-space UI. Keep the
> existing flat search-space treatment; only ensure customs are present and optimizable.

> **No backend change.** The optimization endpoint already accepts a strategy name + search space.
> Custom strategies are resolved server-side by name.

> **Tag, don't hide.** Customs must be visibly distinguishable from built-ins in the selector.

## Tests — `tests/unit/` (Vitest)

- Optimization strategy selector includes a mocked saved custom (tagged), alongside built-ins.
- Selecting a custom renders its entry **and** exit params as search-space fields.
- Building the optimization request with a custom selected sets `strategy` to the custom's name and
  includes its search space.

Extend the existing optimize setup/config tests (e.g. `tests/unit/lib/optimize/*` or
`tests/unit/components/Optimize*`); add a small fixture custom strategy.

## Docs

Note in the backtests/optimize doc that custom strategies (authored in the Simulation studio, WO73)
are optimizable from the Optimization tab.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all three pass.**
- Manually (`./dev.sh`): save a custom in Backtests → Simulation, switch to Optimization, select the
  custom, see its entry+exit params as search-space fields, and start an optimization run.
- Paste in the final message: whether any code change was needed (and what) or whether customs were
  already optimizable and this WO only added tests, plus how custom options are tagged in the selector.

## Out of scope

- The Simulation-side studio, tabs, and inline authoring — **WO73**.
- Route/nav/file cleanup of the old `/strategy` page — **WO75**.
- Walk-forward (`/validate`) strategy selection — unchanged; only touch if it shares the exact
  optimize selector code path and would otherwise drop customs.
