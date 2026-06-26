# WO117 — Frontend: shared primitive library + dev gallery

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md` (**Component inventory** — the table of props/elevation/accent
per primitive). Depends on **WO116** (the `surface-*` + `accent-*` classes these primitives compose).

**Principle:** these primitives _wrap the material classes from WO116_ — they do not re-declare
gradients/shadows inline. A future token change in `materials.css` must flow through them for free. This
WO **creates** the components and a gallery; it migrates **no** real page (that's WO118+).

## How the pieces work today (read these files)

- `src/components/ui/` — existing primitives to match in API shape: `button.tsx` (cva `Button`),
  `card.tsx` (`Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`), `number-input.tsx`
  (`NumberInput`, forwardRef), `confirm-dialog.tsx`. Use `clsx` + `tailwind-merge` (`cn`) as they do.
- The **inline idioms to generalize** (read for exact current markup, then replace conceptually):
  - `src/components/shared/InstrumentConfigFields.tsx` — `DATE_PRESETS` (`1M/3M/6M/1Y/YTD/All`) → `RangeChips`.
  - `src/components/shared/StrategyParamFields.tsx` — label/hint/error pattern → `LabeledField`.
  - `src/components/optimize/StrategySearchSpaceFields.tsx` — min/max/step triplet → `RangeInput`; the
    `EMA/HMA/SMA` flex-wrap pill group → `SegmentedToggle` (multi variant).
  - Entry-strategy cards + the `Any (OR)/All (AND)/Majority` manager toggle on the Backtests page → `EntityCard`
    - `SegmentedToggle`. The small-caps headers (`INSTRUMENT & MODELING`, `COSTS`) → `SectionHeader`/`Panel`.

## Goal

A small, documented set of reusable primitives that express the two ladders, plus a gallery route to
inspect every state in isolation.

```
ui/SectionHeader  ui/Panel(+PanelHeader)  ui/LabeledField  ui/SegmentedToggle
ui/RangeChips     ui/FilterPills          ui/EntityCard     ui/RangeInput   ui/StatTile
            ↳ all built on surface-* / accent-* (WO116). Gallery at /dev/ui.
```

## Tasks

### 1. Primitives — `src/components/ui/`

Build each as a small, typed, forwardRef-where-it-makes-sense component. Compose WO116 classes via `cn`;
**no inline gradient/shadow CSS**. Match the inventory table in the design doc.

1. **`Panel.tsx`** — `Panel` (role 0, `surface-panel`) + `PanelHeader` (small-caps `accent-wayfinding`
   title, optional `right` slot for count/affordance). `SectionHeader.tsx` — the standalone header for
   non-Panel contexts.
2. **`LabeledField.tsx`** — `{ label, hint?, error?, htmlFor?, children }`; consistent label
   (`accent-wayfinding`), hint, and error styling extracted from `StrategyParamFields`.
3. **`SegmentedToggle.tsx`** — track = `surface-well`, thumb/selected = `accent-state`. Single-select
   (`value`/`onChange`) **and** multi-select (`values`/`onToggle`) variants — multi covers `EMA/HMA/SMA`.
   Keyboard: arrow-key roving focus, `aria-pressed`/`role="radiogroup"|"group"`.
4. **`RangeChips.tsx`** — preset chips (`+1` surface, selected `accent-state`); `options`,
   `value`, `onSelect`. Used for date presets and any small preset row.
5. **`FilterPills.tsx`** — category filter row; same chip vocabulary as RangeChips but semantics =
   "filter", supports an `All` option and an active pill (`accent-state`).
6. **`EntityCard.tsx`** — selectable card: `{ title, tag?, description?, meta?, selected?, onSelect,
disabled? }`. Elevation +1; hover = tier 2 (border warms via `surface-card:hover`); `selected` =
   `accent-state` + `gold-400` title. `role="button"`, keyboard-activatable, focus ring.
7. **`RangeInput.tsx`** — min/max/step triplet built on `NumberInput`; `{ min, max, step, onChange,
error?, intOnly? }`. Wells are `surface-well`. Mirrors the current `StrategySearchSpaceFields` behavior
   (step optional → continuous).
8. **`StatTile.tsx`** — metric tile: `{ label, value, delta?, deltaTone? }`. Elevation +1 (`surface-card
--edge`). Delta colored by up/down (green/rose) — **not** gold (gold is reserved for the accent ladder).

Export everything from a barrel `src/components/ui/index.ts` for ergonomic imports in WO118+.

### 2. Dev gallery — `src/app` route `/dev/ui`

A non-production route (guard behind `import.meta.env.DEV`) rendering each primitive in every state:
default / hover / focus / selected / active / error / disabled, on a real `Panel` background. This is the
artifact reviewers use at Checkpoint B and the regression surface for future tweaks. Lazy-load it so it
never enters the production bundle.

## Guardrails

> **Compose, don't redeclare.** Primitives use `surface-*` / `accent-*` classes. If you find yourself
> writing a gradient or box-shadow in a `.tsx`, stop — it belongs in `materials.css` (WO116).
> **No new runtime deps.** Use installed `clsx` + `tailwind-merge`, `lucide-react` for icons.
> **Accessibility is part of done:** keyboard operation + visible focus + correct ARIA on every
> interactive primitive (`SegmentedToggle`, `RangeChips`, `FilterPills`, `EntityCard`).
> **Gallery is DEV-only** — must not ship in `pnpm build` output (assert via lazy + env guard).
> **No page migration here.** Real pages still render their old inline markup after this WO.

## Tests

- `src/components/ui/__tests__/` — one test file per primitive covering: render, the selected/active state
  applies `accent-state`, keyboard activation fires the callback, multi vs single `SegmentedToggle`,
  `RangeInput` emits min/max/step and surfaces `error`, `LabeledField` renders `error`. Use existing
  testing-library setup (see `components/optimize/__tests__`).

## Docs

- `docs/design/visual-design-system.md`: tick WO117; if any prop name differs from the inventory table,
  update the table to match the shipped API (the doc is the contract WO118+ code against).

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds
  (and `/dev/ui` is **absent** from the production bundle) — **do not report completion until all pass.**
- Paste-in-final-message: the list of exported primitives + their props, and confirmation that `/dev/ui`
  shows every primitive in all states. No real page changed in this WO.

## Out of scope

- Editing tokens/materials — **WO116**.
- Converting Backtests or any page — **WO118, WO122–126**.
- Re-skinning charts — only their surfaces change, later, via the primitives.
