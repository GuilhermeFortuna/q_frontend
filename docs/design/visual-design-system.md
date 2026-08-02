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
|  **0** | `[data-glow=panel]` / `Panel`       | workspace shells, primary panels (the reference plane)                | brass GlowCard shell: frosted `color-mix` fill + `backdrop-filter: blur(var(--panel-blur))` + pointer-reactive border light (`--x/--y` from `PointerSpotlight`). Legacy `surface-panel` / `quant-panel` CSS remains for non-card chrome only.               |
| **+1** | `[data-glow=card]` / `[data-glow=tile]` / `Card` | content cards (`card`), dense metric/list tiles (`tile`)     | same GlowCard recipe at quieter intensity — `tile` drops outer bloom and backdrop blur so nested grids stay calm                                                                                                                                           |
| **+1** | `surface-control` / `surface-suede` | buttons, inputs, selects, selected chips                              | matte suede: opaque fill `linear-gradient(178deg,#131312,#0e0e0d 85%)`; no backdrop blur (touch material)                                                                                                                                                   |
| **+2** | `surface-overlay` / `surface-float` | modals, popovers, HUD, floating chart windows                         | fill `linear-gradient(165deg,#1d1814,#120f0b 72%)`; `border 1px rgba(168,139,82,.22)`, `border-top-color rgba(214,178,120,.3)`; `box-shadow: inset 0 1px 0 rgba(255,240,210,.12), 0 0 40px -10px rgba(196,165,116,.25), 0 26px 50px -18px rgba(0,0,0,.85)` |

**Shared glass blur.** Frosted glow panels/cards, shell `--blur`, float `--blur`, overlay scrim, and `q-table-container` use `--glass-blur` (default `20px`). `--panel-blur` aliases it. Prefer `tile` intensity for nested metric grids so blur does not compound.

**Hover** lifts within the level (slightly stronger top highlight + shadow), never recolors to gray.
`surface-shell` (header/dock) is unchanged in role but adopts the warm-black fill + edge-light and the shared `--glass-blur` when `--blur` is applied.

### Glow shells (card-like glass)

Content panels and cards use `GlowCard` (`[data-glow]`) instead of stacking `surface-panel` /
`surface-card` / `--living` on the same node (those fight for `::before` / `::after`).

- **Intensities:** `panel` (full frost + bloom), `card` (medium), `tile` (quiet — no bloom, no blur).
- **Pointer light:** one app-root `PointerSpotlight` writes local `--x/--y/--xp/--yp` to glow hosts
  (and still writes `--spot-x/--spot-y` to living/suede controls). GlowCard itself has no listeners.
- **`Panel.living`:** kept for API compatibility; absorbed into glow chrome (no `surface-panel--living`).
- **Reduced motion:** spot fill, border lights, and outer bloom opacity go to 0.
- **Do not glow:** overlays, dock/shell chrome, wells, suede controls, DataTable rows, HUD tooltips.

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

| Component                      | Role                                                                    | Elevation          | States / accent                                                      |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `GlowCard`                     | brass pointer-reactive glass shell (`panel` / `card` / `tile`)          | 0 / +1             | pointer border light; reduced-motion kills spot/bloom                |
| `Panel` + `PanelHeader`        | section container + its small-caps title                                | 0 (`GlowCard`)     | header text = tier 1                                                 |
| `Card`                         | generic content card shell                                              | +1 (`card`)        | composes `GlowCard`                                                  |
| `SectionHeader`                | standalone small-caps brass label (+ optional count/affordance)         | —                  | tier 1                                                               |
| `LabeledField`                 | label + control wrapper (consistent label/hint/error)                   | wraps a −2 control | error state; optional `labelEnd` adornment (compact hints)           |
| `SegmentedToggle`              | pill group (`EMA/HMA/SMA`, `Any/All/Majority`)                          | track −2, thumb +1 | selected = tier 3; single or multi                                   |
| `RangeChips`                   | preset chips (`1M/3M/6M/1Y/YTD/All`)                                    | +1 chips           | selected = tier 3; `value` may be `null` when no preset is active    |
| `FilterPills`                  | category filter row (`All/Trend/Mean reversion/…`)                      | +1 chips           | active = tier 3; `radiogroup` / `radio` semantics                    |
| `EntityCard` / `HistoryCard`   | selectable strategy/entity / history cards                              | +1 (`card` glow)   | hover = tier 2, active = tier 3; optional `badges` slot in title row |
| `RangeInput`                   | min/max/step triplet on top of existing `NumberInput`                   | −2 wells           | per-field error                                                      |
| `StatTile`                     | metric tile (label + value, optional delta)                             | +1 (`tile` glow)   | `valueTone` / `highlight` for value color; delta up/down, not gold   |
| `DataTable`                    | premium quantitative tabular grid with column alignments and sorting    | 0 on panel         | hover = tier 2 (luminance lift), selected = tier 3 (warm fill)       |
| `Dialog` / `ConfirmDialog`     | modal overlays                                                          | +2 overlay         | tier 1 header; scrim recedes workspace                               |
| `Popover` / `Menu` / `Tooltip` | anchored floats and action menus                                        | +2 float           | luminance item hover; no arrows on popovers                          |
| `toast` / `Toaster`            | transient top-right notifications                                       | +2 overlay cards   | success = tier-3 gold edge; errors = rose edge                       |

Existing primitives kept and re-skinned via materials, not rewritten: `Button` (`ui/button.tsx`,
cva), `Card` (`ui/card.tsx`), `NumberInput` (`ui/number-input.tsx`), `ConfirmDialog`, `ActiveOutline`.

### DataTable Visual Spec

To preserve visual consistency across dense grids (leaderboards, backtest results, optimization trials, walkforward windows), tables are built using the following structural rules:

- **Header:** Sticky (`position: sticky; top: 0`), opaque background (`#141311`) to prevent rows from ghosting through when scrolled. Labels use small-caps tier-1 brass styling (11px, weight 560, tracking 0.08em) with a minimal sort indicator chevron.
- **Row Heights:** Restrained row height target of `32px` to `36px` to maintain dense data presentation.
- **Separators:** Hairline borders at low luminance (`rgba(255,255,255,0.045)`).
- **Hover Lift:** Row hover causes a pure luminance lift (`rgba(255,255,255,0.035)`) and never applies warm/brass borders or gray tints.
- **Row Selection:** Selected rows use the Tier-3 State accent treatment: a warm background fill (`rgba(217, 158, 34, 0.07)`), gold-400 label text, and a `brass-400` left accent border on the first cell.
- **Numeric Cascading:** All numeric cells must utilize tabular numbers (`quant-tabular-nums` class / `font-variant-numeric: tabular-nums`) and align to the right, matching their column headers.

### Overlay layer (+2)

Transient surfaces share one material vocabulary and one motion contract. Radix owns focus traps, dismiss logic, and positioning; the design system owns pixels.

| Primitive           | Role                                                             | Material                                    | Motion                                |
| ------------------- | ---------------------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| `Dialog`            | modal work (confirm, indicator config)                           | `surface-overlay` + `surface-overlay-scrim` | `overlayEnter` / `overlayExit`        |
| `Popover`           | anchored panels (chart settings, filters)                        | `surface-float` (+ blur)                    | scale-in from anchor side, fast exit  |
| `Menu`              | dropdown / context actions                                       | `surface-float`                             | same as popover                       |
| `Tooltip`           | short labels and definitions (max 280px, text only)              | `surface-float` (compact)                   | delayed show (350ms), instant hide    |
| `toast` + `Toaster` | transient confirmations (save, duplicate, background completion) | `surface-overlay` card stack                | `fadeRise` enter, `overlayExit` leave |

**Toast vs inline feedback:** Errors that require user action stay in inline `Callout` surfaces. Toasts are for brief confirmations and passive completions only (max 3 visible, auto-dismiss 5s / errors 8s, hover pauses timer).

**Motion contract:** Entrances use `--motion-slow` (280ms) or `--motion-base` (180ms); exits always use `--motion-fast` (120ms). `useReducedMotion()` collapses all overlay motion to instant.

### Charts (WO198)

All chart frames — recharts and visx — consume a single theme module at `src/lib/charts/chartTheme.ts`. Recharts consumers import prop bundles from `src/lib/charts/rechartsTheme.tsx` (`ThemedXAxis`, `ThemedCartesianGrid`, `ThemedTooltip`, etc.); visx layers read the same tokens for axes, grids, and crosshairs.

**Rules:**

- **Grids and axes are furniture:** low-luminance solid hairlines (`rgba(255,255,255,.045)` grid, `.10` axis stroke). No dashed gray defaults; no chart-drawn dark plot backgrounds (plots stay transparent on `surface-panel` glass).
- **Light allocates attention:** hovered series brighten; non-focused series dim to ~45% (`chartTheme.focus.dimOpacity`). Brass crosshair + tabular axis readouts.
- **Palette order:** gold/brass first for the primary series, then cream/silver/steel for comparisons. Pos/neg always match StatTile tones (`emerald-400` / `rose-400`).
- **Tooltips:** one `ChartTooltip` component (`surface-float` material, `--text-xs` labels, tabular values, optional series chips). No inline axis/tooltip styling in chart consumers — extend the theme instead.

New charts must import `chartTheme` / `rechartsTheme`; inline axis colors are forbidden.

## Typography

Establish premium typography foundation using self-hosted fonts and numeric discipline to ensure data readability.

### Typeface Roles

- **Body & Interface (`--font-sans`):** `Inter Variable` (with system fallback). Used for general UI text, body copy, form fields, and labels. Variable font enables precise weight tuning.
- **Headings & Hero Metrics (`--font-display`):** `Inter Display` (with `Inter Variable` fallback). Used for panel headings, large statistics, and hero metrics. Tighter curves and optimized metrics for large sizes.
- **Data & Tables (`--font-mono`):** `Cascadia Code` (with system fallbacks). Used for code blocks, terminal logs, and technical values that require full monospace rendering.

### Type-scale & Tracking Tokens

Explicitly defined tokens in `@theme` to prevent ad-hoc font sizing:

- `--text-2xs: 10.5px/14px` (dense table meta)
- `--text-xs: 11.5px/16px`
- `--text-sm: 13px/18px` (standard body)
- `--text-base: 14px/20px`
- `--text-lg: 16px/22px`
- `--text-xl: 19px/24px` (display tracking applied)
- `--text-2xl: 24px/28px` (hero metrics, display tracking applied)
- `--tracking-display: -0.015em` (applied to size `>= text-xl` to tighten tracking at large sizes)

### Small-caps & Wayfinding

- Brass section labels (`.accent-wayfinding`): `font-weight: 560`, `font-size: 11px`, `letter-spacing: 0.08em`, and `text-transform: uppercase`. Re-tuned for Inter to prevent blurriness and maintain design-system prominence.

### Tabular Numeral Discipline

Numbers are the central product of a quantitative terminal and must sit in perfect alignment.

- **The Rule:** Numbers are always tabular in data contexts; proportional numerals are only used in prose.
- **Default Application:** Built into `.q-table-td` (all table cells), `input[type="number"]`, `.number-input--steppers`, `.stat-tile-value`, `.chart-tooltip`, and `.chart-tick`.
- **Escape Hatch:** Use the `.quant-tabular-nums` utility for one-off/ad-hoc numeric contexts.

## Motion

Coherent motion language focused on being fast, physical, and restrained. Transitions simulate physical controls.

### Durations

- **Fast (`--motion-fast: 120ms`):** Press feedback, exits, and hover-out transitions.
- **Base (`--motion-base: 180ms`):** Hover-in, focus, and small reveals.
- **Slow (`--motion-slow: 280ms`):** Overlay panels entering and panel-level reveals.
- **The Limit:** No transition or animation should exceed `280ms`.

### Easings

- **Decisive Arrival (`--ease-out`):** `cubic-bezier(0.16, 1, 0.3, 1)`. Default curve for arrivals/entries.
- **Reflows (`--ease-in-out`):** `cubic-bezier(0.65, 0, 0.35, 1)`. Used for layout shifts and reflows.
- **Accelerate Exit (`--ease-exit`):** `cubic-bezier(0.4, 0, 1, 1)`. Used for leaving elements that slide/fade away.

### Press & Hover Choreography

All interactive controls (Buttons, SegmentedToggle options, FilterPills, RangeChips, steppers, EntityCards, and AppDock items) must follow this physical choreography:

- **Hover-in:** `--motion-base` duration / `--ease-out` curve. Lift is handled by materials; **no scaling** is permitted on hover (prevents "bubbly" consumer web feel).
- **Press (active state):** `--motion-fast` duration / `--ease-out` curve. Standard physical translation of `scale(0.985)` + `translateY(0.5px)` ("pushing the hardware button in").
- **Hover-out / release:** `--motion-fast` duration / `--ease-exit` curve.
- **Focus:** Outline indicator appears instantly (`0ms`), while outline shadows/glows fade in over `--motion-base`.

### Reduced Motion Contract

- **CSS Gate:** When `html[data-reduced-motion='true']` (synced from preferences) is active, all transitions and animations are globally set to `0ms !important`.
- **JS Gate:** The hook `useReducedMotion()` combines `prefers-reduced-motion` and the user's `MotionToggle` state. Presets (`fadeRise`, `overlayEnter`, `overlayExit`, `staggerChildren`) collapse to duration-0/instant variants when true.

## Material Vocabulary (v2)

To create a physical, premium feel reminiscent of a professional quantitative terminal, the interface is governed by a distinct **Material Vocabulary** where different roles look and feel like different substances.

### The Three Core Materials

1. **Glow Glass (`GlowCard` / `[data-glow]`) — Space**
   - **Role:** Structural workspace panels, content cards, and metric/list tiles (`panel` / `card` / `tile` intensities).
   - **Appearance:** Frosted brass spotlight shell — translucent fill, mask-composite border light following the pointer, optional outer bloom. Quiet `tile` intensity for dense nested grids.
2. **Black Suede (`surface-suede` / `.surface-control`) — Touch (+1 Controls)**
   - **Role:** Interactive controls, buttons, SegmentedToggle thumbs, pills, chips, and selected control states (not raised content cards — those use glow glass).
   - **Appearance:** An ultra-matte, light-absorbing surface that is visually darker and flatter than the glass panels it sits on. It catches light via a soft pointer sheen (`::after` radial gradient) following the cursor.
   - **Press state:** On active press, the suede nap compresses (sheen radius contracts by ~60% and lightens, while background fill darkens one step).
3. **Machined Brass (`button-machined-brass` / Tier-4 Accent) — Significance**
   - **Role:** Primary Call-To-Action buttons and extreme structural landmarks (Tier 4 of the accent ladder). Used very sparingly.
   - **Appearance:** Milled/machined metal look with a high-contrast vertical gradient (`brass-500` to `brass-700`), a crisp 1px top bevel highlight, and a dark lower border. Text is rendered in high-contrast near-black.

### The "No Printed Textures" Rule

Richness must come exclusively from how a surface catches light (specular reflections, pointer sheen, edge bevels), **never from printed textures**. Repeating patterns, PNG noise images, and SVG `feTurbulence` are strictly prohibited. These patterns break scalability, create visual noise on dense screens, and feel like precision machinery rather than synthetic web design.

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
- **WO193–WO199** — Premium polish batch ✅ (typography, motion, materials, DataTable, overlays, chart
  theme, page-by-page finishing sweep). See **Definition of premium** below.

## Definition of premium

Standing bar for all future UI work — the same 10-point checklist enforced in WO199:

1. **Spacing rhythm** — gaps on the 4px grid; section gaps from the scale (8/12/16/24); no one-off pixel nudges.
2. **Alignment** — labels, values, and controls on shared edges; numerics right-aligned in data contexts; button rows on one baseline.
3. **Primitive adoption** — use `ui/` primitives where they exist; bespoke only when genuinely unique.
4. **Typography conformance** — WO193 type scale only; wayfinding labels via `.accent-wayfinding` + `text-2xs font-[560]`; tabular numerals in data.
5. **State coverage** — hover, press, focus-visible, disabled on interactives; loading/error/empty on async regions.
6. **Accent-ladder audit** — gold only per tier table; structural chrome tier-0 (silver); no competing tier-4 moments on one screen.
7. **Edge & scroll hygiene** — thin low-luminance scrollbars; no double scrollbars; no horizontal overflow at 1280px.
8. **Icon discipline** — one size per context (16px inline, 18px buttons); consistent stroke; no emoji-as-icon.
9. **Text selection + native artifacts** — single `::selection` in `globals.css`; `wellInputClass` on native controls; no default chrome leaks.
10. **Dead styling removal** — delete superseded one-offs; extend the system instead of forking inline styles.

Sweep log: `docs/work-orders/WO199-sweep-log.md`.

## Hero dispensation

This section governs the single-use hero state layout added in WO207 for the AI Strategy Builder workspace host:

1. **Aurora ambient background** — The `.surface-aurora` class is the _only_ allowed slow-breathing ambient light animation in the application. It is restricted strictly to the empty state of the AI Strategy Builder hero panel. It must never be applied to any other panel or surface. It is gated to a static rendering under reduced motion preference.
2. **Ombré-keyword rule** — A text gradient (brass→cream ombré) is allowed _only_ for the single greeting keyword ("building") in the empty builder state greeting. No other text elements may carry this gradient.
3. **Pill composer** — A frosted glass pill (`.surface-panel` styling with custom rounded-full/relaxed radius borders) is utilized as a single focal object centered mid-screen in the empty state, docking to the bottom upon starting a conversation. It contains the model picker in its left edge as a quiet suede chip and the machined-brass circular send button in its right edge.
4. **Editorial turn** — Assistant chat turns follow a strict hierarchical structure: isolated bold headline (first sentence) first, followed by quiet body description, prominent suede question cards with a brass left edge, and a collapsible "Details" drawer for diff chips and change lists. A pending response renders an animated shimmer line, which scales back to static dots under reduced motion.

## Out of scope

- No new runtime dependencies; no component framework (Radix is already present for primitives only).
- No behavior/logic changes during migration — visual + structural swap only.
- Chart _data_ logic and interaction hooks unchanged; chart _frame_ styling is centralized in WO198 (`chartTheme` / `rechartsTheme`).
