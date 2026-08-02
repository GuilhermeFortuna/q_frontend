# WO217 — Frontend: AI Builder Inference Strands

## Shared context (read first)

Run only after VISUAL B. Read `docs/design/premium-component-upgrades.md`,
`docs/design/visual-design-system.md`, and `docs/runtime-performance.md` before editing.

Selected source: React Bits [Strands](https://reactbits.dev/animations/strands). Use
`https://github.com/DavidHDev/react-bits` at immutable commit
`d26ed7a476148f1253cca3f5bc9f679fda53e1f5`. Verify the TS/CSS hashes recorded under P-003 before
copying or adapting source. No licensing gate is required.

The former SmoothUI Siri Orb selection is rejected. This order must not implement an orb, voice
presence, microphone state, or approximation of the earlier design.

Read `AiBuilderHero.tsx`, `AiStrategyPanel.tsx`, `AiComposer.tsx`, and
`useAiStrategySession.ts`. Every appearance change must come from real session state, never a
decorative timer or simulated streaming event.

## Goal

Replace the static four-point `QuantSpark` with one horizontal `InferenceSignal`: a restrained field
of luminous strands that weave, converge, separate, and change energy as the AI Builder moves through
real composing, inference, response, success, and failure states.

The signal must read as model computation inside a high-end quantitative tool—not a voice assistant,
audio waveform, generic animated background, or marketing ornament.

## Files

Create or modify only:

```text
package.json
pnpm-lock.yaml
src/components/backtests/setup/AiInferenceSignal.tsx
src/components/backtests/setup/AiInferenceSignal.css
src/components/backtests/setup/aiVisualState.ts
src/components/backtests/setup/__tests__/AiInferenceSignal.test.tsx
src/components/backtests/setup/AiBuilderHero.tsx
src/components/backtests/setup/AiComposer.tsx
src/components/backtests/setup/AiStrategyPanel.tsx
src/components/backtests/setup/__tests__/AiStrategyPanel.test.tsx
src/lib/strategies/useAiStrategySession.ts
src/lib/performance/budgets.ts
docs/design/premium-component-upgrades.md
docs/runtime-performance.md
```

Touch another AI Builder test only when it imports the removed `QuantSpark` path or asserts the old
hero geometry. Record the extra file in the handoff.

## Dependency and source boundary

Install exactly:

```bash
pnpm add --save-exact ogl@1.0.11
```

Start from the accepted `Strands.tsx` and `Strands.css` source, preserving its tapered multi-strand
shader, weaving motion, bloom, and responsive renderer. Copy no demo page, rainbow defaults, glass
ball mode, provider typography, or unrelated React Bits utility.

## State contract

Export:

```ts
export type AiVisualState = 'idle' | 'composing' | 'thinking' | 'streaming' | 'done' | 'error'
```

Derive it once with this precedence:

1. `error`: `serviceError` or the current interpret request failed; persists until edit, retry, or reset.
2. `streaming`: the current request is pending and the real API exposes incremental assistant output.
3. `thinking`: interpret mutation pending without incremental output.
4. `done`: the latest request succeeded; hold for 900 ms, then fall through to composing or idle.
5. `composing`: composer is focused and contains non-whitespace input.
6. `idle`: every other state.

If the current API has no streaming distinction, never emit `streaming`. Do not infer it from elapsed
time, transcript length, or a repeating timer. Rename the former `listening` concept to `composing`
throughout; no audio semantics remain.

`AiComposer` exposes `onFocusChange?: (focused: boolean) => void` so `AiStrategyPanel` owns the
derived visual state. Do not duplicate state precedence inside the renderer.

## Signal mapping

Preserve React Bits Strands' continuous woven-field signature with deterministic Q mappings:

| State       | Required behavior                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `idle`      | One or two thin, widely tapered silver/brass strands; slow and low-intensity                          |
| `composing` | Two strands gently draw toward the center; modest brass lift                                          |
| `thinking`  | Three tighter strands weave faster with compressed spread and stronger cream core                     |
| `streaming` | A directional energy crest travels toward the transcript/output side                                  |
| `done`      | One contained convergence/bloom, then a stable settling state for the 900 ms hold                     |
| `error`     | Strands contract and separate once; muted rose is introduced without flashing or looping alarm motion |

- Use only Q graphite, smoked silver, brass, warm cream, and the existing rose error token.
- No rainbow spectrum, hue cycling, glass ball, cursor reaction, audio reaction, particles, or text
  inside the canvas.
- State labels remain HTML. The canvas is `aria-hidden`, `pointer-events:none`, and never focusable.

## Composition

Mount exactly one `AiInferenceSignal` from `AiStrategyPanel`, outside the empty/active
`AnimatePresence` branches:

- Empty state: a 360–440 px by 72–96 px horizontal signal occupies the current `QuantSpark`/hero
  mark region without changing the heading, supporting copy, composer, or starter-chip order.
- Active conversation: the same mounted instance compacts to 160–220 px by 36–48 px beside the
  conversation status area. Use the existing Motion layout system to move its wrapper; do not mount
  a second canvas or recreate the OGL renderer.
- Mobile: preserve the horizontal signature at 240–300 px by 56–72 px. It must not overlap the
  composer, chips, draft header, or dock.

Delete `QuantSpark` only after the new signal, spacing, tests, and semantics pass.

## Renderer ownership and performance

P-003 creates one explicit feature visualization for `/strategy-builder`:

- Add a route-scoped performance budget of exactly one feature Canvas and one feature RAF on
  `/strategy-builder`; do not change the global app-shell ceilings.
- The renderer starts only after the AI Builder signal is in the document. It pauses when the
  document is hidden or the signal is outside the active route and disposes program, mesh, geometry,
  listeners/observers, Canvas, and RAF on unmount.
- Use one bounded `ResizeObserver` on the signal container. No document mouse listener, global
  ticker, root scroll listener, or second renderer.
- Cap device pixel ratio at `1.5` desktop and `1.25` mobile. Do not render zero-sized frames.
- Under reduced motion, render the correct state as one stable frame and stop the RAF; state colour,
  strand count, taper, and accessible label remain accurate.
- A WebGL initialization/context failure leaves the HTML state label and hero fully usable. It may
  show no visual signal; do not recreate the effect with generic CSS bars or an orb.

## Accessibility and lifecycle

- Render an adjacent or screen-reader-only status label using operational language such as
  `AI idle`, `Drafting prompt`, `Interpreting strategy`, `Presenting response`, `Strategy ready`, or
  `AI unavailable`.
- Announce only state changes that already warrant user feedback; do not create a chatty live region.
- The signal cannot steal focus or intercept composer input.
- The 900 ms done hold must clean up on retry, reset, error, route exit, and unmount.

## Verification

- Unit tests: state precedence, focus/composing, whitespace fallback, no fabricated streaming,
  done-hold cleanup, error persistence, deterministic state-to-prop mapping, one renderer instance,
  reduced-motion single frame, hidden-tab pause/resume, WebGL failure, resize, and unmount disposal.
- Existing AI Builder tests plus `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `pnpm list ogl --depth 0`, and `git diff --check`.
- Runtime: extend HUD evidence to prove `/strategy-builder` has exactly one feature Canvas/loop while
  visible, zero contribution after route exit, and no sustained FPS below 55 in Chromium.
- Manual captures: idle, composing, thinking, done, and error at 1440x900 and 390x844; streaming only
  if the real API supports it. Also test reduced motion, hidden tab, context failure, repeated
  requests, reset, route exit, and Tauri/WebKitGTK.

## Definition of done

The React Bits Strands signature is unmistakable and integrated as one Q-native inference signal.
Every visual change corresponds to real AI state, the composer remains untouched operationally, the
route-scoped renderer budget is proven, and no orb or voice metaphor remains. Handoff includes
source/hash proof, the state-to-uniform table, lifecycle owner counts, captures, exact command
results, and any honest Tauri deferral. Stop at `REVIEW` for VISUAL C.

## Out of scope

Voice input, audio capture, simulated streaming, AI API changes, transcript redesign, another
background effect, or use of the signal outside AI Builder.
