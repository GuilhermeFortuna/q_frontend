# WO119 — Frontend: surface refinement (defined edges, crafted wells, living panels)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md` (**The elevation ladder**). This is a **Checkpoint-B refinement**
batch decided with the user on the Backtests pilot, and it **must land before WO122** so the rollout pages
inherit the refined surfaces. It edits the WO116 materials + a few WO117 primitives — no page migration.

**Why:** on near-black, borders/edges defined with low-opacity _warm_ tones are invisible. The fix is to
define edges by **luminance contrast**, and to give panels a tasteful, GPU-cheap living texture. All four
decisions below were chosen by the user from live mockups; this WO encodes them.

## How the pieces work today (read these files)

- `src/styles/materials.css` — shipped WO116 roles. Patch: `.surface-well` (currently `border rgba(0,0,0,.6)`
  — invisible), `.surface-panel`/`.quant-panel` (currently `border rgba(168,139,82,.14)` — invisible). The
  `--spotlight` variant already tracks the pointer via `--spot-x/--spot-y` (set by `PointerSpotlight`) — reuse
  that plumbing for the living sheen instead of new per-panel JS.
- `src/components/effects/PointerSpotlight.tsx` — the existing pointer→`--spot-x/--spot-y` writer (launcher).
  Generalize so any opted-in panel tracks the cursor.
- `src/components/ui/wellInputStyles.ts` — `wellInputClass` (the `surface-well` input wrapper).
- `src/components/ui/RangeInput.tsx` — min/max/step triplet; labels are **placeholders only** (vanish when
  filled) — the bug the user hit.
- `src/components/ui/number-input.tsx` — `NumberInput`; native browser spinners look cheap.

## Goal

```
surface-well        → "defined inset": visible lit lip (luminance, not faint warmth)
surface-panel       → "defined outline": 30% warm border + lit top edge
surface-panel--living → static woven texture + grain + vignette; cursor sheen REVEALS a
                        brighter copy of the weave so threads glint (light catches the grain)
RangeInput          → persistent Min/Max/Step captions (not vanishing placeholders)
NumberInput         → crafted stepper buttons, native spinner hidden
```

## Tasks

### 1. `surface-well` — defined inset (`materials.css`)

Replace the well recipe with the user-approved "option 1":

```css
.surface-well {
  background: linear-gradient(180deg, #070605, #0d0a07);
  border: 1px solid rgba(146, 120, 74, 0.34);
  box-shadow:
    inset 0 3px 5px rgba(0, 0, 0, 0.7),
    inset 0 -1px 0 rgba(255, 228, 180, 0.13); /* lit bottom rim */
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}
.surface-well:hover {
  border-color: rgba(217, 158, 34, 0.35);
}
```

Keep the existing `:focus-visible` brass ring (it lives on `wellInputClass`/`surface-control`). Prefer
tokenizing the two new fills (`--surface-well-top/bottom`) in `globals.css` for consistency.

### 2. `surface-panel` — defined outline (`materials.css`)

Bump the panel border from the invisible 14% to the approved "option 1":

```css
.surface-panel,
.quant-panel {
  /* keep gradient fill + spotlight vars + transition */
  border: 1px solid rgba(150, 124, 78, 0.3);
  border-top-color: rgba(214, 178, 120, 0.34); /* lit top edge */
  box-shadow:
    inset 0 1px 0 rgba(255, 236, 200, 0.1),
    0 18px 40px -24px rgba(0, 0, 0, 0.78);
}
```

Leave `surface-card` (+1) as shipped unless its edge reads invisible against the panel — if so, apply the
same luminance principle (visible top-edge highlight) but **do not** make repeated cards heavier than panels.

### 3. `surface-panel--living` — tasteful living surface (`materials.css`)

New **opt-in** modifier (user picked option **A: refined weave + cursor light-catch**). Two pseudo-element
layers; everything GPU-cheap; **static texture has zero idle cost**, dynamic layer runs only on hover.

- `::before` (z-index 0, behind content) — **static**, always painted: fine cross-weave + faint grain +
  inner vignette, composited as stacked backgrounds:
  ```css
  background:
    repeating-linear-gradient(45deg, rgba(255, 228, 180, 0.02) 0 1px, transparent 1px 4px),
    repeating-linear-gradient(-45deg, rgba(0, 0, 0, 0.16) 0 1px, transparent 1px 4px),
    radial-gradient(120% 100% at 50% 0%, rgba(255, 228, 180, 0.04), transparent 55%),
    radial-gradient(130% 120% at 50% 120%, rgba(0, 0, 0, 0.32), transparent 60%);
  ```
- `::after` (z-index 1, behind content) — **dynamic**, `opacity:0`→`1` on `:hover`: a warm glow **plus** a
  brighter copy of the weave, both **masked to the cursor** so the threads glint where the pointer is:
  ```css
  background:
    repeating-linear-gradient(45deg, rgba(255, 214, 140, 0.13) 0 1px, transparent 1px 4px),
    radial-gradient(
      340px circle at var(--spot-x) var(--spot-y),
      rgba(255, 196, 90, 0.12),
      transparent 66%
    );
  -webkit-mask: radial-gradient(
    220px circle at var(--spot-x) var(--spot-y),
    #000 0%,
    transparent 60%
  );
  mask: radial-gradient(220px circle at var(--spot-x) var(--spot-y), #000 0%, transparent 60%);
  will-change: opacity;
  transition: opacity 300ms ease;
  ```
  (Content sits at `z-index: 2+`; panel already has `isolation:isolate`. Reuse `--spot-x/--spot-y`.)
- **Reduced motion / no-pointer:** under `prefers-reduced-motion: reduce`, keep the static texture, disable
  the hover reveal transition (snap or hide). The static layer is fine; only the cursor reveal is "motion".

### 4. Generalize pointer tracking (`PointerSpotlight.tsx`)

Make the cursor→`--spot-x/--spot-y` writer reusable by any `surface-panel--living` element (a hook
`usePointerVars(ref)` or a `data-living` opt-in scan), not launcher-only. **One** delegated `pointermove`
listener is preferable to one-per-panel. Throttle via `requestAnimationFrame`. No tracking when the panel
isn't hovered (don't write vars for offscreen panels).

### 5. `RangeInput` — persistent captions (`RangeInput.tsx`)

Render a small persistent caption **above** each field (`Min` / `Max` / `Step`, overridable via `labels`),
using the `accent-wayfinding` / silver caption style — not the placeholder. Keep `aria-label`s and the
existing min≤max / step>0 validation copy.

### 6. `NumberInput` — crafted steppers (`number-input.tsx`)

Hide the native spinner (`appearance: textfield` / `::-webkit-outer-spin-button{display:none}`) and render a
custom paired ▲▼ stepper (silver, warming to `gold-400` on hover, divider hairline) that increments/decrements
by `step` (respecting `integer`, `min`). Make it **opt-in** via a prop (e.g. `showSteppers`, default the
well/RangeInput usages to on) so other `NumberInput` consumers are unaffected. Keyboard ↑/↓ already works
natively — keep it.

### 7. Apply `--living` on the Backtests section panels

Add `surface-panel--living` to the Backtests **section panels** (Instrument & Modeling, Date Range, Capital
& Sizing, Costs, Search Space, Entry/Exit Strategies containers) — **not** to the dense repeated `EntityCard`
tiles (level +1) or wells. This is the only page touched here; WO122–126 add it to their panels during
rollout.

## Guardrails

> **Define edges by luminance, not faint warmth** — the whole reason the first attempt was invisible.
> **Static texture only at rest; dynamic layers only on `:hover`.** No always-animating effect on repeated
> panels. Every effect is transform/opacity/mask — no layout, no `box-shadow` animation, no backdrop-filter.
> **`--living` is opt-in and panel-only** (level 0). Do not put it on `surface-card`, `surface-well`, or the
> small repeated cards — it would pull the eye and multiply paint.
> **Reuse `--spot-x/--spot-y`** + one delegated listener; don't add a JS effect per panel.
> **Respect `prefers-reduced-motion`** — static texture stays, hover reveal disabled.
> **`NumberInput` steppers are opt-in** — must not change existing consumers that don't pass the prop.

## Tests

- `src/components/ui/__tests__/RangeInput.test.tsx`: captions `Min`/`Max`/`Step` are present **with values
  filled** (regression for the vanishing-placeholder bug); custom `labels` override them.
- `src/components/ui/__tests__/number-input.test.tsx`: with `showSteppers`, ▲ increments by `step` (clamped to
  `min`, integer-rounded when `integer`), ▼ decrements; without the prop, no stepper buttons render.
- `src/styles/__tests__/materials.test.ts` (from WO116): assert `surface-panel--living` exists.
- Full suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: in **The elevation ladder**, update the `surface-well` and
  `surface-panel` recipes to the shipped values, and add a short **Living panels** note documenting
  `surface-panel--living` (texture at rest + cursor light-catch; panel-level, opt-in, hover-only motion).

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message: confirm (a) well + panel edges are now clearly visible, (b) Backtests section panels
  show the woven texture and glint under the cursor with no idle animation, (c) RangeInput shows Min/Max/Step
  captions when filled, (d) number fields use the crafted steppers. List files changed. **Land before WO122.**

## Out of scope

- Migrating other pages — **WO122–126** (they adopt `surface-panel--living` on their panels then).
- Aurora/ember/breathing variants — explicitly deferred (reserve aurora for a future single hero panel).
- Changing the accent ladder or elevation levels — edges/texture only.
