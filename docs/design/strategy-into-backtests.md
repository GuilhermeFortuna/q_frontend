# Design — Fold the Strategy page into Backtests (tabbed Entry/Exit studio)

**Status:** implemented (WO73–WO75). Frontend-only (`q_frontend`); no backend
or API changes — the run/optimize paths already accept a base-strategy name + a flat
`strategy_params` bag that includes exit-rule params.

## Problem

Today there are two separate places:

- **`/strategy` — Strategy Workbench** (`StrategyWorkspace.tsx`): create/edit _custom_
  strategies. A saved-strategies rail + a form: Setup → **Entry parameters** → composable
  **Exit rules** (`ExitConfigurator`). It can save customs and "send to Backtests" via
  `setPendingBacktestConfig` + navigate.
- **`/backtests` — Backtests** (`BacktestsWorkspace.tsx`): Simulation/Optimization. Its
  Simulation setup picks a strategy (`StrategyLibrary`) and shows **all** params lumped
  together (`StrategyDetailPanel` → flat `StrategyParamFields`), then runs.

So the rich entry-vs-exit separation only exists on the standalone page, and authoring a
custom strategy is divorced from running it.

## Goal

The Strategy page lives **inside** the Backtests Simulation setup. The strategy area
becomes a **StrategyStudio** with two tabs — **Entry** and **Exit & Targets** — that
**default to Entry and auto-advance to Exit the moment a strategy is picked**, with manual
tab switching always available. Authoring (name/describe/save/edit/delete custom
strategies) has full parity, inline. The standalone `/strategy` route is removed and
redirected. Custom strategies remain selectable and optimizable in the Optimization tab.

## Key decisions (from brainstorming)

1. **Merge scope:** replace the Simulation setup's strategy area; remove the `/strategy` route.
2. **Custom strategies:** keep full save/edit parity, inline in the studio.
3. **Auto-switch trigger:** picking an entry strategy (built-in _or_ saved) → jump to Exit
   tab, every time; manual switch-back always available. Guard so the initial _programmatic_
   default selection never triggers it.
4. **Saved customs surface inside the library** as a "Saved/Custom" category — no separate rail.
5. **Optimization:** customs selectable + optimizable with the existing search-space UI
   (entry + exit params flat). No Entry/Exit tabs in Optimize. Saved customs appear in the
   Optimization setup strategy library (tagged **Custom** / **Saved** category) and in the
   walk-forward legacy `<select>` (suffix `— custom`). The optimize request uses
   `backtest.strategy = <customName>` with search space over the resolved entry + exit params.

## Architecture

```
BacktestSetupPanel (Simulation)
├─ MarketConfigBand                         (unchanged)
├─ StrategyStudio                           (NEW — replaces StrategyLibrary|StrategyDetailPanel)
│   ├─ authoring header: name · description · [New] [Save] [🗑 delete loaded]
│   ├─ Tabs: [ Entry ] [ Exit & Targets ]   (auto-advance + manual)
│   ├─ Entry: StrategyLibrary (+ Saved/Custom chip) | entry params + thesis
│   └─ Exit:  ExitConfigurator (reused as-is)
└─ Run Simulation                           (unchanged)
```

### State & data flow

- **Single source of truth stays the flat `strategyParams` bag** in `useBacktestConfig`.
  Entry tab edits the entry subset, Exit tab edits the exit subset — both through
  `handleParamChange`. Partition is derived per render via
  `partitionStrategyParamSpecs(selectedStrategy?.params)` + `useExitRuleCatalog()`.
- `useBacktestConfig` gains an **authoring slice**: `customName`, `description`,
  `loadedCustomName`, and `saveCustom()/deleteCustom()/newDraft()/loadCustom()` wrapping the
  existing `useCustomStrategies/useSaveCustomStrategy/useDeleteCustomStrategy`. `loadCustom`
  sets `strategy = base_strategy` and `strategyParams = parameters`.
- **Active tab** (`'entry' | 'exit'`) is local `useState` in StrategyStudio — the setup panel
  stays mounted across focus swaps (see `BacktestFocusWorkbench`), so it survives.
- Run path unchanged: `buildBacktestRequest` already serializes `strategy` + flat
  `strategy_params` (incl. exit params) — same payload the Workbench "Backtest" button
  already sends today.

### Reused as-is

`ExitConfigurator`, `ExitRuleCard`, `exitRuleSemantics`, `exitWorkbenchGroups`
(`partitionStrategyParamSpecs`), `StrategyParamFields`, `useExitRuleCatalog`,
`useCustomStrategies/useSaveCustomStrategy/useDeleteCustomStrategy`.

### Retired

`StrategyWorkspace.tsx`, `StrategyWorkbenchActionBar.tsx` (navigate-to-backtests now moot;
save logic moves into StrategyStudio), `StrategyDetailPanel.tsx` (folded into Entry tab),
`strategyRoute`, the `'strategy'` dock entry, `'strategy'` from `WorkspaceId`.

## Work Orders

- **WO73** — StrategyStudio: tabbed Entry/Exit editor + inline authoring, wired into the
  Simulation setup (the bulk).
- **WO74** — Custom strategies selectable & optimizable in the Optimization tab (guarantee + test).
- **WO75** — Retire the standalone `/strategy` page: route redirect, nav, type, file cleanup.

## Assumption to verify during WO73/WO74

A saved custom is returned by `useStrategies()` as a `StrategyInfo` whose `params` include
the base strategy's full (entry + exit) specs. The save mutation invalidates
`strategyKeys.list()`, strongly implying it appears in the list — confirm the param specs
are usable (entry + exit) before relying on it; if a custom only carries saved scalar values
without specs, `loadCustom` must merge specs from its `base_strategy`.
