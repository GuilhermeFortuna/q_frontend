# WO98 — Frontend: premium shell material system without compositor tax

## Shared context (read first)

Frontend-only WO. Use `pnpm`, never `npm`.

Depends on **WO96**. Can run after or in parallel with WO97 if file ownership is coordinated.

**Design direction:** Keep the cinematic brass-glass look and improve consistency. Do not flatten the
app.

## Goal

Replace expensive repeated CSS effects with a scalable material system:

- premium panels still look deep, layered, and cinematic;
- repeated cards/tables/inputs do not each pay for heavy blur/filter/shadow work;
- app shell uses a few deliberate composited surfaces instead of many accidental ones;
- hover/focus states remain polished but cheap.

## How the pieces work today

Read:

- `src/styles/globals.css`
- `src/components/layout/AppShell.tsx`
- `src/components/dock/AppDock.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/backtests/setup/LibraryCard.tsx`
- `src/components/backtests/setup/StrategyLibrary.tsx`
- `src/components/backtests/setup/AiStrategyPanel.tsx`
- `src/components/optimize/OptimizationTerrain3D.tsx`
- all `backdrop-blur`, `filter`, `drop-shadow`, `box-shadow`, and `quant-panel` usages.

Use `rg "backdrop|blur|filter|drop-shadow|box-shadow|quant-panel"` before editing.

## Tasks

### 1. Define material tokens/classes

Create or refactor CSS classes for a small set of materials:

- `surface-shell`: major app chrome / workspace shell;
- `surface-panel`: primary panels;
- `surface-card`: repeated cards;
- `surface-control`: inputs/buttons/selects;
- `surface-overlay`: modals/popovers/HUDs.

Each material should define:

- background/fill;
- border;
- static depth/shadow;
- focus/hover style;
- whether blur is allowed.

Avoid Tailwind one-off shadow/filter strings where a material class should be used.

### 2. Restrict expensive primitives

Rules:

- `backdrop-filter` only on a tiny number of top-level or modal surfaces, never repeated cards;
- no animated `box-shadow` on dense grids/lists;
- no `filter/drop-shadow` on many repeated icons;
- no global pointer-driven panel shadow;
- use opacity/transform-only animations where possible;
- prefer baked gradients, borders, and pseudo-element overlays.

The UI must still look premium. Replace heavy effects with cheaper equivalent materials.

### 3. Rework `.quant-panel`

`.quant-panel` should become a material class, not a catch-all expensive effect.

Keep:

- cinematic dark fill;
- brass/silver border language;
- subtle inner depth;
- focus/hover affordance.

Remove or restrict:

- nested `backdrop-filter`;
- broad `will-change`;
- per-frame pointer lighting on operational workspaces;
- animated shadows on every panel.

### 4. Preserve/improve key visual states

Verify and tune:

- Launcher dashboard;
- Backtests setup;
- AI Strategy Builder panel;
- Strategy/exit cards;
- Dock/header;
- modal overlays.

If anything looks flatter, add cheaper visual richness through static textures, gradients, edge
highlights, or the WO97 cinematic scene.

## Visual guardrails

> No visual regression. Side-by-side screenshots should show equal or better polish.

> Do not remove cinematic depth; change the rendering method.

> Dense workspaces may use less motion, but not less visual quality.

## Tests

- Add a unit or CSS grep test if the repo pattern supports it:
  - no `backdrop-filter` in repeated card classes;
  - no `filter/drop-shadow` in `LibraryCard` repeated icon paths unless justified.
- Existing focused component tests for StrategyStudio/AI panel.
- `pnpm test:run`
- `pnpm exec tsc -p tsconfig.app.json --noEmit`
- `pnpm build`

## Manual verification

Using WO96 HUD:

- compare FPS/long tasks moving the mouse over Backtests setup before/after;
- confirm no visible flattening;
- inspect computed styles for repeated cards to ensure no blur/filter tax.

## Definition of done

- A named material system exists and is used by shell/panels/cards.
- Expensive CSS primitives are restricted by role.
- Key screens look equal or better.
- WO96 metrics improve or at least show no regressions.
- Required test/typecheck/build commands pass.
- Final message includes before/after visual notes and the expensive-effect audit summary.

## Out of scope

- Building the `CinematicScene` renderer itself (WO97).
- Route lazy-loading/code splitting (WO99).
- Chart internals (WO71/future chart renderer work).
