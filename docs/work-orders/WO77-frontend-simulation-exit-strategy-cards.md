# WO77 — Frontend: unify Simulation StrategyStudio to stacked entry + exit cards (mirror Optimize)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`

**Context for this work:** WO76 added exit **toggle cards** to the Optimization setup and a shared
`ExitStrategyCards` component. This WO makes the **Simulation** setup match: remove the **Entry / Exit
& Targets tabs** from `StrategyStudio` and instead stack **entry strategy cards** (single-select) and
**exit strategy cards** (multi-toggle) in the left column, with **entry params + enabled exits' value
fields** on the right.

> This **supersedes the Entry/Exit tab** introduced in `strategy-into-backtests` (WO73). The
> auto-switch-to-Exit behavior goes away (there are no tabs). The `ExitConfigurator` presets +
> ACTIVE-chip row are **dropped** for consistency with Optimize (accepted in design review).

This is **frontend-only**. The flat `strategyParams` bag stays the single source of truth and the run
payload is unchanged. Read the design doc first: `q_frontend/docs/design/exit-strategy-cards.md`.

**Depends on WO76** (the shared `ExitStrategyCards` + the design). Do WO76 first.

---

## How the pieces work today (read these files)

- `src/components/backtests/setup/StrategyStudio.tsx` — current tabbed studio (authoring header +
  Entry/Exit tabs; Entry = `StrategyLibrary` + entry params + thesis; Exit = `ExitConfigurator`;
  `activeTab` state + auto-switch in `handleSelectBuiltIn`/`handleSelectCustom`).
- `src/components/backtests/setup/ExitStrategyCards.tsx` — **shared toggle cards from WO76. Reuse.**
- `src/lib/backtesting/useBacktestConfig.ts` — already exposes `entryParamSpecs`, `exitParamSpecs`,
  `exitCatalog`, `selectedStrategy`, `fields.strategyParams`, `setters.handleParamChange`, and the
  `authoring` slice.
- `src/workspaces/strategy/exitRuleSemantics.ts` — `isExitRuleEnabled`, `defaultEnableValue`,
  `resolveRuleParamSpecs`, `groupExitRules`, `getEnabledExitRules`, `getVisibleSharedParamNames`.
- `src/workspaces/strategy/ExitConfigurator.tsx` + `ExitRuleCard.tsx` — current Exit-tab UI. The
  toggle/enable logic in `ExitRuleCard` (enable → `enable_value`/`defaultEnableValue`; disable → `0`)
  must be **extracted into a reusable helper** (see Task 2) so both the new card toggle and tests use
  it. These two components are **retired** once unused (Task 5).
- `src/components/shared/StrategyParamFields.tsx` — value-field renderer for the right panel.
- `tests/unit/components/StrategyStudio.test.tsx` — existing tab/auto-switch tests to rewrite.

---

## Goal

```
left column                          right column
┌ Strategy (entry, 1-pick) ───┐      thesis (collapsible)
│ ▢card ▢card ▢card …          │      ENTRY params (StrategyParamFields)
│ ───────────────────────────  │      ── Stop Loss ──
│ Exit Strategies (toggle)    │       stop_loss_atr  [value]
│ ⦿ ATR Stop  ○ Fixed Stop    │      ── Profit Targets ──
│ ○ Chandelier ⦿ Take Profit  │       take_profit_pct [value]
└─────────────────────────────┘      Indicator Settings: atr_period [value]
   (authoring header stays on top: Name · Desc · New · Save · 🗑)
```

## Tasks

### 1. Extract the enable/disable toggle helper

Add `toggleExitRuleParam(rule, paramValues, onChange)` (or a pure `exitRuleEnableUpdate(rule,
enabled, specs)` returning the `{ [enable_param]: value }` patch) to `exitRuleSemantics.ts`,
capturing today's `ExitRuleCard` logic: enable → `enable_value` if > 0 else
`defaultEnableValue(enableSpec)`; disable → `0`. Unit-test it.

### 2. Rebuild `StrategyStudio` layout (remove tabs)

- **Remove** `activeTab` state, `StudioTabButton`, the tablist, and the auto-switch in the select
  handlers. Keep the authoring header (Name/Desc/New/Save/🗑 + error) exactly as-is.
- **Left column:** `StrategyLibrary` (entry, single-select, unchanged props incl. Saved/Custom) with
  `<ExitStrategyCards>` stacked below it:
  - `rules` = `exitCatalog.exit_rules` filtered to those whose `enable_param` exists in
    `exitParamSpecs` (applicable to the strategy).
  - `isEnabled={(r) => isExitRuleEnabled(r, fields.strategyParams)}`.
  - `onToggle={(r) => /* apply the Task-1 helper via handleParamChange */}`.
- **Right column:** thesis (existing collapse) + entry params (`StrategyParamFields` on
  `entryParamSpecs`, `showHints` compact) + for each **enabled** rule, a small group (label from
  `EXIT_GROUP_LABELS`/rule label) rendering `StrategyParamFields` over `resolveRuleParamSpecs(rule,
exitParamSpecs)` (exclude the enable param itself) + a single **Indicator Settings** block for
  shared params via `getVisibleSharedParamNames` (e.g. `atr_period`), shown once when required.
- Selecting a strategy (built-in or custom) keeps its existing behavior minus the tab switch.

### 3. Keep the flat bag as the source of truth

All entry + exit + enable params continue to live in `fields.strategyParams`, edited via
`handleParamChange`. No second bag, no payload change. Loading a saved custom must light up the
correct enabled exit cards + their values (round-trip).

### 4. Empty / loading states

- No applicable exits → render the entry side only (no empty exit section noise).
- Exit catalog loading → a small "Loading exits…" affordance under the entry cards.

### 5. Retire the now-unused Exit-tab components

After wiring, `grep` for imports of `ExitConfigurator` and `ExitRuleCard`. If unused, **delete**
`src/workspaces/strategy/ExitConfigurator.tsx` and `src/workspaces/strategy/ExitRuleCard.tsx` (and
their tests). **Keep** `exitRuleSemantics.ts` and `exitWorkbenchGroups.ts` (still used). If anything
still imports them, stop and resolve before deleting.

## Guardrails

> **Mirror Optimize.** Same shared `ExitStrategyCards`, same toggle-into-params model. Don't fork a
> second card component.

> **Flat bag + payload unchanged.** `buildBacktestRequest` is untouched; only the editing UI changes.

> **Saved-custom round-trip.** Loading a custom with enabled exits shows those cards on + their values
> on the right. Cover in a test.

> **Tabs are gone.** No `role="tab"`, no auto-switch. Update/replace the tab tests rather than leaving
> them.

> **Accessibility.** Exit cards are real switches (`role="switch"`, `aria-checked`, keyboard).

> **Dropped on purpose:** `ExitConfigurator` presets + ACTIVE-chip row are not reimplemented (design
> decision). Don't add them back in this WO.

## Tests — `tests/unit/components/StrategyStudio.test.tsx` (rewrite) + `exitRuleSemantics`

- Rewrite tab tests: studio renders entry cards + exit cards in one column (no tablist).
- Toggling an exit card on sets its `enable_param` to the on-baseline and reveals its value fields on
  the right; toggling off zeroes it and hides them.
- Editing an entry param and an enabled-exit param both write into the same `strategyParams` bag.
- Loading a saved custom shows its enabled exits on with correct values (round-trip).
- `atr_period` (Indicator Settings) appears only when an enabled rule requires it.
- The Task-1 enable/disable helper unit test (on-value vs 0).

## Docs

Update `q_frontend/docs/design/strategy-into-backtests.md` to note the Entry/Exit tab was superseded
by the unified stacked-cards layout (cross-link `exit-strategy-cards.md`). Keep
`exit-strategy-cards.md` as the source of truth.

---

## Definition of done

- `pnpm test:run` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all three pass.**
- Manually (`./dev.sh`, Backtests → Simulation): no Exit tab; entry cards + exit cards stacked; toggle
  an exit → its value fields appear on the right; load a saved custom and see its exits light up; Run
  Simulation works.
- Paste in the final message: the new `StrategyStudio` structure, the extracted enable/disable helper
  signature, and confirmation of which components were deleted (and that `exitRuleSemantics` /
  `exitWorkbenchGroups` were kept).

## Out of scope

- Optimization exit cards + `ExitStrategyCards` creation — **WO76**.
- Exit presets / ACTIVE-chip row (dropped).
- Any backend/API change.
