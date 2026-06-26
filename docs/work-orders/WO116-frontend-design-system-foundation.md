# WO116 — Frontend: design-system foundation (elevation + accent + warm-black tokens)

## Shared context (read first)

Two-repo project on Windows. Frontend `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, `pnpm`.

- Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build: `pnpm build`.
- (`pnpm test` is watch mode — use `pnpm test:run`.)

Read `docs/design/visual-design-system.md` (**The elevation ladder**, **The accent ladder**, **Three
principles**) — this WO implements the CSS half of that doc.

**Principle:** this WO touches only `@theme` tokens + `materials.css` + a few `globals.css` utilities.
Because every page already consumes `surface-panel` / `surface-card` / `surface-control` /
`surface-overlay` / `surface-float`, upgrading those class definitions re-skins the whole app with
**no per-page edits**. This is Checkpoint A.

## How the pieces work today (read these files)

- `src/styles/globals.css` — `@theme` tokens (carbon/espresso/brass/gold/silver, radii, fonts) and the
  `@layer utilities` glow/shimmer/active-run/ripple effects.
- `src/styles/materials.css` — the `surface-*` role system: `surface-shell`, `surface-panel` /
  `quant-panel`, `surface-card` (+`--edge`), `surface-control`, `surface-overlay` (+`--hud`),
  `surface-float`. Each currently has its own gradient/border/shadow. **These are what we upgrade.**

## Goal

The whole app shifts to warm-black dimensional surfaces by editing material classes only — depth from
light, not lightness; gold allocated by tier.

```
surface-well (NEW, −2)   recessed: inner shadow, warm-black fill
surface-panel   (0)      reference plane, single warm inset sheen
surface-card    (+1)     raised: warm top-edge highlight + drop shadow (fill stays near-black)
surface-overlay (+2)     floats: lit top edge + soft brass halo + deep shadow
accent tiers 0–4         utility classes: .accent-wayfinding / .accent-interactive / .accent-state
```

## Tasks

### 1. Tokens — `globals.css` `@theme`

- Add warm-black surface tokens used by the recipes (keep existing carbon/espresso): e.g.
  `--surface-base-1: #16110c; --surface-base-2: #0e0f11; --surface-raised-1: #1b1611;
--surface-raised-2: #100d0a; --surface-well: #0a0806;`.
- Add edge-light tokens: `--edge-warm: rgba(255,224,170,.13); --edge-warm-strong: rgba(255,240,210,.12);`.
- Do **not** remove existing tokens — other code references them. Additive only.

### 2. Elevation ladder — `materials.css`

Rewrite the fill/border/shadow of each role to the **warm-black recipes** in
`docs/design/visual-design-system.md` → _The elevation ladder_ table:

- **`surface-well` (new):** add this class. Recessed inner shadow, fill `--surface-well`. This is the
  −2 level for inputs/segmented tracks/select wells.
- **`surface-panel` / `quant-panel`:** warm-black gradient `#16110c→#0e0f11`, single warm inset sheen,
  deep soft drop shadow. Keep the existing `--spot-*` spotlight sub-rules and `:hover` border warm.
- **`surface-card`:** raised recipe — `#1b1611→#100d0a`, warm `border-top-color`, inset top highlight +
  inset bottom shadow + drop shadow. Keep `--edge` and `:hover` (lift within level, **no** gray recolor).
- **`surface-control`:** same raised family as card but tuned for buttons/inputs; keep `:focus-visible`
  brass ring.
- **`surface-overlay` / `surface-float`:** +2 recipe — lit top edge, soft brass halo, deep shadow.
- **`surface-shell`:** adopt the warm-black fill + top edge-light; keep `--blur` and existing role.

### 3. Accent tier utilities — `globals.css` `@layer utilities`

Add small composable classes so components express tiers without bespoke CSS:

- `.accent-wayfinding` → `color: var(--color-brass-600)` (tier 1 small-caps labels/units).
- `.accent-interactive` → hover/focus border warms to `brass-500` (tier 2) — for elements not already
  covered by `surface-*:hover`.
- `.accent-state` → the tier-3 active treatment: warm-black fill + tinted top edge
  `rgba(255,210,120,.5)` + halo `0 0 18px -4px rgba(217,158,34,.35)`; pair with `gold-400` label text.
- Tier 4 reuses **existing** utilities — `quant-panel--active-run`, `live-status-dot`. Do not duplicate.

### 4. Retire all-over glow on dense grids

Remove/neutralize the breathing + shimmer glow where it is applied uniformly to grids (it collapses the
accent ladder by making everything read tier-3/4). Keep `quant-panel--glow-hero` for genuine single hero
surfaces and `quant-panel--active-run` for actually-running tasks. **Do not delete the keyframes** —
just stop applying `--shimmer` / `--glow-breathing` to repeated cards. (Where they're applied lives in
component className strings — leave those for the migration WOs; here, ensure the classes degrade
gracefully and the _defaults_ are calm.)

## Guardrails

> **Additive tokens only** — never remove an existing `@theme` token; other modules import them.
> **No gray.** Every surface fill stays in the espresso/black family. Raised ≠ lighter; raised = lit edge.
> **No per-page edits in this WO.** Only `globals.css` + `materials.css`. If a page looks wrong, that's a
> migration-WO concern, not this one — note it, don't fix it here.
> **Preserve performance contracts** in `materials.css` comments: blur only on shell/overlay, no animated
> shadows on `surface-card`, spotlight is opacity-only.
> **Respect `prefers-reduced-motion`** — keep existing reduced-motion guards intact.

## Tests

- `src/styles/__tests__/materials.test.ts` (new, light): assert the stylesheet exports the expected class
  names — `surface-well`, `surface-panel`, `surface-card`, `surface-control`, `surface-overlay`,
  `surface-float`, `accent-wayfinding`, `accent-interactive`, `accent-state` — by importing the CSS text
  (Vite `?raw`) and matching. (This is a regression guard against accidental class renames the migration
  WOs depend on; no visual assertion.)
- Existing snapshot/DOM tests must still pass unchanged.

## Docs

- `docs/design/visual-design-system.md`: tick WO116 done in **Rollout & checkpoints**; if any recipe value
  was tuned during implementation, update the ladder table to match what shipped (the doc stays truthful).

## Definition of done

- `pnpm test:run` green, `pnpm exec tsc -p tsconfig.app.json --noEmit` clean, `pnpm build` succeeds —
  **do not report completion until all three pass.**
- Paste-in-final-message: confirm (a) the app boots and every page reads as warm-black + dimensional with
  zero component edits, (b) `surface-well` exists and renders recessed, (c) dense card grids are calm (no
  all-over breathing glow), and list the exact files changed (`globals.css`, `materials.css` + test).

## Out of scope

- Building React primitives (`SegmentedToggle`, `EntityCard`, …) — **WO117**.
- Migrating any page's markup — **WO118, WO122–126**.
- Changing chart internals — only their containing surfaces re-skin, via the classes here.
