# Visual Design System — elevation + accent + warm-black

Source of truth for the WO116–126 visual-elevation batch. The goal is to **elevate the
look while making it reusable**: encode the aesthetic in a small set of CSS material classes +
React primitives, then migrate pages onto them so a single edit propagates everywhere.

This is a refinement of the existing identity, **not** a redesign. We keep: espresso/carbon
near-black base, metallic brass-gold accents, smoked-silver type, `globals.css` `@theme` tokens,
and the `surface-*` role system in `materials.css`. We change how those surfaces are _built_.

---

## Three principles

1. **Depth from light, not lightness.** Raised surfaces stay deep **neutral black** (faintly warm, not
   espresso-brown). They read as "raised" through warm top-edge highlights + drop shadow; recessed
   surfaces read as "sunk" through inner shadow. **Warmth lives in gold accents + light**, not the fill.
2. **Elevation is a fixed ladder.** Five depth levels. Every component picks exactly one; it never
   invents its own. This is what keeps a dimensional treatment clean on a dense screen.
3. **Accent is a fixed ladder too.** Gold intensity scales with _meaning_ across five tiers. Most
   of the UI is neutral (tier 0); gold concentrates where there is something to signal. Gold is not
   reduced vs. today — it is **allocated**.

---

## The elevation ladder

Maps 1:1 onto the existing `surface-*` roles in `materials.css`. Level −2 is new (`surface-well`).

|  Level | Role class                          | Used for                                                              | Build recipe (warm-black)                                                                                                                                                                                                                                  |
| -----: | ----------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **−2** | `surface-well` _(new)_              | text inputs, number fields, segmented-track backgrounds, select wells | fill `linear-gradient(180deg,#0a0a09,#0d0d0c)`; `border 1px rgba(146,120,74,.34)`; inset shadow + lit bottom rim                                                                                                                                           |
|  **0** | `surface-panel` / `quant-panel`     | workspace shells, primary panels (the reference plane)                | frosted glass: `color-mix` fills at ~72–78% (deep, not gray) + `backdrop-filter: blur(var(--panel-blur))`; defined outline border + inset sheen + drop shadow. **No grain texture**                                                                        |
| **+1** | `surface-card` / `surface-control`  | repeated cards, list tiles, buttons                                   | fill `linear-gradient(165deg,#1a1916,#121211 75%)`; opaque (no blur)                                                                                                                                                                                       |
| **+2** | `surface-overlay` / `surface-float` | modals, popovers, HUD, floating chart windows                         | fill `linear-gradient(165deg,#1d1814,#120f0b 72%)`; `border 1px rgba(168,139,82,.22)`, `border-top-color rgba(214,178,120,.3)`; `box-shadow: inset 0 1px 0 rgba(255,240,210,.12), 0 0 40px -10px rgba(196,165,116,.25), 0 26px 50px -18px rgba(0,0,0,.85)` |

**Hover** lifts within the level (slightly stronger top highlight + shadow), never recolors to gray.
`surface-shell` (header/dock) is unchanged in role but adopts the warm-black fill + edge-light.

### Living panels

Opt-in modifier `surface-panel--living` (panel level 0 only — not cards or wells):

**Light, not pattern** (WO120 superseded WO119's rejected weave — a repeating texture read as cheap hatching
and misscaled per panel):

- **At rest:** static _lit-from-above volume_ via `::before` — warm top light + base shadow + a gentle
  vertical falloff. Zero idle animation. Tunable via `--panel-light-strength` (default `1.8`). **No grain/
  texture** (WO121 Rev 1 removed it — grain blows up on the frosted glass into sandpaper); the frosted glass
  - lit volume carry the richness.
- **On hover:** `::after` is a single soft warm cursor sheen following `--spot-x` / `--spot-y` (written by
  `PointerSpotlight`); `opacity` 0→1. No mask, no weave.
- **No nesting:** a `surface-panel--living` must never be an ancestor/descendant of another (WO121 removes
  inner `living` from nested section panels; `PointerSpotlight` writes vars to **all** living ancestors as a
  hardening guard).
- **Reduced motion:** static lit volume remains; hover sheen disabled.
- **Usage:** outermost Backtests section panels (WO119 + WO120 + WO121); WO122–126 adopt on their primary
  section panels during rollout. Surfaces are neutral-black + frosted glass (WO121) — warmth lives in the
  accents + light, not the fill.

---

|  Tier | Name        | Where                                    | Treatment                                                                                                          |
| ----: | ----------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **0** | Structural  | surfaces, idle text, idle borders        | no gold; silver/neutral only — the majority of pixels                                                              |
| **1** | Wayfinding  | section headers, units, dividers         | faint `brass-600` text/hairline; quiet, read-past                                                                  |
| **2** | Interactive | hover / focus                            | border warms to `brass-500`; focus ring `brass-500` (keep existing `:focus-visible`)                               |
| **3** | State       | active / selected / live                 | warm-black fill + tinted top edge `rgba(255,210,120,.5)` + soft `rgba(217,158,34,.35)` halo; label text `gold-400` |
| **4** | Moment      | primary CTA, running task, success flash | full bloom: `gold-400→brass-500` fill or conic border-chase (`quant-panel--active-run`), pulse dot                 |

Reuse existing animation utilities for tier 4 (`quant-panel--active-run`, `live-status-dot`). Retire
the all-over breathing/shimmer glows from dense grids — those collapse the accent ladder by making
everything tier-3/4 at once.

---

## Component inventory

The reusable React primitives built in WO117. Each names its elevation level and the accent tiers it
can express. Built on the material classes above so they inherit future token changes for free.

| Component               | Role                                                                    | Elevation          | States / accent                                                      |
| ----------------------- | ----------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `Panel` + `PanelHeader` | section container + its small-caps title                                | 0                  | header text = tier 1                                                 |
| `SectionHeader`         | standalone small-caps brass label (+ optional count/affordance)         | —                  | tier 1                                                               |
| `LabeledField`          | label + control wrapper (consistent label/hint/error)                   | wraps a −2 control | error state; optional `labelEnd` adornment (compact hints)           |
| `SegmentedToggle`       | pill group (`EMA/HMA/SMA`, `Any/All/Majority`)                          | track −2, thumb +1 | selected = tier 3; single or multi                                   |
| `RangeChips`            | preset chips (`1M/3M/6M/1Y/YTD/All`)                                    | +1 chips           | selected = tier 3; `value` may be `null` when no preset is active    |
| `FilterPills`           | category filter row (`All/Trend/Mean reversion/…`)                      | +1 chips           | active = tier 3; `radiogroup` / `radio` semantics                    |
| `EntityCard`            | selectable strategy/entity card (title + type tag + description + meta) | +1, active accent  | hover = tier 2, active = tier 3; optional `badges` slot in title row |
| `RangeInput`            | min/max/step triplet on top of existing `NumberInput`                   | −2 wells           | per-field error                                                      |
| `StatTile`              | metric tile (label + value, optional delta)                             | +1                 | `valueTone` / `highlight` for value color; delta up/down, not gold   |

Existing primitives kept and re-skinned via materials, not rewritten: `Button` (`ui/button.tsx`,
cva), `Card` (`ui/card.tsx`), `NumberInput` (`ui/number-input.tsx`), `ConfirmDialog`, `ActiveOutline`.

---

## Rollout & checkpoints

- **WO116** — Foundation (CSS): tokens + `materials.css` ladders + warm-black. Propagates globally. ✅
  - 🔍 **Checkpoint A**: glance across the app; tune tokens before components depend on them.
- **WO117** — Shared primitive library + dev gallery route. ✅
- **WO118** — Pilot migration: Backtests (Simulation + Optimization). ✅
  - 🔍 **Checkpoint B** (the real gate): full vision on a dense page; lock component APIs.
- **WO119** — Checkpoint-B surface refinement: edges defined by luminance not faint warmth — `surface-well`
  "defined inset", `surface-panel` "defined outline" (30% warm border + lit top edge); opt-in
  `surface-panel--living`; `RangeInput` persistent Min/Max/Step captions; `NumberInput` crafted steppers. ✅
- **WO120** — Living panels = light, not pattern: replaces WO119 weave with lit-from-above volume + faint
  grain + cursor sheen (no repeating texture). ✅
- **WO121** — Cool surfaces (neutral-black, not chocolate) + restore frosted glass (translucent +
  `backdrop-filter`) + tune living light to read at real panel scale (strength 1.8 + vertical falloff) + fix
  living-panel nesting (stuck-center sheen). Must land **before** WO122. ✅
- **WO122** Discover ✅ · **WO123** Market Data ✅ · **WO124** Launcher ✅ · **WO125** Walkforward + Validate ✅ ·
  **WO126** Storage + System + News + app chrome ✅ — **batch complete** (full-UI design-system coverage).

## Out of scope

- No new runtime dependencies; no component framework (Radix is already present for primitives only).
- No behavior/logic changes during migration — visual + structural swap only.
- Charts' internal rendering (recharts/visx) unchanged; only their containing surfaces re-skin.
