# Design — Exit strategies as first-class cards (Optimization + Simulation)

**Status:** approved design, drives WO76–WO77; **WO88 supersedes the toggle-card decision** with
first-class selectable cards (click = enable/disable, no switch). Frontend-only (`q_frontend`); no
backend or API changes — the run/optimize payloads are unchanged in shape.

## Problem

Exits are presented inconsistently and, in Optimization, badly:

- **Optimization tab** — the left column is a card library of _entry_ strategies; the right
  "Search Space" panel dumps **every** exit param (Stop Loss %, Stop Loss ATR, Take Profit, …)
  as flat range fields regardless of whether you want that exit. There's no card affordance and
  no way to pick which exits participate.
- **Simulation tab** — exits live behind a separate **Exit & Targets** tab using
  `ExitConfigurator` (grouped toggle cards with inline params, presets, ACTIVE chips).

The user wants exits shown as **cards, like entry strategies, stacked below the entry cards**,
in **both** tabs — consistent and decluttered.

## Goal

In both Simulation and Optimization, the strategy library column shows:

```
┌ left column ───────────────┐  ┌ right column ───────────────┐
│ Strategy   [All][Trend]…   │  │ <Selected strategy>         │
│ ▢card ▢card ▢card (1-pick) │  │ Params / Search Space       │
│ ─────────────────────────  │  │  entry params  (always)     │
│ Exit Strategies (toggle)   │  │  ── ATR Stop ──             │  ← only ENABLED
│ ⦿ ATR Stop   ○ Fixed Stop  │  │  stop_loss_atr …            │     exits' params
│ ○ Chandelier ⦿ Take Profit │  │  Take Profit …              │
└────────────────────────────┘  └─────────────────────────────┘
```

- **Entry cards:** single-select (pick one base strategy) — unchanged.
- **Exit cards:** multi-select selectable cards (shared `LibraryCard` shell), sourced from the
  exit-rule catalog (`useExitRuleCatalog`), each tagged by `exit_group` (Stop Loss / Trailing /
  Targets / Time), filtered to rules whose params exist on the selected strategy. Click toggles
  enable — no separate switch.
- **Toggle-into-params:** enabling an exit reveals its params on the right (values in
  Simulation, ranges in Optimization). Disabling **hides its params and pins the exit off**.

## Key decisions (from brainstorming)

1. **Scope:** both tabs. Optimization first (the gap the user saw); Simulation aligned to match.
2. **Exit card behavior:** click-to-select toggles enable state (`aria-pressed`). Disabled exits
   show no params and are pinned off (not left to a possibly-on strategy default).
3. **Simulation:** "mirror Optimize" — remove the Entry/Exit tab; entry cards + exit toggle
   cards stacked in the left column, params on the right. This **supersedes the Entry/Exit tab
   from the `strategy-into-backtests` design (WO73).** Presets + ACTIVE-chip row from
   `ExitConfigurator` are dropped in the unified layout (possible later follow-up).
4. **Reuse:** a single shared `ExitStrategyCards` component + the existing `exitRuleSemantics`
   helpers drive both tabs.

## Architecture

### Shared

`src/components/backtests/setup/ExitStrategyCards.tsx` — presentational multi-select card grid
via shared `LibraryCard`, one card per rule tagged by exit group. Props: `rules` (already
filtered), `exitParamSpecs`, `isEnabled(rule) => boolean`, `onToggle(rule) => void`, optional
heading/subheading. No business logic — each tab supplies enabled-state + toggle behavior.

Reused helpers (`src/workspaces/strategy/exitRuleSemantics.ts`): `isExitRuleEnabled`,
`defaultEnableValue`, `resolveRuleParamSpecs`, `groupExitRules`, `getEnabledExitRules`,
`getVisibleSharedParamNames`; plus `partitionStrategyParamSpecs` / `groupExitParamSpecs` /
`EXIT_GROUP_ORDER` from `exitWorkbenchGroups.ts`.

### Optimization (WO76, **corrected by WO78** — see below)

- `useOptimizeConfig` gains `useExitRuleCatalog`, an explicit set of selected exit rules +
  `toggleExitRule(id)`, and exit cards derived from the catalog filtered to
  `selectedStrategy.params`. The set initializes from the strategy's defaults (rules whose enable
  default > 0); the user toggles which exits participate.
- Right panel (`OptimizeStrategyDetailPanel` via `StrategySearchSpaceFields`) shows entry params +
  selected exits' params only.

## Correction — Optimization exit _search_ semantics (WO78)

WO76 shipped a wrong semantic: it pinned every selected exit **on in every trial** (all applied at
once). Correct intent: **a selected exit card is a _candidate_ in the search**, and the optimizer
must explore enabling/disabling each candidate independently — testing the entry with **each exit
alone, any combination, and entry-only** — never forcing all-on.

**Mechanism (Optimization only; no backend change — `_suggest_param` already handles int/float/
categorical):**

- **Candidate (selected) exit** → all of its `param_names` are emitted as **swept ranges** from
  `strategySearchSpace`, **including the `enable_param`/magnitude param**, whose range **must include
  `0`** (off) up to its max with a step, so `0` is a sampled grid point. The optimizer thus explores
  off ↔ magnitude for that exit, independently per candidate → arbitrary subsets/combinations. Shared
  params (`atr_period`) are included when a candidate requires them.
- **Non-candidate applicable exit** → `enable_param` pinned fixed `0` (off, excluded).
- **Entry params** → ranges, unchanged.

This is the original pre-WO76 flat behavior, scoped to selected candidates with the rest pinned off.
**Simulation is unaffected** (a single run applies its toggled exits concretely; there is no search).

> The candidate's `enable_param` is **never pinned to a single on-value** — that was the WO76 bug.
> It is a range whose low is `0`. `defaultSearchSpaceFromSpecs` already seeds exit params with
> `low = spec.min` (0 for exit params) plus a step, so `0` is a grid point; WO78 must force `low = 0`
> defensively for a candidate's enable param if a spec ever has `min > 0`.

### Simulation (WO77, depends on WO76)

- `StrategyStudio` drops the Entry/Exit tabs (and the auto-switch logic). Left column:
  `StrategyLibrary` (entry) + `ExitStrategyCards`. Right column: thesis + entry params
  (`StrategyParamFields` on `entryParamSpecs`) + enabled exits' param fields grouped
  (`resolveRuleParamSpecs` → `StrategyParamFields`) + the shared "Indicator Settings"
  (`atr_period`) shown once via `getVisibleSharedParamNames`.
- Enabled-state derives from the flat `strategyParams` bag via `isExitRuleEnabled` (no new
  state). Toggling uses a helper extracted from `ExitRuleCard` (sets `enable_param` to
  on-baseline or 0) applied through `handleParamChange`.
- `ExitConfigurator` is decomposed: cards → `ExitStrategyCards`, params → right panel; the
  combined component (and `ExitRuleCard`, if fully absorbed) is retired. The flat
  `strategyParams` bag stays the single source of truth; the run payload is unchanged.

## Work Orders

- **WO76** — Optimization exit cards + the shared `ExitStrategyCards` component (primary). ✅ shipped.
- **WO77** — Simulation: unify `StrategyStudio` to stacked entry+exit cards, reuse
  `ExitStrategyCards`, move exit params to the right panel, remove the Exit tab. ✅ shipped.
- **WO78** — **Correct the Optimization exit semantics**: a selected exit is a _candidate_ the
  optimizer turns on/off (sweep its enable/magnitude range incl. 0), not a forced-on pin.
  Optimization only.
- **WO88** — Exit cards reach full parity with entry cards via shared `LibraryCard` (grid layout,
  group tag chip, param count, click-to-toggle; switches removed). ✅ shipped.

## Out of scope

- Exit presets / ACTIVE-chip row in the unified layout (possible follow-up).
- Any backend / API change.
