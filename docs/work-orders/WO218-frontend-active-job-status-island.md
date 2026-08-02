# WO218 — Frontend: Active-Job Status Island

## Shared context (read first)

Run only after VISUAL C. Selected source: SmoothUI [Dynamic Island](https://smoothui.dev/docs/components/dynamic-island).
Inspect/hash its obtainable source and append provenance to the batch design record. This selects its
morphing information architecture—not Apple styling. Read `AppDock.tsx`, `useActiveJobs.ts`, the
dock tests, and the performance budget before changing anything.

## Goal

Replace the row of fixed-width running-job cards appended to the dock with one Q-native status
island. It stays compact for one job, morphs to summarize concurrent jobs, and expands on deliberate
interaction into an inspectable job list. Existing queries, destination routes, percentages, and
job truth remain unchanged.

## Files

```text
src/components/dock/ActiveJobIsland.tsx
src/components/dock/__tests__/ActiveJobIsland.test.tsx
src/components/dock/AppDock.tsx
src/hooks/useActiveJobs.ts
src/hooks/__tests__/useActiveJobs.test.tsx
src/components/dock/__tests__/AppDock.test.tsx
docs/design/premium-component-upgrades.md
```

## Implementation contract

1. Keep `useActiveJobs()` the only query aggregator. Extend `ActiveJobInfo` only with stable fields
   already derivable from current query data: workspace id/label, `pct`, `detail`, and
   `progressKind: determinate|indeterminate`. Do not start new polling or duplicate queries.
2. `ActiveJobIsland` has controlled modes `hidden|compact|expanded`. Zero jobs unmounts it. One job
   shows icon, short label, and progress. Multiple jobs show the most recently changed/running job
   plus a `+N` count. Expanded mode lists all jobs in dock order with their existing destinations.
3. Preserve the selected component's shared-layout capsule morph, content crossfade, and spring-like
   reflow. Restyle with `surface-float`, warm-black glass, smoked silver, and one brass live accent.
   It attaches to—not restyles—the current dock.
4. Click/Enter/Space toggles expansion; Escape and outside click collapse; job-row activation
   navigates to its workspace through WO215's transition owner. Maintain focus through morphs and
   return focus to the trigger on collapse.
5. Progress updates must not retrigger the whole enter animation. Determinate width/value updates are
   smooth; indeterminate jobs display a semantic activity treatment without pretending `0%` means
   measured progress. Announce job start/completion once, not every percentage tick.
6. Clamp expanded content to viewport, support 390 px width, and keep dock items reachable. Reduced
   motion swaps layouts instantly. No root listener, RAF, Canvas, or extra polling.
7. Remove only the existing `runningJobs` card rail after parity is proven. Keep the small live dots
   on each owning dock icon as local wayfinding.

## Verification

- Tests: zero/one/many jobs, determinate/indeterminate, percentage updates without remount, ordering,
  expansion/focus/Escape/outside click, destination, completion announcement, reduced motion.
- Prove query call counts did not increase. Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint`,
  `pnpm build`, `pnpm perf:smoke`, `git diff --check`.
- Manual: one optimization, concurrent discover/walk-forward, job completion, narrow viewport,
  keyboard-only, rapid updates, route changes, Tauri/WebKitGTK.

## Definition of done

The island morph is visibly premium, the dock remains recognizably Q, and all job data comes from the
existing owner without polling growth. Handoff includes source/hash, query-count proof, state
captures/recording, commands, and stops at `REVIEW` for VISUAL D.

## Out of scope

Job cancellation, notifications center, query/backend changes, dock redesign, or completed-job
history.
