# WO215 — Frontend: Workspace Stripe-Shutter Transition

## Shared context (read first)

First order in the owner-approved premium interaction batch. Read
`docs/design/premium-component-upgrades.md`, `docs/design/visual-design-system.md`, and
`docs/runtime-performance.md`. Repo is `q_frontend`; use `pnpm`, never npm. Return this order to
`REVIEW`; VISUAL A is an owner gate and only its acceptance unlocks WO216.

Selected source: SmoothUI [Shader Reveal Transition](https://smoothui.dev/docs/components/shader-reveal-transition),
specifically the `stripes` variant. Obtain and inspect the actual source before adapting it. Record
the canonical URL, capture date/revision, exact copied files, SHA-256 hashes, and dependency findings
in `docs/design/premium-component-upgrades.md`. No licensing gate is required.

## Current seams

- `src/app/router.tsx` already enables TanStack Router view transitions and assigns forward/backward
  types from the workspace order.
- `src/components/layout/AppShell.tsx` owns persistent chrome and currently remounts `<main>` with a
  fade plus a small `quant-edge-ripple` on workspace changes.
- `src/components/cinematic/CinematicScene.tsx` owns the background and is the only allowed shell
  renderer. `src/lib/performance/budgets.ts` forbids a new always-on canvas or shell loop.
- `tests/unit/layout/viewTransitions.test.ts` protects header/dock continuity.

## Goal

Replace the generic main-content fade/edge ripple with one authored brass-on-black stripe shutter:
the outgoing workspace is briefly occluded by directional bands, navigation commits behind the
covered midpoint, and the incoming workspace is revealed in the same direction. Header and dock
stay spatially continuous. The effect must read as Q machinery, not as the SmoothUI demo.

## Files

Create or modify only:

```text
src/components/transitions/WorkspaceStripeShutter.tsx
src/components/transitions/workspaceTransitionStore.ts
src/components/transitions/__tests__/WorkspaceStripeShutter.test.tsx
src/components/layout/AppShell.tsx
src/components/dock/AppDock.tsx
src/app/router.tsx
src/styles/globals.css
tests/unit/layout/viewTransitions.test.ts
docs/design/premium-component-upgrades.md
docs/runtime-performance.md
```

## Implementation contract

1. Port the selected stripes mechanic into a single AppShell-owned overlay above main content but
   below header/dock. Provider fonts, colors, copy, and demo layout are forbidden.
2. The overlay exposes `phase: idle|covering|covered|revealing`, `direction: forward|backward`, and a
   Promise-returning `runWorkspaceTransition(commit)` API. Concurrent requests coalesce to the most
   recent destination; never run two transitions.
3. Total normal-motion duration is 520–640 ms: cover 220–280 ms, commit only after full occlusion,
   reveal 260–320 ms. Reverse stripe travel for backward navigation. Use brass edge light over an
   opaque carbon/espresso field; no rainbow/chromatic aberration.
4. Route all AppDock workspace navigation through this owner. Programmatic navigation may continue
   using router view transitions; it must still receive a safe reveal and must never strand the
   overlay. Same-route navigation and redirects do not replay the shutter.
5. Prefer a DOM/CSS translation of the source when it preserves the stripes signature. If the source
   fundamentally needs WebGL, use one transient surface mounted only while phase is non-idle,
   registered with performance instrumentation and fully disposed afterward. Do not add a persistent
   Canvas, independent RAF, root listener, or second cinematic background.
6. With reduced motion, commit immediately and use a <=120 ms opacity cover/reveal; operation and
   destination remain identical. Focus lands in the destination main region after reveal.
7. Remove `quant-edge-ripple` and the main `animate-fade-in-up` only after the shutter passes. Keep
   `vt-header`, `vt-dock`, and their chrome transition behavior.

## Guardrails

- Do not edit charts, workspace layouts, `spotlight-button.tsx`, or cinematic artwork.
- Do not weaken performance ceilings. A transient transition surface is not permission to change
  `MAX_ALWAYS_ON_CANVASES_OUTSIDE_3D` or `MAX_APP_SHELL_ANIMATION_LOOPS`.
- Navigation must still complete when animation initialization throws, the tab hides, Escape is
  pressed, the component unmounts, or reduced motion changes mid-transition.

## Verification

- Unit tests: phase ordering, commit exactly once, forward/backward direction, coalesced rapid
  navigation, same-route no-op, reduced motion, rejected commit, unmount cleanup, focus restoration.
- Automated: `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `git diff --check`.
- Runtime: `pnpm perf:smoke` with the app running; prove idle canvas/loop counts are unchanged before
  and after ten route changes.
- Manual: 1440x900 and 390x844; dock click, keyboard activation, rapid click, browser back/forward,
  hidden-tab resume, launcher-to-workspace and workspace-to-workspace; Chromium plus Tauri/WebKitGTK.

## Definition of done

The selected stripes behavior is unmistakable; Q chrome stays fixed; every navigation commits once;
no overlay can remain stuck; idle renderer/loop budgets are unchanged. Handoff includes source/hash
record, before/after captures, a short forward/backward recording, owner-count evidence, exact command
results, and any Tauri deferral. Stop at `REVIEW` for VISUAL A.

## Out of scope

Page redesign, route prefetch architecture, modal transitions, new background art, or any later
premium component.
