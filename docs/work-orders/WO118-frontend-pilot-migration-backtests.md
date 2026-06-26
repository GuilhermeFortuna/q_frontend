# WO118 — Frontend: pilot migration — Backtests (Simulation + Optimization)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md` (**Component inventory**). Depends on **WO116** (materials)
and **WO117** (the `ui/` primitives + barrel). This is the **proving ground** — the page screenshotted by
the user — and ends at **Checkpoint B**, the gate before rolling out to every other page.

**Principle:** swap inline idioms for WO117 primitives **without changing behavior or logic**. Same store
wiring, same handlers, same data — only the markup/structure changes. If a primitive's API doesn't fit
cleanly, that's the signal to fix the primitive **now** (in WO117's files) before it's load-bearing across
8 pages — flag it explicitly in the final message.

## How the pieces work today (read these files)

The Backtests workspace = the `Simulation` and `Optimization` tabs in the screenshot.

- `src/workspaces/backtests/BacktestsWorkspace.tsx`, `src/workspaces/backtests/OptimizeWorkflow.tsx` — tab
  shells.
- `src/components/optimize/` — the Optimization tab: `OptimizeConfigForm.tsx`, `OptimizeStrategySection.tsx`,
  `OptimizeStudySection.tsx`, `OptimizeRiskSection.tsx`, `OptimizeAdvancedSection.tsx`,
  `StrategySearchSpaceFields.tsx` (min/max/step triplet + `EMA/HMA/SMA` pills), `optimizeFormShared.tsx`.
- `src/components/backtests/setup/`, `src/components/backtests/focus/` — the Simulation tab setup panels.
- `src/components/shared/` — `InstrumentConfigFields.tsx` (`DATE_PRESETS`), `StrategyParamFields.tsx`,
  `PositionSizingModeFields.tsx`, `TransactionCostFields.tsx` — these back **both** tabs; migrating them
  re-skins shared structure (good — they're consumed elsewhere too, so keep their public props identical).

## Goal

Backtests Simulation + Optimization render entirely through WO117 primitives on WO116 surfaces — the full
elevation + accent vision on a real, dense page.

```
INSTRUMENT & MODELING  →  <Panel><PanelHeader/>…            DATE_PRESETS  → <RangeChips/>
category filter row    →  <FilterPills/>                    EMA/HMA/SMA   → <SegmentedToggle multi/>
Any(OR)/All/Majority   →  <SegmentedToggle/>                strategy card → <EntityCard/>
Short/Long/Step inputs →  <RangeInput/>                     metric bar    → <StatTile/>
labels+hints+errors    →  <LabeledField/>
```

## Tasks

### 1. Section containers + headers

Replace the hand-rolled small-caps headers + panel wrappers (`INSTRUMENT & MODELING`, `DATE RANGE &
SCHEDULE`, `CAPITAL & SIZING`, `COSTS`, `SEARCH SPACE`, `ENTRY STRATEGIES`, `MANAGER`, `EXIT STRATEGIES`)
with `Panel` + `PanelHeader` / `SectionHeader`.

### 2. Controls

- `DATE_PRESETS` chips in `InstrumentConfigFields.tsx` → `RangeChips` (keep `DatePreset` semantics).
- Entry-strategy category filter (`All / Trend / Mean reversion / Breakout / Momentum / Other`) → `FilterPills`.
- Manager (`Any (OR) / All (AND) / Majority vote`) → `SegmentedToggle` (single).
- MA-type rows (`EMA/HMA/SMA/SMMA/WMA`) in `StrategySearchSpaceFields.tsx` → `SegmentedToggle` (multi).
- min/max/step triplets → `RangeInput`.
- All bespoke `label`/hint/error blocks → `LabeledField`.

### 3. Cards + metrics

- Entry/exit strategy tiles → `EntityCard` (title + type tag + description + `N params` meta; selected =
  `accent-state`). Preserve "+ Add another …" affordances and the selected/active wiring.
- Result metric bars (`BacktestMetricsBar.tsx`, `OptimizationMetricsBar.tsx`) → `StatTile` row.

### 4. Verify parity

The page must behave identically: same selections, same form state, same submit payloads, same results
rendering. Charts (`recharts`/`visx`) are untouched except their containing surfaces now read WO116.

## Guardrails

> **Behavior-preserving migration.** No logic, store, query, or payload changes. If a test asserts behavior,
> it must pass unchanged. Visual + structural swap only.
> **Keep shared components' public props stable** — `InstrumentConfigFields` etc. are used by other pages
> not in this WO; change their internals, not their signatures.
> **If a primitive doesn't fit, fix the primitive (WO117 files), not a one-off.** Then note the API change in
> the final message so the design doc + later WOs stay in sync. Do **not** reintroduce inline gradients.
> **No new behavior** (no new filters, no reordered fields) — that's scope creep; this is a re-skin.

## Tests

- Update existing Backtests/optimize tests only where markup queries changed (prefer role/label queries that
  survive the swap). Add: `src/workspaces/backtests/__tests__/backtests-migration.test.tsx` asserting the
  page renders via primitives (e.g. a `SegmentedToggle` for Manager, `EntityCard`s for strategies) and that
  selecting a strategy / changing Manager still updates the same state.
- Full suite stays green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: tick WO118 + **Checkpoint B**; record any primitive API changes made
  during the pilot.

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message (**this is the Checkpoint B brief for the user**): confirm both Backtests tabs render
  entirely through WO117 primitives with parity; list any WO117 API tweaks made; and call out anything that
  felt awkward to migrate (so we adjust before WO125–126). **Stop here for user inspection.**

## Out of scope

- Any other page — **WO122 (Discover), WO123 (Market), WO124 (Launcher), WO125 (Walkforward+Validate),
  WO126 (Storage/System/News/chrome)**.
- New features or field reordering on Backtests — re-skin only.
