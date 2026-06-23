# WO88 — Frontend: exit strategies as first-class cards (Simulation + Optimize)

## Shared context (read first)

Two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, `uv`. NEVER pip/poetry. (Not touched here.)
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`. NEVER npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`
  - (`pnpm test` is watch mode — use `pnpm test:run`.)

**Context:** WO76/WO77 introduced exits as a lightweight **toggle list** (`ExitStrategyCards`):
full-width stacked rows, each with a label, description, and an on/off switch. Entry strategies,
by contrast, are rich **selectable cards** in a grid (category tag, description, "N params",
click-to-select → params/search-space in the right detail panel). The user's verdict: explicit
exit strategies are **not** being treated as first-class citizens. This WO brings exit cards to
**full parity** with entry cards, in both the **Simulation** (`StrategyStudio`) and **Optimization**
(`OptimizeSetupPanel`) setups.

**Frontend-only.** The flat `strategyParams` bag stays the single source of truth and the
run/optimize payloads are unchanged in shape (we only flip which exits are enabled/searched).

**Sibling:** WO89 (Discovery results show entry + exit) — independent, can land in parallel.
Supersedes the WO76/WO77 toggle-list treatment and `docs/design/exit-strategy-cards.md`'s
"toggle cards" decision (cards become first-class selectable cards; **no toggle switch**).

## How the pieces work today (read these files)

- `src/components/backtests/setup/ExitStrategyCards.tsx` — the shared component to redesign.
  Currently renders `groupExitRules(rules)` as stacked `<article>` rows, each with a `role="switch"`
  toggle. Props: `{ rules, isEnabled, onToggle, heading }`.
- `src/components/backtests/setup/StrategyLibrary.tsx` — entry card grid (the visual target to
  mirror): 3-col grid, each card shows name + category **tag chip** + `strategyCardDescription` +
  "N params"; selected card is highlighted; click → `onSelectBuiltIn`.
- `src/components/backtests/setup/StrategyStudio.tsx` — Simulation setup. Already:
  computes `applicableExitRules` (`filterApplicableExitRules`), `enabledExitRules`
  (`getEnabledExitRules`); renders `<ExitStrategyCards … onToggle={handleToggleExitRule}/>` in the
  left column and **already stacks each enabled exit's params on the right** via
  `enabledExitRules.map(... <StrategyParamFields/> ...)`. `handleToggleExitRule` calls
  `toggleExitRuleParam`.
- `src/components/optimize/setup/OptimizeSetupPanel.tsx` — Optimization setup. Left column =
  `StrategyLibrary` + `ExitStrategyCards` (heading "Exit Strategies — searched (on/off)",
  `isEnabled` from `candidateExitRuleIds`, `onToggle={toggleExitRule}`); right =
  `OptimizeStrategyDetailPanel`.
- `src/components/optimize/setup/OptimizeStrategyDetailPanel.tsx` — **already stacks** enabled
  exits' search-space ranges on the right (`groupExitParamSpecs(candidateExitParamSpecs)` →
  `StrategySearchSpaceFields`). Shows the "Select an exit strategy to include it…" hint.
- `src/workspaces/strategy/exitRuleSemantics.ts` — `groupExitRules`, `resolveRuleParamSpecs`
  (→ param count), `isExitRuleEnabled`, `toggleExitRuleParam`, `defaultEnableValue`.
- `src/lib/strategies/strategyPresentation.ts` — `categoryLabel`, `STRATEGY_CATEGORY_LABELS`,
  card description helpers (entry-card visual vocabulary to reuse).

> Key insight: the **right-panel param stacking already exists** in both setups. This WO is
> almost entirely the **left-column card redesign** + the **select=enable** interaction.

## Goal

Exit cards look and behave like entry cards — click a card to use it — just multi-select, and
**without a separate toggle**:

```
LEFT COLUMN                          RIGHT DETAIL PANEL
┌ Strategy [All][Trend]…           ┌ MA Crossover
│ [Entry][Entry][Entry]  (1-pick)  │   Short Period … Long Period …   (entry params)
│ ───────────────────────────      │   ── ATR Stop ──                 (enabled exit, stacked)
│ Exit Strategies                  │   atr_mult … atr_period …
│ [ATR Stop ]   [Take Profit]      │   ── Take Profit ──
│  STOP LOSS     TARGET            │   take_profit_pct …
│  2 params●     1 param           │
│ [Chandelier]  [Break-even]       │   (Optimize: ranges instead of values)
│  TRAILING      STOP LOSS         │
└  3 params      2 params          └
  ● = selected/enabled (highlight). Click toggles. No switch.
```

## Tasks

### 1. Shared card shell (`StrategyLibrary.tsx` + new `LibraryCard.tsx`)

Extract the entry card's visual shell into a presentational
`src/components/backtests/setup/LibraryCard.tsx` so entry and exit cards are byte-identical in
look. Props (presentational only): `{ title, tag?, description, paramCount?, selected, onClick,
trailing? }` where `trailing` is an optional slot (entry uses it for the custom-strategy delete
button). Refactor the entry `StrategyCard` in `StrategyLibrary.tsx` to render `LibraryCard`
(behavior unchanged — single-select, delete button via `trailing`). Keep all existing entry
classes/animations on `LibraryCard` so nothing regresses visually.

### 2. Redesign `ExitStrategyCards.tsx` → selectable grid (no toggle)

- Render exit rules as a **grid** (same column setup as the entry card grid), each via `LibraryCard`:
  - `title = rule.label`
  - `tag = ` the exit group label (Stop Loss / Trailing / Target / Time), from `groupExitRules`
    / the group metadata — the analog of the entry category chip. (Group becomes the per-card tag;
    **drop the per-group subheadings** — the small catalog reads fine as one tagged grid.)
  - `description = rule.description`
  - `paramCount = resolveRuleParamSpecs(rule, exitParamSpecs).length` (pass specs in via props)
  - `selected = isEnabled(rule)` — the highlight **is** the on/off state.
  - `onClick = () => onToggle(rule)` — **click toggles enable.** Remove the `role="switch"` toggle
    entirely.
- Props become `{ rules, exitParamSpecs, isEnabled, onToggle, heading? }`. Keep the `heading`
  (default "Exit Strategies"); keep an `aria-pressed={selected}` on each card for a11y (since the
  card is now the toggle).
- Empty state unchanged (`rules.length === 0` → render nothing).

### 3. Wire Simulation (`StrategyStudio.tsx`)

- Pass `exitParamSpecs` to `ExitStrategyCards`. No other logic change — `handleToggleExitRule`
  already toggles, and enabled exits' params already stack on the right.
- Heading stays "Exit Strategies".

### 4. Wire Optimization (`OptimizeSetupPanel.tsx`)

- Pass `exitParamSpecs` (the optimize config already exposes exit specs;
  `candidateExitParamSpecs`/`applicableExitRules` are available) so param counts render.
- Change the heading from "Exit Strategies — searched (on/off)" to **"Exit Strategies"** with a
  small sub-line "Selected exits are searched (on/off + magnitude)." so the search semantics stay
  clear without the now-removed switches.
- `OptimizeStrategyDetailPanel` keeps its "Select an exit strategy to include it in the search…"
  hint (still accurate — selecting = including).

### 5. Optional nicety

When a card is clicked to enable, scroll its newly-revealed param section into view on the right
(`scrollIntoView({ block: 'nearest' })`). Skip if it complicates the diff.

## Guardrails

> Frontend-only. Run/optimize payload shapes **must not change** — `strategyParams` stays the
> single source of truth; enabling/disabling uses the existing `toggleExitRuleParam` /
> `exitRuleEnableUpdate` semantics (enable → `enable_value`/`defaultEnableValue`; disable → `0`).
> `LibraryCard` is presentational only — no data fetching, no business logic.
> Entry-card behavior is **read-only** in effect: after extracting `LibraryCard`, the entry grid
> must look and behave exactly as before (single-select, delete button, hover/selected styling).
> Reuse `exitRuleSemantics` helpers — do not re-implement enable/disable or grouping.

## Tests

- `src/components/backtests/setup/__tests__/ExitStrategyCards.test.tsx` (update/replace):
  - renders one card per applicable rule with its group tag + param count;
  - **no** `role="switch"` in the output;
  - clicking a disabled card calls `onToggle(rule)`; clicking an enabled card calls `onToggle`
    (toggle off); enabled card has `aria-pressed="true"` and selected styling.
- `LibraryCard` snapshot/render test: renders title/tag/description/paramCount, fires `onClick`,
  renders `trailing` slot.
- Simulation (`StrategyStudio`) test: enabling an exit card reveals its `StrategyParamFields` on
  the right; disabling hides them and pins the enable param to `0` (assert via
  `handleParamChange`/resulting `strategyParams`).
- Optimization (`OptimizeSetupPanel`) test: enabling an exit card adds its search-space ranges to
  `OptimizeStrategyDetailPanel`; payload from `buildOptimizationConfigPayload` carries only the
  enabled exits' params (unchanged shape).
- Entry-card regression: `StrategyLibrary` still single-selects and still shows the custom delete
  button (via `trailing`).

## Docs

- Update `docs/design/exit-strategy-cards.md`: status note that WO88 supersedes the toggle-card
  decision with first-class selectable cards (select = enable, no switch).

## Definition of done

- `pnpm test:run` and `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` all pass —
  **do not report completion until they do.**
- Paste-in-final-message: confirm (a) entry and exit cards render from the shared `LibraryCard`,
  (b) no toggle switches remain in the exit UI, (c) Simulation and Optimize payloads are byte-for-
  byte unchanged for a fixed selection.

## Out of scope

- Discovery leaderboard exit display — **WO89**.
- Bringing back `ExitConfigurator` presets / ACTIVE-chip row (dropped in WO77; not revisited here).
- Backend / API / search-space-bound changes — see WO87 for search bounds.
