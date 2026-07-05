# WO202 — Frontend: AI Builder page polish (layout, hierarchy, premium conformance)

## Shared context (read first)

Third of the **WO200–WO202 group**. Execution sequence: `200 → 201 → 202`, strictly serial —
this WO edits the same files as WO201 (the panel + workspace) and must land after it.

The AI Builder workspace (`/strategy-builder`, dock tab "AI Builder") predates the WO193–199
premium-polish batch's standards and it shows (screenshot review, 2026-07-05):

1. **Duplicated identity**: the page header says "AI Strategy Builder — Describe, validate,
   apply, save, and iterate…" and the panel directly below repeats the same title _and_ the
   same sentence. Say it once.
2. **Dead viewport**: a narrow `max-w-5xl` column with the panel ending a third of the way
   down — two-thirds of the screen is empty background. A chat-centric workspace should own
   its vertical space: the transcript area must grow to fill the viewport.
3. **Orphaned name/description band**: NAME / DESCRIPTION / NEW / SAVE sit in a separate
   panel above the builder, visually disconnected from the draft they describe.
4. **Flat internals**: the model select and composer sit as bare wells in an undifferentiated
   panel; the empty state is a single line of centered text with no affordance.

This is a **conformance + layout** WO: bring the page up to the WO193–199 standard using the
existing primitives and materials — no new visual language, no new capabilities.

Frontend repo: `q_frontend` — React/TS/Vite, `pnpm` (never npm), vitest + Testing Library.
Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/workspaces/strategy-builder/StrategyBuilderWorkspace.tsx` (~143 lines) — page header
  (icon tile + `font-display` title + description), the name/description `Panel living`
  band (NEW/SAVE buttons), then `AiStrategyPanel`
- `src/components/backtests/setup/AiStrategyPanel.tsx` — inner duplicate header
  (Sparkles + "AI Strategy Builder" + "Describe, validate, apply, save, and iterate."),
  model picker (as WO201 left it), `AiChatTranscript`, composer textarea, INTERPRET button,
  results/preview sections; `inputClass` from `@/components/shared/InstrumentConfigFields`
- `src/components/backtests/setup/AiChatTranscript.tsx` (WO192) — height-bounded scroll
  container; the empty-state teaser copy lives here or in the panel (locate it)
- `src/components/ui/` — `Panel`/`PanelHeader`, `SectionHeader`, `LabeledField`, `Button`
  (suede/machined-brass from WO195), `toast` (WO197)
- `docs/design/visual-design-system.md` — the rulebook, incl. the WO199 "Definition of
  premium" checklist; `docs/work-orders/WO199-sweep-log.md` — what the sweep already touched
  here (StrategyBuilderWorkspace title demotion etc.); don't undo those fixes
- Note: `AiStrategyPanel` is **also rendered inside the Backtests workspace** (its original
  home). Every change must look right in both hosts — check how Backtests mounts it before
  restructuring.

## Goal

One continuous, full-height builder: identity stated once, the strategy's name/description
integrated as the draft's header, the transcript owning the freed vertical space, and every
control on the premium material/typography system — the page reads like the flagship
workspace the dock tab implies, in both its hosts.

## Tasks

1. **De-duplicate identity.** Keep the workspace-level page header (icon tile + title +
   one-line description). In `AiStrategyPanel`, render the inner "AI Strategy Builder"
   header **only when not hosted by the StrategyBuilder workspace** (a `hideHeader`/
   `variant` prop, default = today's behavior so Backtests is untouched).
2. **Merge the name/description band into the builder.** In the workspace, fold NAME /
   DESCRIPTION / NEW / SAVE into the top of the builder surface as the _draft header_:
   name as a quiet, larger inline input (the draft's working title), description beneath
   it, NEW/SAVE right-aligned in the same row (SAVE = suede `default`; keep NEW secondary).
   Use `LabeledField` conventions; behavior, handlers, and testids unchanged.
3. **Full-height layout.** The workspace column becomes a flex column filling the viewport
   (respecting the app chrome + dock): draft header and model row fixed, `AiChatTranscript`
   `flex-1` with its own scroll (it's already height-bounded — rewire the bound to the
   flexed container), composer + INTERPRET pinned at the bottom of the panel. Widen the
   column (`max-w-5xl` → `max-w-6xl`) so the transcript breathes; no horizontal overflow at
   1280px (WO199 checklist #7).
4. **Empty state with affordance.** Replace the single teaser line with a quiet centered
   block: the teaser sentence plus 3 example-prompt chips (reuse the chip primitives;
   clicking prefills the composer and focuses it — same mechanism as WO192's question
   chips). Copy for the three examples: trend-following, mean-reversion, breakout — one
   short sentence each, matching the existing placeholder's tone.
5. **Control conformance.** Model row: "Model" label per WO201 as a `LabeledField` with the
   provider name as `labelEnd` hint; composer textarea gets the `surface-well` defined-inset
   treatment (if `inputClass` doesn't already provide it); INTERPRET becomes the panel's
   tier-4 moment — machined-brass (`brass` variant), the only tier-4 element visible; all
   other buttons suede/ghost per the accent ladder.
6. **Checklist pass.** Finish with the WO199 10-point checklist over this page only
   (spacing rhythm, alignment, typography scale, state coverage incl. loading/error on the
   models query, accent audit, scroll hygiene, icon discipline). Log fixes in a short
   appendix to `docs/work-orders/WO199-sweep-log.md` under an "Addendum: AI Builder
   (WO202)" heading.

## Guardrails

> **Zero behavior changes**: interpret/apply/save/run/optimize/reset flows, session hook
> wiring, and all testids stay identical; this WO moves and re-skins, it does not rewire.
> **Both hosts must stay correct**: `AiStrategyPanel` renders in Backtests setup _and_ this
> workspace — new props default to current behavior; run both suites; eyeball both screens.
> **System vocabulary only**: existing primitives, materials, motion presets, accent tiers —
> no new components (a genuinely missing primitive gets a `DEFERRED` note, per WO199), no
> new one-off styles beyond composition of existing classes.
> **One tier-4 element** on screen: INTERPRET. NEW/SAVE must not compete (accent ladder).
> **Transcript perf**: the flex-height change must not reintroduce per-keystroke re-renders
> of the transcript (WO192 guardrail stands; verify with the profiler if in doubt).

## Tests

- Existing `AiStrategyPanel` / transcript / session suites stay green (both-host coverage:
  add a smoke test rendering the panel with the new prop off and on — header present in
  Backtests mode, absent in workspace mode).
- Empty-state chips: click prefills + focuses the composer (same assertion pattern as
  WO192's question-chip test).
- Workspace test (add if none exists): renders draft header (name/description/NEW/SAVE),
  model row, transcript region, and composer without the duplicated inner header.

## Docs

Sweep-log addendum (Task 6). One paragraph in the AI-builder frontend doc describing the
two hosting modes of `AiStrategyPanel` and the prop that switches them.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the panel prop API as shipped, before/after layout description (what moved
where), confirmation both hosts render correctly (name the two routes checked), and the
sweep-log addendum contents. Production trigger: none — the workspace is already routed.

## Out of scope

Backend (WO200); picker logic (WO201); new capabilities (voice, attachments, streaming,
per-turn model badges); Backtests-side layout changes beyond the panel rendering
identically to today; renaming the route or dock tab.
