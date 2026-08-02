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
  dependency is approved by default. If an accepted source cannot retain its signature behavior
  without another dependency, stop and report that fact instead of silently installing it.
- Preserve Q's current reduced-motion preference contract and keyboard/focus semantics.
- Each implementation records its canonical URL, capture date or immutable revision, exact copied
  source files, and source hashes. There is no licensing approval gate.

## Locked selections

| Decision | Product role                      | Selected source                                                                                                       | Required Q adaptation                                                                                                   | Work Order |
| -------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------- |
| P-001    | Workspace-to-workspace transition | [SmoothUI Shader Reveal Transition](https://smoothui.dev/docs/components/shader-reveal-transition), `stripes` variant | A brief brass/black shutter integrated with AppShell navigation; never a second persistent background                   | WO215      |
| P-002    | Destructive execution control     | [SmoothUI Power Off Slide](https://smoothui.dev/docs/components/power-off-slide)                                      | Deliberate slide-to-confirm for engaging the global kill switch; backend acknowledgement remains authoritative          | WO216      |
| P-003    | AI Builder state presence         | [SmoothUI Siri Orb](https://smoothui.dev/docs/components/siri-orb)                                                    | Brass/cream/graphite/rose orb driven by real idle/listening/thinking/streaming/done/error state                         | WO217      |
| P-004    | Persistent background-job status  | [SmoothUI Dynamic Island](https://smoothui.dev/docs/components/dynamic-island)                                        | One morphing dock-attached job instrument, using the existing job queries and dock material                             | WO218      |
| P-005    | Operational failure state         | [React Bits Faulty Terminal](https://reactbits.dev/backgrounds/faulty-terminal)                                       | Restrained terminal interference only for genuine unavailable/offline/failure surfaces; never loading                   | WO219      |
| P-006    | Entity-to-detail continuity       | [Motion Primitives Morphing Dialog](https://motion-primitives.com/docs/morphing-dialog)                               | Leaderboard row morphs into a large candidate inspector while DataTable virtualization and Radix semantics remain sound | WO220      |
| P-007    | Live quantitative value changes   | [SmoothUI Number Flow](https://smoothui.dev/docs/components/number-flow)                                              | Direction-aware, tabular value interpolation in shared `StatTile` and a small representative telemetry set              | WO221      |

## Sequential acceptance gates

```text
WO215 -> VISUAL A -> WO216 -> VISUAL B -> WO217 -> VISUAL C -> WO218
      -> VISUAL D -> WO219 -> VISUAL E -> WO220 -> VISUAL F -> WO221 -> VISUAL G
```

At each gate, review the live interaction at 1440x900 and 390x844, keyboard operation, reduced-motion
behavior, and before/after performance evidence. A rejected gate returns to its owning WO; later
orders do not compensate for it.

Current dispatch state:

- WO215 — `READY`
- WO216–WO221 — `BLOCKED` by the immediately preceding visual acceptance gate

## Explicit non-selections

- Do not replace Q's chart renderers with a provider chart component.
- Do not replace the cinematic/topographic environment with a generic shader background.
- Do not restyle the dock as an Apple Dynamic Island; only the morphing status behavior is selected.
- Do not use Faulty Terminal as wallpaper, a loading state, or decoration on healthy data.
- Do not apply Morphing Dialog to confirmations. Destructive confirmations retain their dedicated
  semantics; P-006 is for reversible inspection.
- Do not animate every number. IDs, timestamps, table cells, editable inputs, and static prose remain
  instant and stable.
