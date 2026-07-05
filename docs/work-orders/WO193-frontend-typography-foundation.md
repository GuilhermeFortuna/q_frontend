# WO193 — Frontend: typography foundation (self-hosted premium typeface + numeric discipline)

## Shared context (read first)

First of the **WO193–WO199 premium-polish batch** — the "second elevation pass" on top of the
completed WO116–126 visual design system.

**Batch execution sequence:** `193 → 194 → 195 → 🔍 Checkpoint A → { 196 ∥ 197 ∥ 198 in
parallel } → 🔍 Checkpoint B → 199`. WO193–195 are strictly serial (they share `globals.css`
and `button.tsx`, and 195 consumes 194's tokens); WO196/197/198 may run in parallel on
separate branches (disjoint areas — merge in numeric order; expect trivial append conflicts
in `/dev/ui`, `ui/index.ts`, and the design doc); WO199 is strictly last.

The single most "default-feeling" thing left in the app is the type: `--font-sans` is
`'Segoe UI', system-ui, …` (a Windows system font). This WO replaces it with a self-hosted
premium typeface and establishes numeric discipline (tabular numerals wherever data appears).
This is a quant terminal — numbers are the product; they must sit in perfect columns.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), tests with vitest +
Testing Library. Paths relative to `C:\Users\guilherme\q\`. The app also ships inside Tauri, so
**fonts must be bundled locally — no CDN, no Google Fonts requests** (must work fully offline).

## How the pieces work today (read these files)

- `src/styles/globals.css` — `@theme` tokens; `--font-sans` / `--font-mono` at lines ~35–36;
  `.quant-tabular-nums` utility (~line 201) already exists but is barely used; small-caps
  header styling with `letter-spacing: 0.08em` (~line 660)
- `src/styles/materials.css` — surface classes (do not touch here; WO195 owns materials)
- `src/components/ui/SectionHeader.tsx`, `Panel.tsx` (PanelHeader) — the small-caps brass
  labels that carry most of the app's typographic identity
- `src/components/ui/StatTile.tsx`, `table.tsx` (`q-table*` styles live in `globals.css`
  ~line 617+) — the numeric surfaces that need tabular treatment
- `docs/design/visual-design-system.md` — the design-system source of truth (you will extend it)

## Goal

```css
/* globals.css @theme after this WO */
--font-sans: 'Inter Variable', 'Segoe UI', system-ui, sans-serif;
--font-display: 'Inter Display', var(--font-sans); /* headings + hero numerals */
--font-mono: 'Cascadia Code', 'Consolas', ui-monospace, monospace; /* unchanged */
```

Inter (variable, self-hosted woff2) as the app face, Inter Display for headings and large
stat numerals, a defined type scale, and `tabular-nums` applied by default to every numeric
context — so the whole app snaps from "Windows app" to "designed instrument" in one WO.

## Tasks

1. **Self-host the fonts.** Add `InterVariable.woff2` and `InterDisplay` weights (or the
   `InterVariable` display axis if using Inter 4.x, which exposes an optical-size/display
   cut) under `src/assets/fonts/inter/`. Inter is SIL OFL — include the license file next to
   the fonts. Declare `@font-face` in `globals.css` with `font-display: swap`, variable
   `font-weight: 100 900`, and woff2 only (Tauri + evergreen browsers; no legacy formats).
2. **Wire tokens.** Update `--font-sans` as in the Goal snippet; add `--font-display`.
   Verify the Tailwind theme picks them up (the project uses CSS `@theme` tokens — headings
   and any `font-display` utility must resolve).
3. **Type scale + tracking.** Define an explicit scale as tokens (do not invent per-page
   sizes): `--text-2xs: 10.5px/14px` (dense table meta), `--text-xs: 11.5px/16px`,
   `--text-sm: 13px/18px` (body), `--text-base: 14px/20px`, `--text-lg: 16px/22px`,
   `--text-xl: 19px/24px`, `--text-2xl: 24px/28px` (hero stats). Inter needs slightly
   negative tracking at large sizes: `--tracking-display: -0.015em` applied ≥ `--text-xl`;
   keep the existing `0.08em` small-caps tracking for brass section labels but re-tune the
   small-caps weight for Inter (Segoe small-caps ran heavy; Inter wants ~560 variable weight
   at 11px uppercase — eyeball against the current look, the labels must not get lighter or
   blurrier).
4. **Numeric discipline.** Make `font-variant-numeric: tabular-nums slashed-zero` the
   _default_ in numeric contexts instead of an opt-in utility: apply inside `q-table` cells,
   `StatTile` values, `NumberInput`/`RangeInput` fields, and chart tick/tooltip text (WO198
   will consume this). Keep `.quant-tabular-nums` as the escape hatch for one-off numerals.
   Large stat values (`StatTile`, launcher hero metrics) switch to `--font-display` with
   `--tracking-display`.
5. **Sweep the hardcoded font references.** `grep -rn "Segoe" src/` and remove/replace every
   hit (there should be none left outside `globals.css` fallbacks).
6. **Weight audit.** Inter renders lighter than Segoe at the same weight on dark backgrounds.
   Do one pass over the primitives (`Button`, `SectionHeader`, `PanelHeader`, `StatTile`,
   `EntityCard` titles, dock labels) bumping weights where text now reads thin (typically
   `font-medium` → 550, `font-semibold` → 620 via variable weights). Body text stays ≤ 450 —
   premium reads _light and precise_, not bold.

## Guardrails

> **No network font loading.** The fonts ship in the bundle; a fully offline Tauri build must
> render identically. No `<link>` to any font CDN anywhere.
> **No layout redesign.** This WO changes the type system only — if a container clips or
> wraps because Inter metrics differ from Segoe, fix the container minimally; do not
> restructure pages (WO199 owns the sweep).
> **Do not touch `materials.css`** — WO195 owns surfaces; keep the diff surface clean.
> **Bundle size:** woff2 only, subset if the file exceeds ~350 KB total (latin + latin-ext is
> enough; strategy names are user-typed Latin text).

## Tests

- `src/components/ui/__tests__/typography.test.tsx` (new): renders `StatTile` and a `q-table`
  cell, asserts computed `font-variant-numeric` contains `tabular-nums`; asserts the document
  root resolves `--font-sans` to Inter.
- Existing suites must stay green — Inter changes metrics, so any snapshot/size-assertion
  tests that break get their expectations updated (not deleted).
- Manual: `pnpm dev`, open Backtests + Discover + Launcher; screenshot before/after for the
  Checkpoint A review after WO195.

## Docs

Extend `docs/design/visual-design-system.md` with a **Typography** section: the two faces and
when each is used, the type-scale tokens, the tracking rules, and the tabular-numerals rule
("numbers are always tabular in data contexts; proportional numerals only in prose").

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the `@font-face` block as shipped, total added font bytes, the type-scale token
list, and the list of components whose weights were adjusted in the weight audit. Production
trigger: none — fonts load via `globals.css` on every page automatically.

## Out of scope

Motion/interaction changes (WO194); surface/material changes (WO195); table structure
(WO196); chart text styling application (WO198 consumes the tokens); page-level spacing fixes
(WO199). Changing `--font-mono`.
