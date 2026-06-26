# WO121 — Frontend: cool the surfaces, restore glass, tune light, fix living nesting

> **⚠ Revision 1 (post-review, 2026-06-26).** The first implementation shipped panels that looked like
> **sandpaper** and washed-out gray. Root cause: the film grain (from WO120) is invisible on near-black but
> blows up on the lightened frosted surface, and the 55–60% fill was too translucent over the real (lighter)
> workspace background. Two changes vs. the original spec: **(a) Task 3 now removes the grain entirely** from
> living panels; **(b) Task 2 darkens the frosted fill to ~72–78%.** Everything else stands. Re-run and
> re-review.

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.

Checkpoint-B correction round on the Backtests pilot, decided with the user from live mockups. Builds on
**WO119** (surface refinement) + **WO120** (living = light, not pattern). **Must land before WO122** so the
rollout inherits the corrected surfaces. Four independent fixes; ship together.

**Why (user feedback on the shipped pilot):**

1. **"Too chocolatey."** WO116's "warm-black" fills drifted into espresso-**brown** (`#16110c` is brown);
   stacked with the tan border + tan light it reads as milk chocolate. Cool the surfaces to faintly-warm
   **neutral** black; warmth should live in the **gold accents + light**, not the surface fill.
2. **Lost the glassmorphism.** The original panels were translucent (`rgba(...,0.72–0.82)`); WO116 made the
   fills opaque, so the espresso/gold background no longer shows through. Restore translucency — and the user
   chose **frosted** (translucent + `backdrop-filter` blur).
3. **Living light washed out at real scale.** The `0.10` top-light was tuned on small mockups; on full-size
   panels it barely registers. Raise strength and add a vertical falloff so the whole panel reads as lit.
4. **Backlight stuck at panel center.** `--living` is **nested** (`OptimizeStrategyDetailPanel` is living and
   contains `StrategySearchSpaceFields`, also `<Panel living>`). CSS `:hover` fires on both, but
   `PointerSpotlight` writes `--spot-x/--spot-y` only to `closest()` (innermost), so the outer panel's sheen
   is frozen at the `50%` default. Fix the nesting + harden the writer.

## How the pieces work today (read these files)

- `src/styles/globals.css` `@theme` — surface tokens (`--surface-base-1/2`, `--surface-raised-1/2`,
  `--surface-well*`), `--panel-light-strength`, `--panel-top-light`, `--panel-grain-*` (from WO119/WO120).
- `src/styles/materials.css` — `surface-panel`/`quant-panel` (opaque gradient, no blur), `surface-card`,
  `surface-well`, `surface-panel--living` (`::before` lit volume + grain, `::after` cursor sheen).
- `src/components/effects/PointerSpotlight.tsx` — writes spot vars to `target.closest('.surface-panel--living')`.
- Living applications to audit (from `grep -rn "surface-panel--living"` + `<Panel living`): `Panel.tsx`,
  `OptimizeStrategyDetailPanel.tsx` (class), `StrategySearchSpaceFields.tsx`, `EntryManagerSelector.tsx`,
  `ExitStrategyCards.tsx`, `StrategyLibrary.tsx`, `MarketConfigBand.tsx`, `OptimizeStudyBand.tsx`,
  `OptimizeMarketConfigBand.tsx`, `optimizeFormShared.tsx` (`FormSection`).

## Tasks

### 1. Cool the palette — faintly-warm **neutral** tokens (`globals.css`)

Replace the brown fills (keep a whisper of warmth, but neutral black, not espresso):

```css
--surface-base-1: #181613; /* was #16110c (brown) */
--surface-base-2: #0e0e0d; /* was #0e0f11 */
--surface-raised-1: #1a1916; /* was #1b1611 */
--surface-raised-2: #121211; /* was #100d0a */
--surface-well-top: #0a0a09; /* was #070605 */
--surface-well-bottom: #0d0d0c; /* was #0d0a07 */
--surface-well: #0a0a09; /* was #0a0806 */
```

Leave brass/gold/cream accent tokens and `--edge-warm*` **unchanged** — those are the warmth we keep.

### 2. Restore glass — frosted translucent panels (`materials.css` + token)

Make `surface-panel`/`quant-panel` translucent + blurred, behind a tunable token:

```css
/* globals.css */
--panel-blur: 11px;
/* materials.css */
.surface-panel,
.quant-panel {
  background: linear-gradient(
    158deg,
    color-mix(in srgb, var(--surface-base-1) 72%, transparent),
    color-mix(in srgb, var(--surface-base-2) 78%, transparent)
  );
  backdrop-filter: blur(var(--panel-blur)) saturate(1.04);
  -webkit-backdrop-filter: blur(var(--panel-blur)) saturate(1.04);
  /* keep the WO119 'defined outline' border + inset sheen + drop shadow + isolation:isolate */
}
```

> **Read as deep glass, not gray** (Rev 1): the workspace background behind these panels is lighter than the
> mockup, so 55–60% fill rendered a washed mid-gray. Use **~72–78%** fill so panels stay deep/dark while the
> background still bleeds through. Verify against the real app, not a dark mock.
> Perf guard: `backdrop-filter` is the one genuinely expensive effect and the user opted in knowingly. Keep
> it **tunable** (`--panel-blur`) so it can be lowered/zeroed per-page if any view drops frames — re-check on
> the densest page (Market Data) during WO123. Do **not** also blur `surface-card`/`surface-well`.

### 3. Tune the living light to read at real panel size (`globals.css` + `materials.css`)

- **Remove the film grain from living panels (Rev 1).** Grain + frosted glass are incompatible: the
  `overlay`/`soft-light` grain is invisible on near-black but explodes into **sandpaper** on the lightened
  frosted surface, and a sharp noise layer over soft blurred glass looks wrong. Delete the grain
  `background-image` / `background-size` / `background-blend-mode` override from `.surface-panel--living`
  (it then simply inherits the frosted `surface-panel` base + its `::before`/`::after`). Drop the now-unused
  `--panel-grain-opacity` / `--panel-grain-texture` tokens. The frosted glass + lit volume carry the material
  richness — no texture needed.
- `--panel-light-strength: 1.8` (was `1`).
- Desaturate `--panel-top-light` from tan to warm-white: base `rgba(255,240,224,.085)` (was
  `rgba(255,214,150,.1)`), still scaled by `--panel-light-strength`.
- Add a gentle **vertical falloff** as the first layer of `surface-panel--living::before` so the whole body
  reads lit, not just the crown:
  `linear-gradient(180deg, color-mix(in srgb, rgba(255,240,224,.05) calc(var(--panel-light-strength)*100%), transparent), transparent 60%)`
  (keep the existing top-radial + base-shadow layers after it).
- The hover sheen (`::after`) stays warm-gold — warmth in the _light_ is correct; only the surface went neutral.

### 4. Fix living-panel nesting + harden the writer

- **No nested living panels.** `--living` belongs on the **outermost section panel** of a region only. Audit
  the list above; where a living panel contains another living panel (confirmed: `OptimizeStrategyDetailPanel`
  ⊃ `StrategySearchSpaceFields`), drop `living` from the **inner** one. Keep each region's top-level section
  panel living. Net rule: a `.surface-panel--living` must never be an ancestor or descendant of another.
- **Harden `PointerSpotlight`:** write `--spot-x/--spot-y` to **every** `.surface-panel--living` ancestor of
  the pointer target (walk up, not just `closest`), so any future accidental nesting can't silently freeze a
  panel. Keep the single rAF-throttled listener. (Frosted blur makes nested panels double-blur anyway — the
  no-nest rule fixes both.)

## Guardrails

> **Gold + light are the only warmth; surfaces are neutral black.** No brown fills, no tan borders.
> **Translucency must keep text legible AND read deep** — `~72–78%` fills + blur; panels are dark glass, not gray.
> **No grain/texture on living panels** (Rev 1) — frosted glass + lit volume only. Grain fights the blur.
> **Blur stays on panels only and behind `--panel-blur`.** Never on cards/wells/repeated tiles.
> **One living level.** No nested `--living`; one delegated pointer listener.
> **Keep WO119/WO120 intact** (defined edges, captions, steppers, light-not-pattern) — this only retunes.
> **Respect `prefers-reduced-motion`** (static light stays; hover sheen disabled).

## Tests

- `src/styles/__tests__/materials.test.ts`: `surface-panel` includes `backdrop-filter` + `color-mix` (glass);
  `surface-panel--living` has **no** grain (`background-blend-mode` / `fractalNoise` / `--panel-grain` absent)
  and `::before` has no `repeating-linear-gradient` (Rev 1 regression guards).
- `src/components/effects/__tests__/PointerSpotlight.test.tsx` (new or extend): simulate a `pointermove` over a
  child of two nested `.surface-panel--living` elements; assert **both** ancestors get `--spot-x/--spot-y`
  written (guards the stuck-center regression).
- `src/components/ui/__tests__/Panel.test.tsx`: still passes; add coverage that nested usage isn't produced by
  the audited components if feasible (otherwise rely on the pointer test).
- Full suite green: `pnpm test:run`.

## Docs

- `docs/design/visual-design-system.md`: update the ladder recipes to the cooled tokens + frosted-glass
  `surface-panel`; in **Living panels** note strength `1.8` + vertical falloff + the **no-nesting** rule; add
  a line that surfaces are neutral-black and warmth lives in accents + light.

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message: confirm (a) surfaces read as neutral black, not brown; (b) panels are frosted glass
  (background bleeds through, softened); (c) the lit volume reads on full-size panels; (d) the cursor sheen
  follows the pointer on every panel including the former Search Space container (no stuck-center). List files
  changed. **Land before WO122.**

## Out of scope

- The rollout pages — **WO122–126** (they inherit these corrected surfaces).
- Ember/aurora/breathing variants — still deferred.
- Re-tuning the elevation/accent ladders beyond temperature + the living light.
