# WO199 — Frontend: premium polish sweep (page-by-page finishing pass)

## Shared context (read first)

Final WO of the **WO193–WO199 premium-polish batch**; **strictly last, strictly solo** —
runs only after the parallel 196–198 lane has merged and 🔍 Checkpoint B is done. It
assumes the typography (193), motion (194), materials (195), DataTable (196), overlays
(197), and chart theme (198) are all live; running it in parallel with anything defeats
its purpose (it's the conformance pass over the merged whole). This is the finishing pass: walk every page with
a fixed checklist and fix the hundred small things that separate "good design system" from
"premium product" — alignment drift, spacing rhythm, orphaned pre-batch styling, missing
states. No new capabilities; only refinement of what exists.

This WO is deliberately a **checklist × pages matrix** rather than a feature spec. Work
page by page, commit page by page (one commit per page area), so review maps to screens.

Frontend repo: `q_frontend` — React/TS/Vite/Tailwind, `pnpm` (never npm), vitest. Paths
relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `docs/design/visual-design-system.md` — now includes the WO193–198 sections; it is the
  rulebook this sweep enforces.
- The page areas (same partition as the WO122–126 rollout):
  1. Backtests (Simulation + Optimization + StrategyStudio)
  2. Discover (incl. Research/Experiments tabs)
  3. Market Data
  4. Launcher
  5. Walkforward + Validate
  6. Storage + System + News
  7. App chrome (header, `AppDock`, MotionToggle, dev gallery)
- `src/components/ui/index.ts` — the primitive inventory; the sweep replaces bespoke
  one-offs with primitives wherever one exists.

## Goal

Every page passes the same 10-point checklist below; the app reads as one continuous,
finished instrument from first pixel to last — no screen left on the previous design floor.

## Tasks

Apply this **checklist** to each of the seven page areas, in the order listed (Backtests
first — it's the reference implementation; its decisions propagate):

1. **Spacing rhythm**: gaps on a 4px grid; section gaps consistent within a page (pick from
   the existing scale: 8/12/16/24); kill one-off `mt-[13px]`-style values.
2. **Alignment**: labels, values, and controls on shared edges; numeric columns
   right-aligned everywhere (not only in DataTable); button rows share a baseline; panel
   headers align across side-by-side panels.
3. **Primitive adoption**: any hand-rolled element with a `ui/` equivalent (buttons, chips,
   toggles, stat tiles, tables, overlays, section headers) migrates to the primitive.
   Genuinely bespoke elements stay bespoke — do not force-fit.
4. **Typography conformance**: no font sizes outside the WO193 scale; small-caps labels use
   the standard treatment; no leftover `font-bold` where the scale says 550/620; numerals
   tabular in every data context.
5. **State coverage**: every interactive element has visible hover, press, focus-visible,
   and disabled states from the system; every async region has loading and error states;
   every list has an empty state with quiet, useful copy (no bare "No data").
6. **Accent-ladder audit**: gold only where the tier table allows; demote decorative gold
   found on structural elements; verify no page has two tier-4 moments visible at once.
7. **Edge & scroll hygiene**: custom scrollbar styling consistent (thin, low-luminance);
   no double scrollbars; overflow fades/indicators where content clips; no horizontal
   overflow at 1280px width.
8. **Icon discipline**: one icon size per context (16px inline, 18px buttons — confirm the
   existing convention and enforce it); consistent stroke weight; no emoji-as-icon.
9. **Text selection + native artifacts**: selection color on-brand (`::selection` warm
   dark-gold, defined once); no native focus rings leaking; no default `<select>`/
   `<input type=number>` chrome remaining (WO119 steppers exist — use them).
10. **Dead styling removal**: delete orphaned classes/styles superseded by the batch
    (old `surface-control` one-off overrides, pre-WO193 font utilities, inline chart
    styles WO198 obsoleted) — leave the codebase as clean as the pixels.

Per-page execution note: keep a running `docs/work-orders/WO199-sweep-log.md` — one line
per fix (`page · checklist# · file · what`) so the reviewer can audit coverage without
diffing everything.

## Guardrails

> **Zero behavior changes**: no logic, no data flow, no API calls, no state-management
> edits. If a checklist fix would require touching behavior, log it in the sweep log as
> `DEFERRED` with a one-line reason instead of doing it.
> **No new components** — the sweep consumes the system; if a genuinely missing primitive
> is discovered, log it as `DEFERRED` (candidate follow-up WO), don't build it inline.
> **Testids and public APIs untouched.**
> **One commit per page area** (7 commits + docs) — reviewability is a deliverable.
> **When in doubt, do less**: this pass removes noise; it must never add decoration.

## Tests

- Full suite green after each page-area commit (`pnpm test:run` between areas, not only at
  the end — a sweep that breaks tests mid-way is unreviewable).
- Update class-name/style assertions broken by conformance fixes (update expectations to
  the system values; never delete a test to make the sweep pass).
- No new test files required, except: add a `globals.css` static check test (or extend an
  existing one) asserting `::selection` is defined once.

## Docs

- The sweep log (above).
- Final update to `docs/design/visual-design-system.md`: mark the WO193–199 batch complete
  in the rollout section; add a short **"Definition of premium"** checklist (the 10 points)
  as the standing bar for all future UI work.

## Definition of done

`pnpm test:run` and `pnpm build` pass — do not report completion until both do. Final
message must include: the sweep log summary (fixes per page per checklist point), the
`DEFERRED` list, and before/after notes for the three most visible fixes. Production
trigger: none — all changes are live on deploy.

## Out of scope

Anything behavioral; new features/components; performance work beyond what checklist fixes
incidentally deliver; responsive/mobile layouts; the backend; anything on the `DEFERRED`
list (that's its purpose).
