# WO76 — Frontend: exit strategies as toggle cards in the Optimization setup (+ shared ExitStrategyCards)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`
  - (`pnpm test` is watch mode — use `pnpm test:run` for a single pass.)

**Context for this work:** in the Backtests **Optimization** setup, the left column is a card library
of _entry_ strategies, but the right "Search Space" panel dumps **every** exit param (Stop Loss %,
Stop Loss ATR, Take Profit, …) as flat range fields regardless of whether the user wants that exit.
This WO adds **exit strategies as multi-select toggle cards** below the entry cards, and makes the
Search Space show **only enabled exits' params**. It also creates the **shared `ExitStrategyCards`
component** that WO77 reuses for Simulation.

This is **frontend-only**. No backend/API change — the optimization payload shape is unchanged; we
only control which `strategy_params` search params it carries.

Read the design doc first: `q_frontend/docs/design/exit-strategy-cards.md`.

**Sibling WO:** WO77 (Simulation) **depends on this WO's `ExitStrategyCards`** — build the shared
component here with no Optimize-specific logic baked in.

---

## How the pieces work today (read these files)

- `src/components/optimize/setup/OptimizeSetupPanel.tsx` — left `StrategyLibrary` (entry) + right
  `OptimizeStrategyDetailPanel`, in a 2-col grid.
- `src/components/optimize/setup/OptimizeStrategyDetailPanel.tsx` — renders `StrategySearchSpaceFields`
  for **all** `selectedStrategy.params`.
- `src/components/optimize/StrategySearchSpaceFields.tsx` — `{ params, state, onChange }` → range fields.
- `src/lib/optimize/useOptimizeConfig.ts` — `strategy`, `strategySearchSpace` state,
  `selectedStrategy` (already custom-resolved via `withResolvedCustomStrategyParams`), the
  search-space init effect (`searchSpaceInitialized`), and **`buildOptimizationConfigPayload`** (~line 491) which sets `config.search_space.strategy_params = searchSpaceToPayload(strategySearchSpace,
selectedStrategy.params)`.
- `src/lib/strategies/strategyParams.ts` — `searchSpaceToPayload(state, specs)` emits a `SearchParam`
  per spec that has a `state[spec.name]` entry; `SearchSpaceFieldState`.
- `src/api/queries/strategies.ts` — `useExitRuleCatalog()` (`exit_rules`, `shared_exit_params`,
  `exit_presets`).
- `src/workspaces/strategy/exitRuleSemantics.ts` — **reuse**: `isExitRuleEnabled`,
  `defaultEnableValue`, `resolveRuleParamSpecs`, `groupExitRules`, `getVisibleSharedParamNames`.
- `src/workspaces/strategy/exitWorkbenchGroups.ts` — `partitionStrategyParamSpecs` (entry vs exit
  specs), `EXIT_GROUP_ORDER/LABELS`.
- `src/workspaces/strategy/ExitRuleCard.tsx` — the toggle-card **visual language** to match (on/off
  dot, `role="switch"`/`aria-checked`, label + description). Do not import it (it carries inline
  params); mirror its switch look in the new component.
- `src/types/strategies.ts` — `ExitRuleInfo` (`id`, `label`, `description`, `exit_group`,
  `enable_param`, `enable_value`, `param_names`, `required_param_names`).

---

## Goal

```
left column                          right column (Search Space)
┌ Strategy (entry, 1-pick) ───┐      entry param ranges (always)
│ ▢card ▢card ▢card …          │      ── ATR Stop ──
│ ───────────────────────────  │       stop_loss_atr [lo][hi][step]
│ Exit Strategies (toggle)    │      ── Profit Targets ──
│ ⦿ ATR Stop  ○ Fixed Stop    │       take_profit_pct [lo][hi][step]
│ ○ Chandelier ⦿ Take Profit  │      Indicator Settings: atr_period …
└─────────────────────────────┘      (disabled exits → no fields, pinned off)
```

## Tasks

### 1. Shared `ExitStrategyCards` component

New `src/components/backtests/setup/ExitStrategyCards.tsx` — presentational, **no business logic**.
Props:

- `rules: ExitRuleInfo[]` — already filtered to the selected strategy (caller's job).
- `isEnabled: (rule: ExitRuleInfo) => boolean`
- `onToggle: (rule: ExitRuleInfo) => void`
- optional `heading?: string` (default "Exit Strategies").

Render rules grouped by `groupExitRules(rules)`, each group with its `EXIT_GROUP_LABELS` label; each
rule a multi-select toggle card matching `ExitRuleCard`'s switch visuals (`role="switch"`,
`aria-checked`, keyboard-operable, on/off dot, label + one-line description). Empty `rules` → render
nothing (caller shows context).

### 2. Enabled-exit state in `useOptimizeConfig`

- Add `useExitRuleCatalog()`.
- Derive `exitParamSpecs` from `partitionStrategyParamSpecs(selectedStrategy?.params ?? [])`.
- `applicableExitRules` = catalog `exit_rules` whose `enable_param` exists in `exitParamSpecs`
  (use `resolveRuleParamSpecs` / presence of the enable spec).
- Add `enabledExitRuleIds: Set<string>` state + `toggleExitRule(ruleId)`.
- **Initialize** the enabled set when the strategy changes: rules whose `enable_param` spec
  `default > 0` (preserves today's behavior; user can toggle). Reset/recompute on strategy change.
- Keep the existing search-space init populating ranges for **all** params (so a toggled-on exit has
  ready ranges); inclusion is gated later.
- Expose `applicableExitRules`, `enabledExitRuleIds`, `toggleExitRule`, and `entryParamSpecs` /
  `enabledExitParamSpecs` (entry specs + specs of enabled rules + shared `atr_period` when required
  via `getVisibleSharedParamNames`) for the panel.

### 3. Toggle-into-search-space payload

In `buildOptimizationConfigPayload`, build `search_space.strategy_params` from:

- entry param specs + **enabled** rules' tunable specs (their `param_names` minus `enable_param`,
  plus shared params they require) → `searchSpaceToPayload(strategySearchSpace, thoseSpecs)`;
- **pin enable params as fixed search params**: for each enabled applicable rule, add
  `{ [enable_param]: <fixed on-value> }`; for each disabled applicable rule, add
  `{ [enable_param]: <fixed 0> }`. "Fixed" = a degenerate range (`int`/`float` `low===high`, or a
  categorical with one choice) so the optimizer holds it constant. On-value = `enable_value` if > 0
  else `defaultEnableValue(enableSpec)`.

> Disabled exits MUST be pinned `0`, not omitted — some strategies default an exit on (WO69), and
> omission would let it leak into the run.

### 4. Wire the panel

- `OptimizeSetupPanel`: under `StrategyLibrary` in the left column, render `<ExitStrategyCards
rules={config.applicableExitRules} isEnabled={(r) => config.enabledExitRuleIds.has(r.id)}
onToggle={(r) => config.toggleExitRule(r.id)} />`.
- `OptimizeStrategyDetailPanel`: render `StrategySearchSpaceFields` for **entry params + enabled
  exits' params** (grouped with headers), not all params. When no exits enabled, show entry params +
  a hint: "Toggle an exit strategy to optimize its parameters."

## Guardrails

> **Payload shape unchanged.** Still `search_space.strategy_params` of `SearchParam`s +
> `risk_params`. We only change _which_ params are present and pin enable flags. No backend change.

> **Disabled = pinned off.** Every applicable exit's `enable_param` is present in the payload (on for
> enabled, `0` for disabled). Assert this in a test.

> **Shared component stays generic.** `ExitStrategyCards` has no optimize/sim-specific logic — WO77
> reuses it. No `strategySearchSpace` or `strategyParams` references inside it.

> **Custom strategies keep working.** `selectedStrategy` is already custom-resolved; exit cards +
> ranges must work for a saved custom too (cover in a test).

> **Accessibility.** Cards are real switches (`role="switch"`, `aria-checked`, keyboard).

## Tests — `tests/unit/` (Vitest)

- `ExitStrategyCards`: renders one group per present `exit_group`; reflects `isEnabled`; clicking
  fires `onToggle`; empty rules → nothing.
- `useOptimizeConfig`: `applicableExitRules` excludes rules whose enable param isn't on the strategy;
  enabled set initializes from default-on rules; `toggleExitRule` flips membership.
- Payload: enabled exit → its tunable params present as ranges + `enable_param` pinned on; disabled
  applicable exit → `enable_param` pinned `0` and its tunable params absent; entry params always
  present. Cover a custom strategy too.
- Panel: detail panel shows only entry + enabled-exit fields; empty-exit hint when none enabled.

## Docs

`q_frontend/docs/design/exit-strategy-cards.md` is the source of truth; update it only if you diverge.

---

## Definition of done

- `pnpm test:run` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all three pass.**
- Manually (`./dev.sh`, Backtests → Optimization): exit cards show below entry cards; toggling one
  adds/removes its ranges on the right; disabled exits contribute nothing; start an optimization.
- Paste in the final message: the `ExitStrategyCards` prop contract, the `useOptimizeConfig` exit
  additions, and the enable-pinning rule (on-value + disabled→0) with the payload snippet.

## Out of scope

- Simulation `StrategyStudio` changes — **WO77** (reuses `ExitStrategyCards`).
- Exit presets / ACTIVE-chip row.
- Any backend/API change.
