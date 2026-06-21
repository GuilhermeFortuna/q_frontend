# WO68 — Frontend: Strategy-page layout & polish

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test` ; typecheck/build: `pnpm exec tsc -p tsconfig.app.json --noEmit` / `pnpm build`

**Context for this work:** the Strategy Workbench page is hard to parse beyond the exit section. The
exit configurator itself is redesigned in **WO67** (toggle cards + presets) — **this WO is the page
shell around it**: the `SAVED STRATEGIES` panel takes a third of the width while usually empty, the
form is one long single-column scroll with lots of wasted horizontal space, the Save action sits at
the bottom of a tall form, and the entry section's hints are heavy paragraphs. This WO improves
**layout, density, and flow** without changing the exit configurator internals or the save contract.

**Do this after WO67** (it inserts `<ExitConfigurator/>`); WO68 restructures the surrounding shell of
`StrategyWorkspace.tsx`. Coordinate the seam: WO68 must not alter the exit configurator's internals,
only where/how it sits in the layout.

---

## How the pieces work today (read these files)

- `src/workspaces/strategy/StrategyWorkspace.tsx`
  - Header (~196–211): title + "New Strategy" button.
  - Layout grid (~213): `md:grid-cols-12` → left `col-span-4` Saved Strategies card (~215–277),
    right `col-span-8` Create/Edit card (~279…).
  - Identity fields (name/base/description, ~299–362), entry section (~366–393), exit section (now
    `<ExitConfigurator/>` from WO67), Save button (~438–450).
- `src/components/shared/StrategyParamFields.tsx` — `showHints` renders a `ParamHint` paragraph per
  field; reused by the entry grid.
- `src/components/ui/card.tsx` and `InstrumentConfigFields` (`inputClass`, button classes) — shared
  styling primitives to reuse (match existing brass/carbon theme; do not introduce new design tokens).
- Reference screenshot: empty left panel, wide dead margins, verbose entry hints, bottom-only Save.

---

## Goal

A scannable, denser workbench: a compact saved-strategies rail that collapses when empty, a
wider/better-proportioned form that uses the available width, lighter entry hints, and a **sticky
action bar** so Save (and Backtest CTA) is always reachable — without changing what gets saved.

## Tasks

### 1. Rebalance the two-column layout

- Narrow the Saved Strategies rail (e.g. `col-span-3`) and widen the form (`col-span-9`); ensure the
  form content uses the width (the identity row and entry grid should breathe, not sit in a narrow
  column with empty margins). Verify at common widths (≥1280, ~1024, mobile single-column stack).
- **Empty saved-strategies state:** make it compact (a slim "No saved strategies yet" with the
  primary "New Strategy" CTA) rather than a tall dashed box, so it doesn't dominate when empty.

### 2. Sticky action bar

- Move Save into a **sticky footer bar** within the form card (or page) that stays visible while
  scrolling the long form. Include the existing Save button (preserve `handleSave`, disabled/pending
  states) and a secondary **"Backtest this strategy"** affordance if a route/handler is readily
  available — otherwise leave a clearly-disabled placeholder and note it (do NOT invent a backend).
- Surface a compact **validation/summary** line in the bar (e.g. "3 exits active · name required")
  using existing form state (`name`, enabled exit count from `paramValues`). Keep it derived; no new
  state machine.

### 3. Tighten the entry section

- Render entry-param hints lighter (match WO67's compact `ⓘ`/single-line treatment for consistency),
  so the entry grid isn't dominated by paragraphs. Keep the Thesis callout (it's useful) but make it
  collapsible if long.
- Keep the entry grid 2-up on wide screens; ensure label/typography hierarchy matches the exit
  cards for a coherent page.

### 4. Header & section rhythm

- Tighten vertical spacing between identity → entry → exits so the page reads as three clear steps
  (consider compact step labels/anchors). Keep the existing icons (Settings2/ShieldCheck) and
  numbering. No new color tokens — reuse the brass/carbon theme.

## Guardrails

> **Save contract unchanged.** The saved payload is the same flat
> `{name, base_strategy, description, parameters}`. This WO only moves/relabels controls; it does not
> change form state shape or the POST body.

> **Don't touch the exit configurator internals.** `<ExitConfigurator/>`, `ExitRuleCard`, presets,
> and `exitWorkbenchGroups` are WO67's. Only reposition/host them in the new layout.

> **Reuse the theme.** Use existing `Card`, `inputClass`, button classes, and brass/carbon palette.
> No new design system, no new dependencies.

> **No fabricated backend.** The "Backtest this strategy" CTA only wires to an existing route/handler
> if one is present; otherwise it's a disabled placeholder with a note. Don't invent endpoints.

> **Responsive + accessible.** Single-column stack on narrow widths; sticky bar must not obscure the
> last form field (add bottom padding). Buttons/links keyboard-operable.

## Tests — `tests/unit/workspaces/StrategyWorkspace.test.tsx` (extend)

- Renders the rebalanced layout; the saved-strategies empty state is the compact variant.
- The sticky action bar shows the Save button (disabled when `name` empty / pending) and the derived
  summary (e.g. active-exit count reflects `paramValues`).
- Editing an existing strategy still loads identity + params and Save posts the **same payload shape**
  as before (round-trip/contract test).
- Entry section still renders params + Thesis; collapsing the Thesis works.

## Docs

`q_frontend/README.md` (or strategy-workspace doc): note the workbench layout — compact saved rail,
sticky save/summary bar, three-step flow — and that the save contract is unchanged.

---

## Definition of done

- `pnpm test` passes; `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` clean.
  **Do not report completion until all pass.**
- Manually (`./dev.sh`, Strategy page): the page is denser and scannable, Save is always reachable,
  the empty saved rail is compact, and saving/editing still works unchanged.
- Paste in the final message: the new layout structure (column spans, sticky bar) and confirmation
  the save payload is identical.

## Out of scope

- Exit configurator internals / toggle cards / presets — **WO67**.
- Backend metadata/presets — **WO66**. PSAR/`atr_period` correctness — **WO65**.
- A real "send to backtest" backend flow if none exists (note it; future WO).
- Saved-strategies features beyond layout (search, duplicate, export) — future.
