# WO196 — Frontend: premium DataTable primitive + migration of the dense grids

## Shared context (read first)

Fourth of the **WO193–WO199 premium-polish batch**; runs after 🔍 Checkpoint A (WO193–195
foundations reviewed). **May run in parallel with WO197 and WO198** — work on its own
branch; the only shared files are `/dev/ui`, `ui/index.ts`, and the design doc (append-only;
merge in numeric order). **🔍 Checkpoint B follows the whole 196–198 lane** — tables are the
densest surfaces in the app, so they are the proving ground for the whole second pass,
exactly as the Backtests pilot was for WO116–126.

Tables are where a quant terminal earns "premium" or loses it: leaderboards, optimization
results, trade lists. Today `ui/table.tsx` is a thin styled wrapper (`q-table*` classes in
`globals.css` ~line 617+) and each page hand-rolls its own columns, sorting, and number
formatting — so alignment, numerals, and hover behavior drift per page. This WO builds one
`DataTable` primitive on the WO193 numeric discipline + WO195 materials, then migrates the
worst offenders onto it.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), vitest + Testing
Library. Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/components/ui/table.tsx` + the `q-table*` styles in `src/styles/globals.css` — the
  base to build on (keep these exports working; `DataTable` composes them).
- The dense grids to migrate (locate each; names may drift):
  - Discover results leaderboard (Entry + Exit columns, WO89) —
    `src/components/discover/…`
  - Optimization results/trials table — `src/components/optimize/…`
  - Backtests trade list + per-run metrics tables — `src/components/backtests/…`
  - Walkforward window/segment tables — `src/components/walkforward/…`
- `src/components/ui/StatTile.tsx` — `valueTone` conventions for pos/neg coloring; the
  table's delta cells must use the same tone semantics, not a new palette.
- WO70–72 memory (`docs/work-orders/WO70*–WO72*`): the typing/hover perf lessons — dense
  grids previously caused re-render storms; the primitive must be built memo-first.
- `docs/design/visual-design-system.md` — accent tiers (row selection = tier 3).

## Goal

```tsx
<DataTable
  columns={[
    { id: 'name', header: 'Strategy', align: 'left', sticky: true },
    { id: 'sharpe', header: 'Sharpe', align: 'right', numeric: true, sortable: true },
    { id: 'pnl', header: 'PnL', align: 'right', numeric: true, tone: 'signed' },
  ]}
  rows={rows}
  rowKey={(r) => r.id}
  selectedKey={selectedId}
  onRowClick={...}
/>
```

One table primitive that makes every dense grid in the app read like a Bloomberg-grade
instrument: perfect numeric columns, luminance row hover, sticky headers, and zero per-page
visual drift.

## Tasks

1. **`src/components/ui/DataTable.tsx`** (+ export from `ui/index.ts`), composing the
   existing `Table*` parts. Column API: `align` (left/right/center), `numeric` (applies
   tabular-nums + right-align + `--font-sans` numeric styling from WO193), `tone`
   (`'signed'` → pos/neg coloring via the `StatTile` tone conventions; `'neutral'`),
   `sortable`, `width`/`minWidth`, optional `render(row)` cell renderer, `sticky` for the
   leading identity column (horizontal-scroll tables).
2. **Visual spec** (extend `q-table*` styles; all values as CSS custom properties):
   - Header: small-caps tier-1 brass labels (matches `SectionHeader` type treatment from
     WO193), sticky (`position: sticky; top: 0`) with an opaque-enough fill that rows
     scrolling under it don't ghost through; sortable headers get a minimal chevron whose
     appearance uses `--motion-fast` — no header buttons that look like web-app chrome.
   - Rows: generous but dense line-height (target 32–36px rows), hairline separators at low
     luminance (`rgba(255,255,255,.045)`), **hover = luminance lift** (fill lightens one
     step — never gray, never warm-tint border), selected row = tier-3 treatment (warm fill
     - gold label accents per the accent ladder).
   - Numerals: every `numeric` column tabular + slashed-zero + right-aligned; signed tones
     use the existing pos/neg colors; a `formatNumber` prop hook but **no built-in
     formatting logic** — pages keep their own formatters (behavior-preserving).
   - Empty state: centered quiet message slot; loading: a subtle row-shimmer skeleton
     (respects WO194 reduced-motion → static placeholder).
3. **Sorting**: controlled (`sort`, `onSortChange`) _and_ uncontrolled convenience mode.
   Sorting is presentation only — pages that already sort server-side pass `sort` +
   `onSortChange` and the primitive renders indicators without touching data.
4. **Perf-first construction** (WO70–72 lessons are binding): memoized `Row` component keyed
   by `rowKey`; cell renderers received via a stable `columns` reference (document that
   callers must `useMemo` columns — and do so in the migrations); hover state via CSS only
   (no React hover state); `onRowClick` via a single delegated handler on `tbody`, not one
   closure per row. Target: 500-row leaderboard scrolls and hovers with zero dropped frames.
5. **Migrate the four grid families** from Task list in "How the pieces work today":
   Discover leaderboard, Optimization trials, Backtests trades + metrics, Walkforward
   windows. Behavior-preserving: same columns, same formatters, same click/selection
   semantics, same testids (add `data-testid` passthrough to `DataTable` so existing ids
   land on the same elements).
6. **Gallery**: add a DataTable section to `/dev/ui` — 50-row sample with numeric/tone/
   sortable/selected/empty/loading states — the Checkpoint B review artifact.

## Guardrails

> **Behavior-preserving migration**: no column additions/removals, no formatter changes, no
> sorting-semantics changes on migrated pages. Visual + structural swap only.
> **No new dependencies** — no TanStack Table; the API above is deliberately small. If a
> migration needs a feature beyond it (virtualization, grouping), stop and note it for a
> follow-up WO instead of growing this one.
> **No mock data**: gallery uses inline literals in the dev route; migrated pages keep their
> real queries. House CI grep for `@/mocks` applies.
> **Perf gate**: before reporting done, profile the Discover leaderboard hover/scroll with
> React DevTools profiler — row hover must cause **zero** React re-renders (CSS hover only).
> **Numeric columns must be tabular** — if any migrated column renders proportional digits,
> the WO193 default isn't reaching it; fix the cascade, don't inline-style around it.

## Tests

`src/components/ui/__tests__/DataTable.test.tsx` (new):

- renders columns with correct alignment classes; `numeric` cells carry tabular-nums;
- `tone: 'signed'` colors positive/negative values per the tone convention;
- controlled sort: header click calls `onSortChange`, indicator reflects `sort` prop,
  row order unchanged (presentation-only);
- uncontrolled sort orders rows; stable for equal keys;
- `selectedKey` row carries the selected class; `onRowClick` fires with the row via the
  delegated handler; empty + loading states render;
- rowKey stability: re-render with same rows creates no new row DOM nodes (assert via
  element identity where feasible).

Migrated-page suites stay green with their existing assertions (testids preserved).

## Docs

Extend `docs/design/visual-design-system.md` component inventory with `DataTable` (role,
elevation 0-on-panel, accent tiers used) and the table visual spec (row heights, separators,
hover/selected rules).

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the `DataTable` props type as shipped, the four migrated grid locations
(file paths), the profiler evidence for the zero-re-render hover claim, and preserved
testids per migration. **🔍 Checkpoint B** happens once the full 196–198 lane has merged —
the user reviews tables, overlays, and charts together before WO199 proceeds.

## Out of scope

Virtualization (note if needed; separate WO); grouping/pivoting; CSV export; chart-embedded
mini-tables (WO198); the non-grid `KeyValueGrid` primitive; server-side pagination changes;
touching query/data code on migrated pages.
