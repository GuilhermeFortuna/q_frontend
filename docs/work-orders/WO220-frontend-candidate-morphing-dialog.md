# WO220 — Frontend: Candidate Morphing Dialog

## Shared context (read first)

Run only after VISUAL E. Selected source: Motion Primitives
[Morphing Dialog](https://motion-primitives.com/docs/morphing-dialog). Inspect/hash the real source
and record provenance. Read `LeaderboardTable.tsx`, `CandidateDetailPanel.tsx`, `DataTable`, the
current Radix/Motion `Dialog.tsx`, virtualization tests, and route-state behavior.

## Goal

Pilot shared-element detail continuity in Discover: activating a candidate leaderboard row morphs
its identity/summary into a large focused candidate inspector. Replace the current inline expanded
row only for this flow. Keep the table dense, virtualized, sortable, and actionable.

## Files

```text
src/components/ui/MorphingDialog.tsx
src/components/ui/__tests__/MorphingDialog.test.tsx
src/components/discover/CandidateMorphingDialog.tsx
src/components/discover/LeaderboardTable.tsx
src/components/discover/CandidateDetailPanel.tsx
src/components/discover/__tests__/LeaderboardTable.test.tsx
docs/design/premium-component-upgrades.md
docs/design/visual-design-system.md
```

## Implementation contract

1. Adapt the source's shared-element origin-to-overlay morph, content handoff, and reverse close.
   Radix remains responsible for portal, focus trap, Escape, outside-dismiss policy, title/
   description semantics, and focus restoration. Do not replace generic `Dialog` or `ConfirmDialog`.
2. `MorphingDialog` is a generic UI primitive with controlled `open`, `onOpenChange`, stable
   `layoutId`, trigger/content slots, and optional `initialFocusRef`. Q materials own all pixels.
3. `CandidateMorphingDialog` carries candidate rank/name, objective summary, status, and gate badge
   from the activated row into a `surface-overlay` inspector, then renders the existing
   `CandidateDetailPanel` unabridged. No data-query or metric duplication.
4. Row click and Enter/Space open. Existing “Send to Backtest/Optimizer” buttons still stop row
   activation. Closing returns focus to the exact originating row even after sorting/filtering when
   it still exists; otherwise focus the table. Browser back and route exit close cleanly.
5. Remove expanded-row state, `renderExpandedRow`, expanded height estimate, and remeasure coupling
   only after the modal pilot passes. Virtualized row size returns to the fixed `ROW_HEIGHT`; opening
   cannot jump the underlying scroll position.
6. Motion uses the existing 280 ms maximum, Q easing, and one layout namespace. Reduced motion uses
   an instant Radix dialog with no shared-layout interpolation. Long content scrolls inside the
   inspector, not the page; 390 px width and 200% zoom remain usable.
7. Protect lazy equity/genome queries: they run only for the open candidate/current tab and stop or
   become inactive on close according to current query options. Rapid open/close cannot show data
   from the prior candidate.

## Guardrails

- This is one pilot, not a global migration of HistoryCard, panels, settings, or confirmations.
- Do not change candidate metrics, promotion behavior, sorting, filtering, DataTable API beyond
  removing now-unused expansion props at the call site, or server contracts.
- No nested dialog, duplicate focus trap, portal-local app shell, or unbounded layout animation.

## Verification

- Primitive tests: focus trap/restore, Escape/outside close, ARIA title/description, reduced motion,
  interrupted morph cleanup.
- Discover tests: row and keyboard open, action buttons don't open, correct candidate/detail query,
  tab behavior, rapid candidate switch, sort/filter origin fallback, virtualization scroll stability.
- Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm perf:smoke`,
  `git diff --check`.
- Manual desktop/mobile/200% zoom, mouse/keyboard, tall details, scroll position, browser back, route
  exit. Record open and reverse-close at normal and reduced motion.

## Definition of done

The source row visibly becomes the inspector, rather than merely opening a modal; accessibility and
virtualization are stronger or unchanged. Handoff includes source/hash, query/mount evidence,
captures, command results, and stops at `REVIEW` for VISUAL F.

## Out of scope

Other cards/history surfaces, destructive dialogs, candidate content redesign, or backend work.
