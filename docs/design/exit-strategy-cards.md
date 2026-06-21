# Design — Exit strategies as toggle cards (Optimization + Simulation)

**Status:** approved design, drives WO76–WO77. Frontend-only (`q_frontend`); no backend or
API changes — the run/optimize payloads are unchanged in shape.

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
- **Exit cards:** multi-select toggles, sourced from the exit-rule catalog
  (`useExitRuleCatalog`), grouped by `exit_group` (Stop Loss / Trailing / Targets / Time),
  filtered to rules whose params exist on the selected strategy.
- **Toggle-into-params:** enabling an exit reveals its params on the right (values in
  Simulation, ranges in Optimization). Disabling **hides its params and pins the exit off**.

## Key decisions (from brainstorming)

1. **Scope:** both tabs. Optimization first (the gap the user saw); Simulation aligned to match.
2. **Exit card behavior:** toggle into the params/search space. Disabled exits show no params
   and are pinned off (not left to a possibly-on strategy default).
3. **Simulation:** "mirror Optimize" — remove the Entry/Exit tab; entry cards + exit toggle
   cards stacked in the left column, params on the right. This **supersedes the Entry/Exit tab
   from the `strategy-into-backtests` design (WO73).** Presets + ACTIVE-chip row from
   `ExitConfigurator` are dropped in the unified layout (possible later follow-up).
4. **Reuse:** a single shared `ExitStrategyCards` component + the existing `exitRuleSemantics`
   helpers drive both tabs.

## Architecture

### Shared

`src/components/backtests/setup/ExitStrategyCards.tsx` (new) — presentational multi-select
toggle cards, grouped via `groupExitRules`, card visual matching the entry `StrategyCard`
(label + description + on/off state, `aria-pressed`). Props: `rules` (already filtered),
`isEnabled(rule) => boolean`, `onToggle(rule) => void`, optional heading. No business logic —
each tab supplies enabled-state + toggle behavior.

Reused helpers (`src/workspaces/strategy/exitRuleSemantics.ts`): `isExitRuleEnabled`,
`defaultEnableValue`, `resolveRuleParamSpecs`, `groupExitRules`, `getEnabledExitRules`,
`getVisibleSharedParamNames`; plus `partitionStrategyParamSpecs` / `groupExitParamSpecs` /
`EXIT_GROUP_ORDER` from `exitWorkbenchGroups.ts`.

### Optimization (WO76)

- `useOptimizeConfig` gains `useExitRuleCatalog`, an explicit `enabledExitRuleIds: Set<string>`
  - `toggleExitRule(id)`, and exit cards derived from the catalog filtered to
    `selectedStrategy.params`. Enabled set initializes from the strategy's defaults (rules whose
    enable default > 0) so today's behavior is preserved but now toggleable.
- Right panel (`OptimizeStrategyDetailPanel` via `StrategySearchSpaceFields`) shows entry params
  - enabled exits' params only.
- `buildOptimizationConfigPayload` builds `search_space.strategy_params` from entry params +
  enabled exits' params; each **enabled** exit's `enable_param` is pinned on
  (`enable_value`/`defaultEnableValue`, as a fixed single-value search param), each **disabled**
  exit's `enable_param` is pinned `0`.

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

- **WO76** — Optimization exit cards + the shared `ExitStrategyCards` component (primary).
- **WO77** — Simulation: unify `StrategyStudio` to stacked entry+exit cards, reuse
  `ExitStrategyCards`, move exit params to the right panel, remove the Exit tab.

## Out of scope

- Exit presets / ACTIVE-chip row in the unified layout (possible follow-up).
- Any backend / API change.
