# WO73 — Frontend: StrategyStudio — tabbed Entry/Exit strategy editor inside Backtests Simulation

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context for this work:** the standalone Strategy Workbench (`/strategy`) is being folded into
the Backtests **Simulation** setup. This WO does the bulk: replace the Simulation setup's strategy
area (`StrategyLibrary | StrategyDetailPanel`) with a new **StrategyStudio** that has **Entry** and
**Exit & Targets** tabs — defaulting to Entry and **auto-advancing to Exit when a strategy is
picked** (manual switching always available) — plus inline custom-strategy authoring (name /
describe / save / edit / delete) at full parity with today's Workbench.

This is **frontend-only**. No backend or API change: the run path already serializes a base-strategy
name + a flat `strategy_params` bag that includes exit-rule params (it's exactly what the Workbench
"Backtest" button sends today via `setPendingBacktestConfig`).

Read the design doc first: `q_frontend/docs/design/strategy-into-backtests.md`.

**Sibling WOs:** removing the `/strategy` route + nav is **WO75** (do this WO first, then WO75 so the
old page isn't removed before its replacement works). Optimization-tab custom support is **WO74**.

---

## How the pieces work today (read these files)

- `src/components/backtests/setup/BacktestSetupPanel.tsx` — Simulation setup form: `MarketConfigBand`
  on top, then the `StrategyLibrary | StrategyDetailPanel` grid, then the Run button.
- `src/components/backtests/setup/StrategyLibrary.tsx` — card grid with category chips; selecting a
  card calls `onSelectStrategy(name)`. Filters by `engine`.
- `src/components/backtests/setup/StrategyDetailPanel.tsx` — thesis + **all** params via flat
  `StrategyParamFields`. **Folded into the new Entry tab; this file is removed in this WO.**
- `src/lib/backtesting/useBacktestConfig.ts` — single source of strategy state: `strategy` name +
  flat `strategyParams` bag, `handleStrategyChange`, `handleParamChange`, `selectedStrategy`,
  `buildRequest`. The default strategy is auto-selected programmatically (see the `paramsInitialized`
  effect) — **that programmatic default must NOT trigger the auto-switch to Exit.**
- `src/workspaces/strategy/StrategyWorkspace.tsx` — **source of the authoring + partitioning logic to
  port**: entry/exit split via `partitionStrategyParamSpecs`, `enabledExitCount`, thesis collapse,
  name/description/save/delete/new, error handling.
- `src/workspaces/strategy/ExitConfigurator.tsx` — composable exits + targets. **Reuse as-is** in the
  Exit tab (props: `exitRules`, `sharedExitParams`, `exitPresets`, `exitParamSpecs`, `paramValues`,
  `onChange`, `onParamsMerge`).
- `src/workspaces/strategy/exitWorkbenchGroups.ts` — `partitionStrategyParamSpecs(params)` →
  `{ entryParamSpecs, exitParamSpecs }`.
- `src/api/queries/strategies.ts` — `useExitRuleCatalog()` (catalog: `exit_rules`,
  `shared_exit_params`, `exit_presets`).
- `src/api/queries/customStrategies.ts` — `useCustomStrategies`, `useSaveCustomStrategy`,
  `useDeleteCustomStrategy` (POST/DELETE `/api/v1/strategies/custom`; both invalidate
  `strategyKeys.list()` so saved customs reappear in `useStrategies()`).
- `src/components/shared/StrategyParamFields.tsx` — generic param renderer; reuse for entry params.
- `src/components/backtests/focus/BacktestFocusWorkbench.tsx` — note the setup panel **stays mounted**
  across focus swaps, so local tab state in StrategyStudio survives.

---

## Goal

```
┌─ Strategy Studio ───────────────────────────────────────────────┐
│  Name [____________]  Desc [____________]      [New] [Save] [🗑] │
│  ┌──────────┬──────────────────┐                                │
│  │  Entry   │  Exit & Targets  │   tabs: default Entry,         │
│  └──────────┴──────────────────┘   auto→Exit on pick, manual ok │
│  ENTRY:  StrategyLibrary (+Saved chip) | entry params + thesis   │
│  EXIT :  <ExitConfigurator .../>  (composable exits + targets)   │
└──────────────────────────────────────────────────────────────────┘
```

Pick any card (built-in or Saved) → studio jumps to **Exit & Targets**; the tab header is always
clickable to return to **Entry**. Saving upserts a custom; loading a Saved card populates
name/description for editing and lights up its entry params + enabled exits.

## Tasks

### 1. Extend `useBacktestConfig` with partitioning + exit catalog

Add, derived from the existing `selectedStrategy` + flat `strategyParams`:

- `entryParamSpecs` / `exitParamSpecs` via `partitionStrategyParamSpecs(selectedStrategy?.params ?? [])`.
- `exitCatalog` + `exitCatalogLoading` from `useExitRuleCatalog()`.

Keep `strategyParams` the **single source of truth** — do not split it into two bags.

### 2. Add a custom-strategy authoring slice to `useBacktestConfig`

State: `customName`, `description`, `loadedCustomName` (the saved name currently being edited, or
`null`). Actions (wrapping `useCustomStrategies/useSaveCustomStrategy/useDeleteCustomStrategy`):

- `newDraft()` — clears `loadedCustomName`, `customName`, `description`; leaves the picked strategy +
  params (a fresh authoring draft on top of the current selection).
- `loadCustom(custom)` — sets `loadedCustomName`/`customName`/`description`, **`strategy =
custom.base_strategy`**, and `strategyParams = custom.parameters` (merge over the base specs'
  defaults so any missing keys fall back to spec defaults — see the design-doc assumption).
- `saveCustom()` — validates name (non-empty, not colliding with a built-in or another custom unless
  editing that same one), POSTs `{ name, base_strategy: strategy, description, parameters:
strategyParams }`, sets `loadedCustomName` on success; surfaces an error string on failure
  (mirror `StrategyWorkspace.handleSave`).
- `deleteCustom(name)` — deletes, and if it was loaded, `newDraft()`.

Expose `customStrategies` + `customLoading` for the library's Saved category.

### 3. Build `StrategyStudio` component

New `src/components/backtests/setup/StrategyStudio.tsx`. Props: the `useBacktestConfig` return (or
the slices it needs). Render:

- **Authoring header:** Name + Description inputs (Name disabled while editing a loaded custom, like
  today), `New` / `Save` (disabled while saving / when name empty) / delete-loaded (🗑, only when a
  custom is loaded), and an inline error region.
- **Tabs** `[ Entry ] [ Exit & Targets ]`: local `useState<'entry' | 'exit'>('entry')`. Real
  buttons, `role="tab"`/`aria-selected`. The Exit tab label may show the enabled-exit count.
- **Entry tab:** `StrategyLibrary` (Task 4) on one side; on the other, the strategy thesis (collapse
  behavior from `StrategyWorkspace`) + entry params via `StrategyParamFields` using `entryParamSpecs`
  (`showHints`, `hintMode="compact"`). Empty state when no entry params.
- **Exit tab:** `<ExitConfigurator>` fed from `exitCatalog` + `exitParamSpecs` + `strategyParams` +
  `handleParamChange` + a params-merge handler. Loading/empty states mirror today's Strategy page.

### 4. Auto-switch + Saved/Custom in the library

- Wrap the strategy-pick handler so a **user** selection sets the tab to `'exit'`. The **initial
  programmatic default** selection (the `useBacktestConfig` default effect) must NOT switch tabs —
  gate the auto-switch behind a "user has interacted" flag or trigger it only from the library's
  click handler (not from a hydration/default effect).
- In `StrategyLibrary`, add a **"Saved"** (custom) category chip so saved customs show as cards
  (tag them visually as custom). Selecting a custom calls `loadCustom`; selecting a built-in clears
  to a draft on that strategy. A custom card exposes a delete affordance calling `deleteCustom`.

### 5. Wire into `BacktestSetupPanel`

Replace the `StrategyLibrary | StrategyDetailPanel` grid with `<StrategyStudio .../>`. Keep
`MarketConfigBand` and the Run Simulation button untouched. **Delete
`src/components/backtests/setup/StrategyDetailPanel.tsx`** and its test.

## Guardrails

> **Flat param dict is the contract.** `strategyParams` stays the single source of truth; both tabs
> write into it via `handleParamChange`. `buildBacktestRequest` / the run payload do not change.

> **Auto-switch only on user intent.** Picking a strategy switches to Exit; the programmatic default
> selection on load must leave the studio on the Entry tab. Add a test that proves the default does
> not switch.

> **Tab state survives focus swaps.** The setup panel stays mounted (`BacktestFocusWorkbench`); keep
> tab state in StrategyStudio so swapping to Results and back preserves Entry/Exit position.

> **Saved-strategy round-trip.** Loading a custom must light up its entry params AND its enabled
> exits (the same flat bag the run uses). Cover with a test.

> **Reuse, don't reinvent.** Use `ExitConfigurator`, `StrategyParamFields`,
> `partitionStrategyParamSpecs`, `useExitRuleCatalog`, and the custom-strategy queries as-is. No new
> exit logic, no hard-coded exit param names (grep for `stop_loss_pct` etc. in the new files → none).

> **Accessibility.** Tabs are keyboard-operable with `role="tab"`/`aria-selected`; delete/save/new
> are buttons.

## Tests — `tests/unit/` (Vitest)

New `tests/unit/components/StrategyStudio.test.tsx`:

- Default tab is **Entry**; the programmatic default strategy selection does **not** switch to Exit.
- A user picking a strategy card switches to **Exit & Targets**; clicking the **Entry** tab switches back.
- Editing an entry param writes only the entry subset; the Exit tab renders `ExitConfigurator` and
  editing there updates the same flat bag.
- Inline authoring: `Save` posts `{ name, base_strategy, description, parameters }`; name collision
  with a built-in/existing custom errors; `New` clears the draft; deleting the loaded custom resets.
- Loading a Saved custom populates name/description, sets the base strategy, and shows its enabled
  exits (round-trip).

Update `tests/unit/components/BacktestSetupPanel.test.tsx` and
`tests/unit/workspaces/BacktestsWorkspace.test.tsx` for the new structure; remove the
`StrategyDetailPanel` test.

## Docs

Update `q_frontend/docs/design/strategy-into-backtests.md` status if anything diverges. Note in the
backtests/README that strategy authoring now lives in the Simulation setup.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all three pass.**
- Manually (`./dev.sh`, Backtests → Simulation): pick a strategy → studio jumps to Exit; switch back
  to Entry; tune entry + exit params; Save a custom; reload it from the Saved cards; Run Simulation
  produces results. Swapping to Results and back preserves the active tab.
- Paste in the final message: the `useBacktestConfig` authoring-slice API (state + action
  signatures), the `StrategyStudio` structure, and the exact rule that prevents the programmatic
  default selection from auto-switching to Exit.

## Out of scope

- Removing the `/strategy` route, dock entry, `WorkspaceId` member, and `StrategyWorkspace.tsx` /
  `StrategyWorkbenchActionBar.tsx` — **WO75**.
- Optimization-tab custom-strategy support — **WO74**.
- Any backend/API change (run + custom-strategy endpoints already exist).
