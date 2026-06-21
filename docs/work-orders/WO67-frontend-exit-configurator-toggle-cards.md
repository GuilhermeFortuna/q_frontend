# WO67 — Frontend: exit configurator redesign (toggle cards + active summary + presets)

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck/build: `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`

**Context for this work:** the Strategy page exit section is currently a tall wall of number inputs
that **all default to `0`** with "Set to 0 to disable" as the only on/off cue and a verbose hint
under every field. With the WO61–63 exits added there are ~15 such inputs — users can't tell what's
active or how params combine into a coherent exit. This WO replaces that with a **toggle-card**
configurator driven by the **WO66** `/api/v1/exit-rules` metadata: each exit is a card with an
enable switch that reveals its params, an **"active exits" chip row**, a shared **Indicator Settings**
spot for `atr_period`, and one-click **presets**.

**Depends on WO66** (the metadata/presets endpoint) and **WO65** (`atr_period` is `general`). The
overall page layout/shell (left panel, width, sticky save, entry section) is **WO68** — keep this WO
to the **exit section internals** of `StrategyWorkspace.tsx` to avoid a merge collision; do WO67
first, then WO68 builds the shell around it.

---

## How the pieces work today (read these files)

- `src/workspaces/strategy/StrategyWorkspace.tsx` — exit section (~lines 397–436): renders
  `exitParamGroups` as category cards, each a flat `StrategyParamFields` grid. `paramValues` +
  `handleParamChange` hold/update the flat param dict; `handleSave` posts it.
- `src/workspaces/strategy/exitWorkbenchGroups.ts` — `partitionStrategyParamSpecs`,
  `groupExitParamSpecs`, `EXIT_GROUP_ORDER/LABELS` (now incl. `general` → "Indicator Settings" from
  WO65).
- `src/components/shared/StrategyParamFields.tsx` — generic param renderer (`NumberInput`, hints,
  min/max validation). Reuse it inside enabled cards.
- `src/api/queries/strategies.ts` — `useStrategies()` pattern (react-query). Mirror it for the new
  catalog query.
- `src/types/strategies.ts` — `StrategyParamSpec`, `ExitGroup`.
- Target visual (toggle cards): collapsed disabled rows showing name + one-line description + switch;
  enabled cards reveal params; an "ACTIVE:" chip row above the groups.

---

## Goal

```
ACTIVE: [ATR Stop] [Chandelier]        Presets: [ATR stop + Chandelier] [Break-even + Time] …

STOP LOSS
┌────────────────────────────────┐
│ ⦿ ATR Stop          [ on  ]    │   enabled → params revealed
│   Mult [2.0]                   │   (ATR Period lives in Indicator Settings, shown once)
├────────────────────────────────┤
│ ○ Fixed Stop %      [ off ]    │   disabled → collapsed (name + desc + switch)
│ ○ Break-even        [ off ]    │
└────────────────────────────────┘
```

A user can see what's on at a glance, flip an exit on/off without memorizing the "0 disables" trick,
and apply a preset to fill a sensible combo.

## Tasks

### 1. Catalog query + types

Add `useExitRuleCatalog()` in `src/api/queries/strategies.ts` (GET `/api/v1/exit-rules`, `staleTime:
Infinity`) and TS types in `src/types/strategies.ts`: `ExitRuleInfo` (`id, label, description,
exit_group, enable_param, param_names, required_param_names`), `ExitPreset` (`id, label, description,
parameters`), `ExitRuleCatalogResponse`.

### 2. Toggle-card component

New `src/workspaces/strategy/ExitRuleCard.tsx`: props = the `ExitRuleInfo`, the strategy's
`StrategyParamSpec[]` (to resolve labels/bounds for `param_names`), current `paramValues`, and
`onChange`. Render:

- A header row: rule label + one-line description + an **enable Switch** (use the existing UI switch
  primitive; if none exists, a small accessible toggle button).
- **Enable semantics:** turning **on** sets `enable_param` to a sensible non-zero default (use the
  spec `default` if > 0, else a baseline from the spec — document the rule: e.g. mid of min..max or
  a per-group fallback). Turning **off** sets `enable_param` to `0`. "Enabled" = `enable_param > 0`.
- When enabled, reveal the rule's `param_names` via `StrategyParamFields` (hints **on**, but compact
  — see Task 5). When disabled, collapse to just the header.

### 3. Group cards + active summary

New `src/workspaces/strategy/ExitConfigurator.tsx` replacing the inline exit JSX:

- Group `ExitRuleInfo` by `exit_group` using `EXIT_GROUP_ORDER` (Stop Loss / Trailing / Profit
  Targets / Time), each a section of `ExitRuleCard`s. Only render a section if it has ≥1 rule.
- An **"ACTIVE:" chip row** at the top listing enabled rules (chip = rule label; click scrolls/opens
  that card). Empty state: "No exits enabled — pick a preset or toggle one on."
- A **shared "Indicator Settings"** block (the `general` group, e.g. `atr_period`) rendered **once**,
  shown only when at least one rule that needs it is enabled (use `required_param_names`).
- Keep an "unknown group" fallback ("Other Exits") for forward-compat (as `groupExitParamSpecs`
  already does).

### 4. Presets row

Above the groups, render preset buttons from the catalog. Clicking a preset **merges** its
`parameters` into `paramValues` (enabling those rules) — and visibly leaves others unchanged. Add a
small "Clear all exits" action that zeroes every exit `enable_param`. Confirm-on-clear not required.

### 5. Tame hint clutter

Hints stay available but stop dominating: render each param's hint as a compact helper (e.g. a small
`ⓘ` tooltip/popover on the label, or a single muted line) rather than a full paragraph under every
input. Pick one consistent treatment and apply it in `ExitRuleCard`. Entry-section hints are WO68.

### 6. Wire into the page

In `StrategyWorkspace.tsx`, replace the exit JSX block (~397–436) with `<ExitConfigurator .../>`.
Leave entry section, identity fields, save button, and overall layout **untouched** (WO68). Preserve
`paramValues`/`handleParamChange`/`handleSave` as the single source of form state.

## Guardrails

> **Flat param dict is the contract.** The form still stores/saves the same flat
> `Record<string, StrategyParamValue>`. Toggles and presets only **set/clear scalar values** —
> nothing about the save payload or backend changes.

> **Metadata-driven, no hard-coded exit names.** Cards, groups, enable params, and presets all come
> from the WO66 catalog + spec list. Grep for exit param literals (`stop_loss_pct`,
> `chandelier_atr_mult`, …) in the frontend after this WO → **nothing**.

> **Backward compatible with saved strategies.** Loading an existing custom strategy must light up
> exactly the rules whose `enable_param > 0` and populate their params — round-trip a saved strategy
> in a test.

> **Don't touch the page shell.** No edits to the left panel, grid columns, header, entry section, or
> save bar — that's WO68. Stay inside the exit section + new components.

> **Accessibility.** Switches are real toggles (keyboard-operable, `aria-pressed`/`role=switch`),
> chips and presets are buttons.

## Tests — `tests/unit/workspaces/` (Vitest, extend the existing suite)

- `ExitConfigurator` renders one section per present group from a mocked catalog + specs; a rule with
  `enable_param` value 0 renders collapsed, > 0 renders expanded with its params.
- Toggling a card on sets its `enable_param` to a non-zero default and reveals params; toggling off
  zeroes it and collapses.
- The ACTIVE chip row reflects exactly the enabled rules; empty state shows when none enabled.
- Applying a preset merges its `parameters` (enables intended rules, leaves others at 0).
- "Indicator Settings" (`atr_period`) shows only when a rule needing it is enabled.
- Loading a saved strategy with `stop_loss_atr>0` + `chandelier_atr_mult>0` shows both as enabled.
- No exit param name string appears in the component source (lint/grep assertion or review note).

## Docs

`q_frontend/README.md` (or strategy-workspace doc): the exit configurator is metadata-driven toggle
cards + presets from `/api/v1/exit-rules`; adding a backend exit rule needs no frontend change.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` are clean.
  **Do not report completion until all pass.**
- Manually (`./dev.sh`, Strategy page): toggling exits on/off works, ACTIVE chips update, presets
  fill combos, `atr_period` appears only when needed, and a saved strategy round-trips its enabled
  exits.
- Paste in the final message: the catalog query hook, the `ExitRuleCard`/`ExitConfigurator`
  structure, and the enable-on/off value semantics.

## Out of scope

- Page layout/shell, left panel, entry section, sticky save, responsive width — **WO68**.
- Backend metadata/presets endpoint — **WO66**. PSAR/`atr_period` correctness — **WO65**.
- Per-user editable/saved presets (v2).
