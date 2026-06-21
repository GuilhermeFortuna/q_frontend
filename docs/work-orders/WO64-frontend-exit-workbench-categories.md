# WO64 — Frontend: generic category-driven exit workbench

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; build: `pnpm build`

**Context for this work:** batch "Specialized exits". The Strategy-page workbench
(`StrategyWorkspace.tsx`) currently hard-codes the six exit param names in an `EXIT_PARAM_NAMES`
set and splits exits into two cards by a `_pct`-suffix **string heuristic** — so every new backend
exit would need a frontend edit. **WO61** adds an `exit_group` field to each exit `StrategyParamSpec`
(`"stop_loss" | "trailing" | "target" | "time"`, `None` for entry params), and **WO62/WO63** add the
specialized rules. This WO makes the workbench **render exits generically from `exit_group`**, so all
present and future exit rules surface automatically with no further frontend changes.

This WO is **frontend-only** and depends on WO61 (the backend must emit `exit_group`). It needs no
backend edits.

---

## How the pieces work today (read these files)

- `src/workspaces/strategy/StrategyWorkspace.tsx`
  - `EXIT_PARAM_NAMES` (line 17) — hard-coded set of the six exit names.
  - `entryParamSpecs` (60–63) = params NOT in the set; `exitParamSpecs` (65–68) = params IN the set.
  - Exit render (404–516): two hard-coded cards — "Fixed & Trailing Percentage Exits" filters
    `name.endsWith('_pct')`; "Volatility-Adjusted Exits (ATR)" filters the rest; per-spec hint text
    is hard-coded by `spec.name`.
- `src/types/strategies.ts:5` — `StrategyParamSpec` type (add `exit_group`).
- `src/components/shared/StrategyParamFields.tsx` — existing generic param renderer (entry params
  already use it via `StrategyParamFields`); reuse its input styling conventions.

---

## Goal

```tsx
// Exits = any spec with a non-null exit_group; entry = the rest. Render one card per present group,
// in a fixed order, driven entirely by backend metadata — no name lists, no _pct heuristic.
const exitSpecs = specs.filter((s) => s.exit_group != null)
const entrySpecs = specs.filter((s) => s.exit_group == null)
```

New backend exit rules (Chandelier, Break-even, SAR, ratchet, time stop, Donchian, …) appear in the
right card automatically.

## Tasks

### 1. Type

Add to `StrategyParamSpec` (`src/types/strategies.ts:5`):

```ts
exit_group?: 'stop_loss' | 'trailing' | 'target' | 'time' | null
```

### 2. Rework `StrategyWorkspace.tsx`

- Delete `EXIT_PARAM_NAMES` (17). Redefine:
  - `entryParamSpecs` = specs where `exit_group` is null/undefined.
  - `exitParamSpecs` = specs where `exit_group` is set.
- Replace the two hard-coded exit cards (404–516) with a loop over a fixed group order and labels:
  `stop_loss → "Stop Loss"`, `trailing → "Trailing Stops"`, `target → "Profit Targets"`,
  `time → "Time Exits"`. For each group **that has ≥1 spec**, render a card; inside, render each
  spec's input (number, `step`/`min`/`max` from the spec) using the spec's own `label` and `hint`
  (drop the per-name hard-coded hint strings — use `spec.hint` from the backend).
- Keep the existing section header ("2. Exit Strategy & Risk Management"), the
  "Set to 0 to disable" affordance, the input styling (`inputClass`), and the empty-state message.
- Prefer reusing `StrategyParamFields` for the per-spec inputs if it fits the card layout; otherwise
  keep the existing inline input markup but driven by the grouped specs.

### 3. Keep entry section unchanged

Entry params still render via the existing `StrategyParamFields` path (now simply "specs with no
`exit_group`").

## Guardrails

> **No hard-coded exit names.** After this WO, grep for exit param names (`stop_loss_pct`,
> `chandelier_atr_mult`, …) in the frontend returns **nothing** — the workbench is fully
> metadata-driven. A new backend rule must require zero frontend edits.

> **Backend is the source of truth.** Labels/hints/min/max/step/default come from the spec payload,
> not the frontend. Do not duplicate them.

> **No backend changes.** This WO only consumes the `exit_group` field WO61 adds.

> **Graceful with unknown groups.** If a future spec carries an `exit_group` not in the known list,
> render it in a fallback "Other Exits" card rather than dropping it.

## Tests — `src/workspaces/strategy/` (Vitest)

- Given a mocked strategy whose `params` include specs across `stop_loss`/`trailing`/`target`/`time`,
  the workbench renders one card per **present** group with the correct headings, and each spec's
  `label`/`hint` come from the payload.
- A spec with `exit_group == null` renders in the entry section, not the exit section.
- A group with no specs renders no card.
- (If feasible) an unknown `exit_group` value renders under "Other Exits".

## Docs

`q_frontend/README.md` (or the strategy-workspace doc): note the workbench renders exits generically
by `exit_group`; adding a backend exit rule needs no frontend change.

---

## Definition of done

- `pnpm test` passes and `pnpm build` is clean. **Do not report completion until both do.**
- Grepping the frontend for any exit param name returns nothing.
- Paste in the final message: the group-order/label map and the before/after of how exit specs are
  selected and grouped.

## Out of scope

- All backend work — registry/coordinator (**WO61**), rules (**WO62**, **WO63**).
- Partial-exit UI / position sizing. Re-styling the entry section.
