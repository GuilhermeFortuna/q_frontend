# WO120 — Frontend: living panels = light, not pattern (replace the weave)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Read `docs/design/visual-design-system.md` → **Living panels**. This **supersedes the `surface-panel--living`
treatment from WO119 only.** Everything else WO119 shipped stays: `surface-well` defined inset, `surface-panel`
defined outline, `RangeInput` captions, `NumberInput` steppers. **Must land before WO122** (rollout pages adopt
the corrected `--living`).

**Why:** the WO119 woven texture was rejected at Checkpoint B — a visible repeating pattern reads as cheap
hatching, misscales per panel, and the cursor-reveal leaves a diagonal "scratch" streak. Decision: drop the
pattern entirely. A panel's richness comes from **how it catches light, not a printed texture.** User approved
"lit-from-above volume + cursor sheen on hover (+ faint tunable grain)".

## How the pieces work today (read these files)

- `src/styles/materials.css` — `surface-panel--living` (WO119) currently renders the weave via `::before`
  (static cross-weave + grain + vignette) and `::after` (cursor-masked brighter weave + glow). **Replace both
  layers.** Keep the panel base recipe, the `--spot-x/--spot-y` plumbing, and `isolation:isolate`.
- `src/components/effects/PointerSpotlight.tsx` (generalized in WO119) — keep; the sheen reuses it. No JS change.
- `src/styles/globals.css` — add the tunable grain/light tokens here.

## Goal

```
surface-panel--living
  ::before (static)  → lit-from-above VOLUME: warm top light + base shadow + faint film grain (no lines)
  ::after  (hover)   → warm cursor sheen, follows --spot-x/--spot-y, opacity 0→1
  (no repeating-linear-gradient weave anywhere)
```

## Tasks

### 1. Replace `surface-panel--living::before` — static lit volume (`materials.css`)

```css
.surface-panel--living::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(150% 80% at 50% -20%, rgba(255, 214, 150, 0.1), transparent 55%),
    /* top light */ radial-gradient(130% 90% at 50% 120%, rgba(0, 0, 0, 0.34), transparent 60%); /* base shadow */
}
```

Add the **film grain** as a second, independent overlay (no visible lines) so it can be tuned/removed without
touching the light. Either a `::before` extra background layer or a small util on the panel — keep grain
opacity behind a token:

```css
/* globals.css */
--panel-grain-opacity: 0.045;
--panel-light-strength: 1; /* 0 = flat, ~1.6 ≈ "B+" */
```

Drive the top-light alpha from `--panel-light-strength` (e.g. via `color-mix` or by scaling the rgba in a
token) so the whole app can dial volume from one place. Default = the "B" values above.

### 2. Replace `surface-panel--living::after` — hover cursor sheen (`materials.css`)

```css
.surface-panel--living::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 1;
  background: radial-gradient(
    420px circle at var(--spot-x, 50%) var(--spot-y, 50%),
    rgba(255, 198, 96, 0.1),
    rgba(217, 158, 34, 0.035) 45%,
    transparent 68%
  );
  opacity: 0;
  transition: opacity 400ms ease;
  will-change: opacity;
}
.surface-panel--living:hover::after {
  opacity: 1;
}
```

Content stays at `z-index: 2+` (panel already `isolation:isolate`). **No mask, no weave** — the sheen is a
single soft radial that simply follows the cursor.

### 3. Reduced motion / no-pointer

Under `prefers-reduced-motion: reduce`: keep the static lit volume (it's not motion); disable the hover sheen
transition (snap or hide). Grain is static — always fine.

### 4. Remove dead weave code

Delete the WO119 weave gradients, the lit-weave mask layer, and any now-unused weave tokens. Grep for the
`repeating-linear-gradient` the weave introduced and remove it from `--living` (leave unrelated uses alone).

## Guardrails

> **No repeating texture in `--living`.** No `repeating-linear-gradient`/hatch/weave. Light + grain only.
> **Same recipe regardless of panel size** — radial gradients are percentage-based, so no per-panel misscale.
> **Hover-only motion**; static volume has zero idle cost. transform/opacity only; no layout/backdrop-filter.
> **`--living` stays panel-level (0) and opt-in** — not on `surface-card`, `surface-well`, or repeated tiles.
> **Keep the rest of WO119** (wells, outlines, captions, steppers) untouched.

## Tests

- `src/styles/__tests__/materials.test.ts`: `surface-panel--living` still present; assert the `--living` block
  no longer contains `repeating-linear-gradient` (regression guard against the weave returning).
- Full suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md` → **Living panels**: replace the weave description with: static
  lit-from-above volume + faint grain at rest; warm cursor sheen on hover (reuses `--spot-x/--spot-y`); tunable
  via `--panel-light-strength` / `--panel-grain-opacity`; no repeating texture.

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message: confirm (a) the weave is gone everywhere, (b) Backtests section panels read as gently
  lit volumes with a clean cursor sheen and no streak/pattern, (c) panels look identical in treatment
  regardless of size. List files changed. **Land before WO122.**

## Out of scope

- Other pages — **WO122–126** (adopt corrected `--living` on their panels).
- Ember/aurora/breathing — still deferred (aurora reserved for a possible future single hero panel).
- Any change to wells/outlines/captions/steppers — those WO119 pieces are accepted.
