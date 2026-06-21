# Design — Fold the Strategy page into Backtests (unified stacked-cards studio)

**Status:** implemented (WO73–WO75, layout updated WO77). Frontend-only (`q_frontend`); no backend
or API changes — the run/optimize paths already accept a base-strategy name + a flat
`strategy_params` bag that includes exit-rule params.

> **Layout update (WO77):** The original WO73 **Entry / Exit & Targets tabs** were superseded by a
> unified stacked-cards layout that mirrors Optimization — entry strategy cards + exit toggle cards
> in the left column, params on the right. See [exit-strategy-cards.md](./exit-strategy-cards.md).

## Problem

Today there are two separate places:

- **`/strategy` — Strategy Workbench** (`StrategyWorkspace.tsx`): create/edit _custom_
  strategies. A saved-strategies rail + a form: Setup → **Entry parameters** → composable
  **Exit rules**. It can save customs and "send to Backtests" via
  `setPendingBacktestConfig` + navigate.
- **`/backtests` — Backtests** (`BacktestsWorkspace.tsx`): Simulation/Optimization. Its
  Simulation setup picks a strategy (`StrategyLibrary`) and shows **all** params lumped
  together (`StrategyDetailPanel` → flat `StrategyParamFields`), then runs.

So the rich entry-vs-exit separation only exists on the standalone page, and authoring a
custom strategy is divorced from running it.

## Goal

The Strategy page lives **inside** the Backtests Simulation setup. The strategy area
becomes a **StrategyStudio** with **stacked entry + exit toggle cards** (same model as
Optimization — see `exit-strategy-cards.md`). Authoring (name/describe/save/edit/delete custom
strategies) has full parity, inline. The standalone `/strategy` route is removed and
redirected. Custom strategies remain selectable and optimizable in the Optimization tab.

## Key decisions (from brainstorming)

1. **Merge scope:** replace the Simulation setup's strategy area; remove the `/strategy` route.
2. **Custom strategies:** keep full save/edit parity, inline in the studio.
3. **Saved customs surface inside the library** as a "Saved/Custom" category — no separate rail.
4. **Optimization:** customs selectable + optimizable with exit toggle cards + search space
   (WO76). Saved customs appear in the Optimization setup strategy library (tagged **Custom** /
   **Saved** category) and in the walk-forward legacy `<select>` (suffix `— custom`). The optimize
   request uses `backtest.strategy = <customName>` with search space over the resolved entry + exit
   params.

## Architecture

```
BacktestSetupPanel (Simulation)
├─ MarketConfigBand                         (unchanged)
├─ StrategyStudio                           (replaces StrategyLibrary|StrategyDetailPanel)
│   ├─ authoring header: name · description · [New] [Save] [🗑 delete loaded]
│   ├─ Left: StrategyLibrary + ExitStrategyCards (stacked)
│   └─ Right: thesis + entry params + enabled exit value fields + shared indicator settings
└─ Run Simulation                           (unchanged)
```

### State & data flow

- **Single source of truth stays the flat `strategyParams` bag** in `useBacktestConfig`.
  Entry and exit params are edited through `handleParamChange`. Partition is derived per render via
  `partitionStrategyParamSpecs(selectedStrategy?.params)` + `useExitRuleCatalog()`.
- `useBacktestConfig` gains an **authoring slice**: `customName`, `description`,
  `loadedCustomName`, and `saveCustom()/deleteCustom()/newDraft()/loadCustom()` wrapping the
  existing `useCustomStrategies/useSaveCustomStrategy/useDeleteCustomStrategy`. `loadCustom`
  sets `strategy = base_strategy` and `strategyParams = parameters`.
- Run path unchanged: `buildBacktestRequest` already serializes `strategy` + flat
  `strategy_params` (incl. exit params) — same payload the Workbench "Backtest" button
  already sends today.

### Reused as-is

`ExitStrategyCards`, `exitRuleSemantics`, `exitWorkbenchGroups`
(`partitionStrategyParamSpecs`), `StrategyParamFields`, `useExitRuleCatalog`,
`useCustomStrategies/useSaveCustomStrategy/useDeleteCustomStrategy`.

### Retired

`StrategyWorkspace.tsx`, `StrategyWorkbenchActionBar.tsx` (navigate-to-backtests now moot;
save logic moves into StrategyStudio), `StrategyDetailPanel.tsx` (folded into studio right column),
`ExitConfigurator.tsx`, `ExitRuleCard.tsx` (replaced by `ExitStrategyCards` + right-panel params,
WO77), `strategyRoute`, the `'strategy'` dock entry, `'strategy'` from `WorkspaceId`.

## Work Orders

- **WO73** — StrategyStudio: tabbed Entry/Exit editor + inline authoring, wired into the
  Simulation setup (superseded layout-wise by WO77).
- **WO74** — Custom strategies selectable & optimizable in the Optimization tab (guarantee + test).
- **WO75** — Retire the standalone `/strategy` page: route redirect, nav, type, file cleanup.
- **WO76** — Shared `ExitStrategyCards` + Optimization exit toggles.
- **WO77** — Unify Simulation studio to stacked entry + exit cards (mirror Optimize).

## Assumption to verify during WO73/WO74

A saved custom is returned by `useStrategies()` as a `StrategyInfo` whose `params` include
the base strategy's full (entry + exit) specs. The save mutation invalidates
`strategyKeys.list()`, strongly implying it appears in the list — confirm the param specs
are usable (entry + exit) before relying on it; if a custom only carries saved scalar values
without specs, `loadCustom` must merge specs from its `base_strategy`.
