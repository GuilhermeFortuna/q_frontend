# Premium Component Upgrade Batch

Owner-approved component selections for the Q frontend following the live review at
`http://localhost:1420/` on 2026-08-02. This document fixes the visual intent and execution order;
WO215-WO221 contain the implementation contracts.

## Design contract

- Adapt signature behavior from public, obtainable component source. Do not substitute a generic
  animation or recreate the provider demo from memory.
- Q retains its warm-black, smoked-silver, brass, elevation, typography, and chart systems. Provider
  colors, fonts, rounded-card styling, page composition, and brand language do not transfer.
- One component is implemented and visually accepted before the next begins. A green test suite is
  necessary but does not replace the owner checkpoint.
- Existing charts, the topographic/cinematic environment, dock geometry, and spotlight-button work
  are protected. This batch adds directed moments around them; it does not redesign them.
- Use the existing `motion`, Three/R3F, Radix, and performance infrastructure. No new runtime
  dependency is approved by default. P-001 explicitly approves `gsap@3.15.0`; P-003 explicitly
  approves `ogl@1.0.11`. No other dependency may be installed without another owner decision.
- Preserve Q's current reduced-motion preference contract and keyboard/focus semantics.
- Each implementation records its canonical URL, capture date or immutable revision, exact copied
  source files, and source hashes. There is no licensing approval gate.

## Locked selections

| Decision | Product role                      | Selected source                                                                                        | Required Q adaptation                                                                                                   | Work Order |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------- |
| P-001    | Workspace-to-workspace transition | [Codrops Grid Layout Transition](https://tympanus.net/Tutorials/GridLayoutTransitions/) with GSAP Flip | The persistent shell stays fixed while real workspace surfaces and the active dock identity spatially reconfigure       | WO215      |
| P-002    | Destructive execution control     | [SmoothUI Power Off Slide](https://smoothui.dev/docs/components/power-off-slide)                       | Deliberate slide-to-confirm for engaging the global kill switch; backend acknowledgement remains authoritative          | WO216      |
| P-003    | AI Builder state presence         | [React Bits Strands](https://reactbits.dev/animations/strands)                                         | A horizontal brass/cream inference signal driven by real idle/composing/thinking/streaming/done/error state             | WO217      |
| P-004    | Persistent background-job status  | [SmoothUI Dynamic Island](https://smoothui.dev/docs/components/dynamic-island)                         | One morphing dock-attached job instrument, using the existing job queries and dock material                             | WO218      |
| P-005    | Operational failure state         | [React Bits Faulty Terminal](https://reactbits.dev/backgrounds/faulty-terminal)                        | Restrained terminal interference only for genuine unavailable/offline/failure surfaces; never loading                   | WO219      |
| P-006    | Entity-to-detail continuity       | [Motion Primitives Morphing Dialog](https://motion-primitives.com/docs/morphing-dialog)                | Leaderboard row morphs into a large candidate inspector while DataTable virtualization and Radix semantics remain sound | WO220      |
| P-007    | Live quantitative value changes   | [SmoothUI Number Flow](https://smoothui.dev/docs/components/number-flow)                               | Direction-aware, tabular value interpolation in shared `StatTile` and a small representative telemetry set              | WO221      |

## P-001 source and adaptation record

- Owner revision: 2026-08-02. The SmoothUI shader/shutter direction is rejected and must not ship.
- Demo: https://tympanus.net/Tutorials/GridLayoutTransitions/
- Technical article: https://tympanus.net/codrops/2026/01/20/animating-responsive-grid-layout-transitions-with-gsap-flip/
- Source: https://github.com/Ibaliqbal/grid-layout-transition at commit
  `c0f44dba1bf8f23487580333a1a6a64f8422f8ec`.
- Inspected source files:
  - `js/script.js` — SHA-256 `fb5c2ac16c64ce3ea35b089b3d43751300dfc6df58b46cff24938ecc8d7ba3db`
  - `css/style.css` — SHA-256 `62cc6309f0ee36c220fa2f12388094313bb773070aa1ce7f298e8977021177de`
- Signature behavior: real surfaces preserve spatial continuity while their grid positions, sizes,
  and ordering change through GSAP Flip; unmatched surfaces leave or enter around that reflow.
- Q adaptation: the header and dock never disappear. Navigation reconfigures the main workspace's
  actual material surfaces and carries the active dock identity toward the destination anchor. It
  uses no shutter, stripe mask, full-screen cover, shader reveal, persistent canvas, or shell RAF.
- Approved dependency: install exactly `gsap@3.15.0`; use `Flip` from the same package.

## P-003 source and adaptation record

- Owner revision: 2026-08-02. The Siri/voice-orb direction is rejected and must not ship.
- Demo: https://reactbits.dev/animations/strands
- Source: https://github.com/DavidHDev/react-bits at commit
  `d26ed7a476148f1253cca3f5bc9f679fda53e1f5`.
- Inspected source files:
  - `src/ts-default/Animations/Strands/Strands.tsx` — SHA-256
    `7e1e0ccecf2ae92d705313d7e87b05da136489d1c58694e983e0997f4e6fb126`
  - `src/ts-default/Animations/Strands/Strands.css` — SHA-256
    `c97591a8a4b73fc190274eb68305581fdddae87bd15817499991b0101925861c`
- Signature behavior: several tapered luminous strands continuously weave, separate, converge, and
  change energy as one coherent horizontal field.
- Q adaptation: the source becomes an `InferenceSignal`, not a background and not an orb. Its
  count, amplitude, speed, spread, intensity, glow, and palette are driven by real AI Builder state.
  No microphone, audio-reactivity, listening metaphor, rainbow palette, or glass ball is permitted.
- Approved dependency: install exactly `ogl@1.0.11`. The canvas and RAF are feature-route owned,
  instrumented, paused while hidden, and disposed immediately off `/strategy-builder`.

## Sequential acceptance gates

```text
WO215 -> VISUAL A -> WO216 -> VISUAL B -> WO217 -> VISUAL C -> WO218
      -> VISUAL D -> WO219 -> VISUAL E -> WO220 -> VISUAL F -> WO221 -> VISUAL G
```

At each gate, review the live interaction at 1440x900 and 390x844, keyboard operation, reduced-motion
behavior, and before/after performance evidence. A rejected gate returns to its owning WO; later
orders do not compensate for it.

Current dispatch state:

- WO215 — `REVIEW` (implementation complete; awaiting VISUAL A)
- WO216–WO221 — `BLOCKED` by the immediately preceding visual acceptance gate

## Explicit non-selections

- Do not ship the superseded SmoothUI shader/shutter or Siri Orb. P-001 is spatial grid
  reconfiguration; P-003 is a horizontal inference signal with no voice metaphor.
- Do not replace Q's chart renderers with a provider chart component.
- Do not replace the cinematic/topographic environment with a generic shader background.
- Do not restyle the dock as an Apple Dynamic Island; only the morphing status behavior is selected.
- Do not use Faulty Terminal as wallpaper, a loading state, or decoration on healthy data.
- Do not apply Morphing Dialog to confirmations. Destructive confirmations retain their dedicated
  semantics; P-006 is for reversible inspection.
- Do not animate every number. IDs, timestamps, table cells, editable inputs, and static prose remain
  instant and stable.
