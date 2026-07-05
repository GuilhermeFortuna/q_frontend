# WO195 — Frontend: material vocabulary v2 (black-suede matte controls + machined brass)

## Shared context (read first)

Third of the **WO193–WO199 premium-polish batch**. Execution sequence: `193 → 194 → 195 →
🔍 A → { 196 ∥ 197 ∥ 198 } → 🔍 B → 199` — this WO runs **serially after WO194** (it consumes
the motion tokens and shares `materials.css`/`button.tsx` territory). **🔍 Checkpoint A
follows this WO** — the user inspects the app with all three foundations live before the
layer WOs (196–198) launch, potentially in parallel.

Today the app has effectively one premium material — frosted glass panels — and everything
else is "slightly different dark fill." This WO introduces a real **material vocabulary** so
different UI roles feel physically different, like the inside of a high-end instrument case:

- **Frosted glass** — panels (exists; refined here, not rebuilt)
- **Black suede** — NEW: an ultra-matte, light-absorbing material for controls (buttons,
  segmented thumbs, chips, selected cards)
- **Machined brass** — the accent metal, upgraded from "gold-tinted gradient" to something
  that reads like milled metal

**The hard-won lesson that governs this WO** (from WO119's rejected weave and WO121 Rev 1's
removed grain): **richness comes from how a surface catches light, never from a printed
texture.** Suede here is a _light behavior_ — matte, non-specular, with a soft directional
sheen where "the nap is brushed" — not a noise pattern. Any implementation using noise
images, SVG turbulence, or repeating patterns is wrong and will be rejected.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), vitest. Paths
relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/styles/materials.css` — the surface system: `surface-well` (−2), `surface-panel` +
  `--living` (0, frosted glass), `surface-card` / `surface-control` (+1),
  `surface-overlay` / `surface-float` (+2), `surface-shell`, `quant-panel`. The elevation
  ladder is **fixed** — this WO changes what +1 is _made of_, not the ladder itself.
- `docs/design/visual-design-system.md` — ladder recipes, accent tiers, living-panel rules
  (`--spot-x`/`--spot-y` pointer plumbing via `PointerSpotlight` — the suede sheen reuses it).
- `src/components/ui/button.tsx` — variants `default` (surface-control), `ghost`, `outline`,
  `brass`; WO194 will have standardized its motion.
- `src/components/ui/SegmentedToggle.tsx` (thumb = +1), `RangeChips.tsx`, `FilterPills.tsx`,
  `EntityCard.tsx`, `chipStyles.ts` — the +1 consumers that become suede.
- `src/components/effects/PointerSpotlight.tsx` (or wherever `--spot-x/--spot-y` is written —
  locate it) — hardened in WO121 to feed all living ancestors.

## Goal

```css
/* materials.css — the new +1 material */
.surface-suede {
  /* ultra-matte: flatter and DEEPER than the glass panels it sits on */
  background: linear-gradient(178deg, #131312, #0e0e0d 85%);
  border: 1px solid rgba(255, 255, 255, 0.07); /* luminance edge, not warm tint */
  border-top-color: rgba(255, 250, 240, 0.11); /* faint top lip — the only specular */
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.5),
    0 4px 10px -6px rgba(0, 0, 0, 0.6);
}
.surface-suede::after {
  /* the nap-brush sheen: a very soft, LOW-contrast radial that follows the pointer */
  background: radial-gradient(
    140px 100px at var(--spot-x) var(--spot-y),
    rgba(226, 214, 192, 0.05),
    transparent 70%
  );
  opacity: 0;
  transition: opacity var(--motion-base) var(--ease-out);
}
.surface-suede:hover::after {
  opacity: 1;
}
.surface-suede:active {
  /* nap pressed: sheen contracts + fill darkens a step */
}
```

Buttons and controls that _absorb_ light instead of reflecting it — visibly a different
substance from the glass panels behind them — with brass reserved as jewelry.

## Tasks

1. **`surface-suede` material** in `materials.css`, per the Goal recipe (values are the
   starting point — tune against the real app over the frosted panels, per the WO121 Rev 1
   lesson: validate on the live background, not a mock). Defining properties, in order of
   importance: (a) **matte** — near-zero gradient travel, no glossy top highlight beyond the
   1px lip; (b) **deeper than its panel** — suede on glass must read _darker_ than the
   surface it sits on, which is what makes it look absorbent; (c) **pointer sheen** — reuses
   the existing `--spot-x`/`--spot-y` plumbing; extend the spotlight writer to also feed
   elements carrying `surface-suede` (same hardening pattern as WO121's living-ancestors
   fix); sheen is _subtle_ — if a screenshot makes it obvious, it's too strong; (d)
   **press state** — `:active` darkens the fill one step and contracts the sheen radius
   (~60%), paired with WO194's press transform: the physical read is "nap compressed."
2. **Retire/alias `surface-control`.** `surface-suede` becomes the +1 control material.
   Keep `.surface-control` as an alias (same rules) so nothing off-batch breaks, but migrate
   `ui/` primitives to the new name. `surface-card` (non-interactive +1 tiles) gets the matte
   fill + luminance edge but **no** sheen (static content shouldn't track the pointer).
3. **Button variants on the vocabulary** (`button.tsx`):
   - `default` → suede (was `surface-control`): matte body, sheen on hover, WO194 press.
   - `brass` → **machined brass**: replace the tinted-gradient look with a metal read —
     slightly higher-contrast vertical gradient (`brass-500`→`brass-700` tones), crisp 1px
     top bevel light `rgba(255,235,200,.45)`, dark lower edge, text in near-black or
     `cream-100` (pick by contrast ≥ 4.5:1), hover brightens the bevel not the fill. This is
     tier-4 jewelry — it must look _expensive and rare_, and it stays rare (primary CTA only).
   - `ghost` / `outline` unchanged in concept; retune borders to luminance-based edges for
     consistency with (1).
4. **Migrate the +1 primitives**: `SegmentedToggle` thumb, `RangeChips` chips, `FilterPills`
   pills, `EntityCard` (suede at rest; selected = suede + tier-3 accent treatment — the
   accent ladder is unchanged, gold still carries meaning), `chipStyles.ts`, NumberInput
   steppers. Selected/active states keep their existing tier-3 gold semantics _on top of_
   the suede body.
5. **Glass refinement pass** (small): with matte suede sitting on the panels, re-check
   `surface-panel` blur/opacity so the glass↔suede contrast lands (glass may need +2–4%
   translucency to amplify the material difference). Tune only `--panel-blur` / fill
   percentages — no structural changes to the living-panel system.
6. **Dev gallery.** Update the `/dev/ui` gallery with a "Materials" section showing glass /
   suede / brass side by side with all states (rest, hover, press, selected, disabled,
   focus) — this is what the user reviews at 🔍 Checkpoint A.

## Guardrails

> **No printed textures.** No noise PNGs/SVG `feTurbulence`/repeating gradients/background
> images. Suede = light behavior only. (WO119/WO120/WO121-Rev-1 lessons are binding.)
> **The elevation ladder is fixed.** Suede is the _material_ of +1; it does not add a level,
> and nothing may nest suede-in-suede sheen tracking (one sheen per control).
> **The accent ladder is fixed.** Gold allocation rules unchanged; suede is tier-0
> structural. Machined brass appears only where tier 4 already appears today.
> **Edges by luminance, not warm tint** — the recurring WO119 bug; warm low-opacity borders
> are invisible on near-black.
> **Perf:** sheen uses the existing pointer-var plumbing (no new listeners per control —
> extend the shared writer); transform/opacity-only transitions; test hover on a grid of 50+
> chips (Discover filters) for jank.
> **Determinism for review:** all magic numbers land as CSS custom properties
> (`--suede-sheen-strength`, etc.) so Checkpoint A tuning is a token edit, not a rewrite.

## Tests

- `src/components/ui/__tests__/button.test.tsx`: `default` renders `surface-suede`;
  `brass` renders the machined-brass class; alias `surface-control` still resolves.
- Gallery route renders the Materials section without errors.
- Existing primitive tests green (class-name assertions updated where the material class
  changed — update expectations, don't delete tests).

## Docs

Extend `docs/design/visual-design-system.md` with a **Material vocabulary** section: the
three materials, what each is _for_ (glass = space, suede = touch, brass = significance),
the suede light-behavior spec, and the "no printed textures" rule with its history.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the final `.surface-suede` CSS as shipped, the tunable token list, which
primitives migrated, and a note on how the spotlight writer was extended. Then **stop for
🔍 Checkpoint A** — the user reviews typography + motion + materials together in the live
app before WO196 starts; expect a tuning follow-up amendment to this WO.

## Out of scope

Tables (WO196), overlays (WO197 — `surface-overlay`/`surface-float` are retouched there on
top of this vocabulary), chart frames (WO198), page sweeps (WO199). New elevation levels.
Any change to living-panel mechanics beyond the tuning in Task 5.
