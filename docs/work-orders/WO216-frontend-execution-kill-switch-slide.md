# WO216 — Frontend: Execution Kill-Switch Slide Confirmation

## Shared context (read first)

Run only after WO215 receives VISUAL A acceptance. Read the batch decision record and the execution
contract in `docs/design/paper-live-execution.md`. The working tree may contain owner edits in
`src/workspaces/execution/ExecutionWorkspace.tsx`; inspect and preserve them. Never overwrite that
file wholesale.

Selected source: SmoothUI [Power Off Slide](https://smoothui.dev/docs/components/power-off-slide).
Inspect obtainable source and append URL/revision-or-capture/hash/dependency data to the design
record before implementation. Use the existing Motion runtime; no new dependency by default.

## Goal

Replace only the “Engage kill switch” button + generic confirm dialog with a deliberate horizontal
slide-to-confirm control. The gesture confirms intent; the backend still decides whether the global
paper kill switch is engaged. Release remains a separate conventional control because disengaging
risk protection must not visually masquerade as the destructive action.

## Files

```text
src/components/execution/PowerOffSlide.tsx
src/components/execution/__tests__/PowerOffSlide.test.tsx
src/workspaces/execution/ExecutionWorkspace.tsx
src/workspaces/execution/__tests__/ExecutionWorkspace.test.tsx
docs/design/premium-component-upgrades.md
```

## Implementation contract

1. Adapt the source into `PowerOffSlide` with controlled states
   `idle|dragging|armed|submitting|confirmed|rejected`, accessible name, instruction, and status.
2. The thumb must travel at least 88% of its available track to arm. Pointer release below threshold
   springs to idle and performs no mutation. Pointer release at/above threshold calls `onConfirm`
   exactly once. Lock interaction while submitting.
3. Keyboard parity: focusable slider semantics; Arrow keys adjust intent, Home resets, End arms, and
   Enter/Space confirms only while armed. Expose `aria-valuemin=0`, `aria-valuemax=100`, current value,
   and a live submission result without double-announcement.
4. Q styling: `surface-well` track, black-suede thumb, restrained rose danger edge, brass readiness
   marker, tabular progress. Remove SmoothUI colors/type/radius. No playful bounce or power icon spin.
5. Integrate with the existing `runKillSwitch(true)` mutation. Do not optimistically show Engaged.
   While pending show “Awaiting control plane”; only query/backend acknowledgement determines the
   engaged state. On rejection/error, animate back to idle and preserve the existing inline error.
6. When `killSwitch.enabled` becomes true, show the existing Engaged state and Release button. Keep
   release calling `runKillSwitch(false)` and keep all audit reason/confirm payload fields unchanged.
7. Reduced motion removes spring travel but keeps threshold, keyboard, pending, confirmed, and error
   feedback. Touch hit target is at least 44 px; track fits 320 px without horizontal overflow.

## Guardrails

- Do not change backend endpoints, request bodies, kill-switch meaning, flatten behavior, paper/live
  policy, or the separate flatten `ConfirmDialog`.
- Do not reuse this theatrical control for ordinary destructive actions.
- Preserve all unrelated owner changes in `ExecutionWorkspace.tsx` and record any overlapping lines.

## Verification

- Component tests: below/above threshold, pointer cancel, keyboard flow, one callback, pending lock,
  rejection reset, controlled engaged state, reduced motion, ARIA.
- Workspace tests: exact mutation body, no optimistic Engaged label, backend rejection, release path,
  flatten dialog unchanged.
- Run `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`.
- Manual desktop/mobile pointer, touch, keyboard, screen reader, slow response, 4xx/5xx, and route exit
  while submitting. Capture idle, armed, pending, engaged, and rejected states.

## Definition of done

The selected slide mechanic is visually recognizable and hard to trigger accidentally; every path
preserves backend authority and audit semantics. Handoff includes source/hash data, exact tests,
state captures, dirty-file preservation proof, and stops at `REVIEW` for VISUAL B.

## Out of scope

Flatten, stop/pause controls, backend execution behavior, or any other confirmation dialog.
