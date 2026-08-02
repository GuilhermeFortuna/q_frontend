# WO215 — Frontend: Workspace Grid-Reconfiguration Transition

## Shared context (read first)

First order in the owner-approved premium interaction batch. Read
`docs/design/premium-component-upgrades.md`, `docs/design/visual-design-system.md`, and
`docs/runtime-performance.md`. Repo is `q_frontend`; use `pnpm`, never npm. Return this order to
`REVIEW`; VISUAL A is an owner gate and only its acceptance unlocks WO216.

Selected source: Codrops [Grid Layout Transition](https://tympanus.net/Tutorials/GridLayoutTransitions/)
and its [GSAP Flip article](https://tympanus.net/codrops/2026/01/20/animating-responsive-grid-layout-transitions-with-gsap-flip/).
Use `https://github.com/Ibaliqbal/grid-layout-transition` at immutable commit
`c0f44dba1bf8f23487580333a1a6a64f8422f8ec`. Verify the two hashes recorded under P-001 before
implementation. No licensing gate is required.

The former SmoothUI shader/shutter selection is rejected. The branch contains a partial
`WorkspaceStripeShutter` implementation and related shell edits. Remove or replace only that
rejected work; preserve every unrelated dirty-worktree change.

## Current seams

- `src/app/router.tsx` enables TanStack Router view transitions and defines workspace order.
- `src/components/layout/AppShell.tsx` owns the persistent header, main region, and dock boundary.
- `src/components/dock/AppDock.tsx` owns workspace navigation and the active identity.
- Workspace roots already use Q material surfaces but do not expose transition identities.
- `tests/unit/layout/viewTransitions.test.ts` protects header/dock continuity.
- `src/lib/performance/budgets.ts` forbids another always-on canvas or shell RAF.

## Goal

Replace the rejected full-screen shutter with a tool-native spatial reconfiguration. On dock
navigation, two to four real material surfaces from the outgoing workspace remain visibly
continuous while their bounds, proportions, and ordering transform toward the destination grid.
Unmatched surfaces leave or enter around that reflow. A temporary copy of the selected dock identity
travels toward the destination workspace anchor while the actual header and dock remain fixed.

The result must feel like one quantitative instrument changing operating configuration—not a page
being covered, wiped, or reloaded.

## Files

Create, modify, or delete only:

```text
package.json
pnpm-lock.yaml
src/components/transitions/WorkspaceGridTransition.tsx                  # create
src/components/transitions/workspaceTransitionStore.ts                  # replace rejected phases
src/components/transitions/__tests__/WorkspaceGridTransition.test.tsx   # create
src/components/transitions/WorkspaceStripeShutter.tsx                   # delete
src/components/transitions/__tests__/WorkspaceStripeShutter.test.tsx    # delete
src/components/layout/AppShell.tsx
src/components/dock/AppDock.tsx
src/app/router.tsx
src/styles/globals.css
src/workspaces/launcher/LauncherWorkspace.tsx
src/workspaces/market-data/MarketDataWorkspace.tsx
src/workspaces/storage/StorageWorkspace.tsx
src/workspaces/backtests/BacktestsWorkspace.tsx
src/workspaces/strategy-builder/StrategyBuilderWorkspace.tsx
src/workspaces/discover/DiscoverWorkspace.tsx
src/workspaces/research/ResearchWorkspace.tsx
src/workspaces/execution/ExecutionWorkspace.tsx
src/workspaces/system/SystemWorkspace.tsx
tests/unit/layout/viewTransitions.test.ts
docs/design/premium-component-upgrades.md
docs/runtime-performance.md
```

The workspace-file edits are limited to transition attributes or inert wrappers. Do not restage a
workspace, change its copy, or modify its data behavior. `SystemWorkspace.tsx` is already dirty;
preserve those changes exactly.

## Dependency

Install exactly:

```bash
pnpm add --save-exact gsap@3.15.0
```

Register `Flip` once in the transition module. Do not copy the source repository's vendored
`js/gsap.js` or `js/Flip.js`, and do not add another animation library.

## Surface contract

Each dock workspace exposes:

```text
data-workspace-transition-root="<workspace-id>"
data-workspace-transition-anchor="<workspace-id>"
data-workspace-transition-surface="primary|secondary|tertiary|utility"
```

- Mark exactly one root and one title/identity anchor per workspace.
- Mark two to four stable, lightweight material surfaces per workspace.
- Never mark a Canvas, chart renderer, native video, virtualized table body, form control, or
  continuously animated subtree as a transition surface.
- Surface roles need not contain the same content. They are spatial correspondences between Q
  material zones, not claims that two workspaces share data.

## Transition owner and sequence

`WorkspaceGridTransition` mounts once under `AppShell` and exposes:

```ts
type WorkspaceTransitionPhase =
  | 'idle'
  | 'capturing'
  | 'committing'
  | 'reconfiguring'
  | 'settling'

type WorkspaceTransitionDirection = 'forward' | 'backward'

runWorkspaceTransition(options: {
  from: string
  to: string
  direction: WorkspaceTransitionDirection
  destinationDockElement: HTMLElement
  commit: () => void | Promise<void>
}): Promise<void>
```

Sequence:

1. Capture outgoing surface and dock-identity bounds plus computed Q material styles.
2. Create inert, `aria-hidden`, pointer-free visual clones in one AppShell-owned transition layer.
   Remove IDs and focusability; do not clone Canvas/video/virtualized content.
3. Commit navigation exactly once after capture—there is no occlusion midpoint.
4. Wait only for the destination root/anchor/surfaces to exist and layout to settle. A bounded
   `ResizeObserver` or two-frame measurement is allowed; no persistent observer or RAF.
5. Use GSAP Flip to move matched surface clones to destination bounds. Unmatched outgoing surfaces
   recede by 8–12 px and fade; unmatched incoming surfaces enter after 45% progress.
6. Move the dock-identity clone toward the destination anchor, then crossfade it into the real
   anchor while the active dock item becomes visible in its fixed position.
7. Remove every clone and inline style, restore interaction, focus `#workspace-main`, and return to
   `idle`.

Use `power3.inOut` or the source's equivalent restrained easing. Total normal duration is
360–460 ms. Forward/backward navigation mirrors only the shallow directional offset; surfaces must
travel to measured destinations rather than fly wholesale from screen edges.

## Coordination and recovery

- Route all AppDock workspace navigation through the owner. Same-route actions remain no-ops.
- While `capturing` or `committing`, coalesce rapid requests to the latest destination. After commit,
  queue at most one latest request; never run overlapping Flip timelines.
- Browser history, redirects, and external programmatic navigation must cancel visual clones and
  reveal the actual destination rather than strand an overlay.
- Escape, hidden tab, initialization failure, rejected commit, route error, breakpoint resize, and
  unmount must finish or cancel safely and leave navigation usable.
- Reduced motion commits immediately and uses one main-region opacity transition no longer than
  120 ms. It preserves destination, focus, and active-dock state without spatial travel.

## Forbidden outcomes

- No SmoothUI code or attribution remains in the active P-001 contract.
- No stripe, shutter, curtain, fullscreen cover, shader reveal, WebGL surface, or route screenshot.
- No new Canvas, persistent animation loop, root listener, smooth-scroll owner, or shell renderer.
- Do not animate charts, dense table rows, text glyphs, or every child independently.
- Do not replace Q's material, typography, dock, or route composition with the Codrops demo style.

## Verification

- Unit tests: phase order, commit exactly once, surface matching, unmatched surfaces, dock-identity
  handoff, both directions, rapid coalescing, same-route no-op, reduced motion, rejected commit,
  missing destination, Escape/hidden-tab/unmount cleanup, and focus restoration.
- Shell assertions: no `WorkspaceStripeShutter`, shader source, shutter CSS, main remount fade, or
  `app-main` view-transition name; persistent header/dock continuity remains.
- Automated: `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `pnpm perf:smoke`, `pnpm list gsap --depth 0`, and `git diff --check`.
- Runtime: prove idle canvas and loop counts remain unchanged before and after ten forward/backward
  route changes. Record max long task and transition duration.
- Manual: Launcher, Market, Storage, Backtests, AI Builder, Discover, Research, Execution, and
  System at 1440x900 and 390x844; mouse, keyboard, rapid selection, browser history, hidden-tab
  recovery, and reduced motion in Chromium plus Tauri/WebKitGTK.

## Definition of done

The Codrops Flip signature is unmistakable: real Q surfaces preserve spatial continuity and settle
into measured destination geometry. The shell never disappears, the interaction stays operational,
and there is no remnant of the rejected shutter. Handoff includes source/hash proof, the surface map,
forward/backward recordings, owner-count and long-task evidence, exact command results, and any
honest Tauri deferral. Stop at `REVIEW` for VISUAL A.

## Out of scope

Workspace redesign, chart animation, route-prefetch architecture, modal transitions, new background
art, or any later premium component.
