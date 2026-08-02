# WO217 — Frontend: AI Builder Stateful Orb

## Shared context (read first)

Run only after VISUAL B. Selected source: SmoothUI [Siri Orb](https://smoothui.dev/docs/components/siri-orb).
Inspect and hash the obtainable source, then append provenance to
`docs/design/premium-component-upgrades.md`. Read `AiBuilderHero.tsx`, `AiStrategyPanel.tsx`, and
`useAiStrategySession.ts`; derive appearance from real session state, never from a decorative timer.

## Goal

Replace the static four-point `QuantSpark` in the AI Builder hero with a portfolio-quality luminous
orb that makes the AI's current activity legible. It must remain unmistakably Q: brass/cream light in
graphite glass, with rose reserved for failure.

## Files

```text
src/components/strategy-builder/AiStateOrb.tsx
src/components/strategy-builder/aiState.ts
src/components/strategy-builder/__tests__/AiStateOrb.test.tsx
src/components/backtests/setup/AiBuilderHero.tsx
src/components/backtests/setup/AiStrategyPanel.tsx
src/lib/strategies/useAiStrategySession.ts
src/components/backtests/setup/__tests__/AiStrategyPanel.test.tsx
docs/design/premium-component-upgrades.md
```

## State contract

Export `AiVisualState = idle|listening|thinking|streaming|done|error` and derive it once:

- `idle`: no conversation and no mutation;
- `listening`: composer has non-empty input and is focused, before submit;
- `thinking`: interpret mutation pending with no assistant output for that request;
- `streaming`: pending while new assistant/transcript content is being presented, if the current API
  exposes that distinction; otherwise use `thinking` and do not fabricate streaming;
- `done`: latest request succeeded, held 900 ms then returns to idle/listening;
- `error`: `serviceError` or failed interpret request, held until edit/retry/reset.

## Implementation contract

1. Preserve the selected layered-gradient, organic morphing signature, but use Q tokens: cream core,
   brass/gold active lobes, graphite shadow, muted silver idle, rose error. No rainbow palette.
2. Size 56 px in the empty hero; it may shrink to 28–32 px near the active conversation header only
   if the same shared-layout orb remains present. Do not add a second orb.
3. Motion intensity/frequency maps deterministically to state: idle nearly still; listening gently
   reactive; thinking tighter/faster; streaming directional; done one contained bloom; error one
   restrained contraction. No audio/microphone capture is introduced.
4. Provide an adjacent or screen-reader-only state label. The orb is not a button. It cannot steal
   focus from the composer and is `pointer-events:none`.
5. Reduced motion renders the correct color/shape state with no continuous morphing. Hidden tabs and
   off-route unmounts stop every animation. Prefer Motion/CSS; no Canvas, RAF, timer loop, or filter
   chain that violates the shell budgets.
6. Delete `QuantSpark` only after all hero tests and semantics are migrated. Keep existing hero copy,
   composer layout ID, starter chips, and validation flow.

## Verification

- Unit tests for state precedence, valid fallback without streaming support, done hold cleanup,
  error persistence, focus/listening, reduced motion, unmount timer cleanup, and accessible label.
- Existing AI Builder tests plus `pnpm test:run`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `git diff --check`.
- Manual capture at idle/listening/thinking/done/error, desktop/mobile, reduced motion, hidden tab, and
  repeated request. Use CPU throttling to inspect pending state and confirm no layout shift.

## Definition of done

The orb visibly carries the selected source's quality while every visual state follows real AI
state and leaves the composer interaction untouched. Record source/hash, state map, captures, and
commands; stop at `REVIEW` for VISUAL C.

## Out of scope

Voice input, simulated streaming, AI API changes, composer redesign, or applying the orb elsewhere.
