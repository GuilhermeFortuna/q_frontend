# WO207 — Frontend: AI Builder hero state + pill composer + collapse choreography

## Shared context (read first)

First of the **WO207–WO209 group** ("Neural-Expressive-inspired AI Builder"). Execution
sequence: `207 → 208` strictly serial (both edit `AiStrategyPanel`/`AiChatTranscript`) ·
**WO209 (backend prompt) runs in parallel** with either · no other ordering constraints.

Design intent, agreed with the user: merge the _structural_ ideas of Google's Gemini
"Neural Expressive" redesign (May 2026) with Quant's own design language — **not** its
colors. The three ideas this WO implements: (1) a **centered greeting as the hero** of the
empty state, (2) a **pill-shaped composer as the single focal object**, mid-screen while
empty, (3) a **collapse choreography** where, on first send, the hero folds away and the
pill docks to the bottom as the conversation takes over. Everything renders in the existing
warm-black + brass vocabulary: frosted glass, suede, machined brass, Inter Display, the
WO194 motion tokens.

One special dispensation: the WO119-era checkpoint **reserved the "aurora" ambient
treatment for a single future hero panel**. This hero is that panel — the only place in the
app allowed a slow ambient light animation, always gated by MotionToggle/reduced-motion.

Frontend repo: `q_frontend` — React/TS/Vite, `pnpm` (never npm), vitest + Testing Library.
Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/workspaces/strategy-builder/StrategyBuilderWorkspace.tsx` — post-WO202 full-height
  flex layout: draft header (name/description/NEW/SAVE), model row, transcript `flex-1`,
  composer + INTERPRET pinned bottom
- `src/components/backtests/setup/AiStrategyPanel.tsx` — `hideHeader` prop (line ~26; the
  workspace host passes it), model `LabeledField`, composer textarea (~line 216) with
  `submitInterpret`, brass Send button (~line 230), `hasConversation` (~line 99)
- `src/components/backtests/setup/AiChatTranscript.tsx` — transcript + empty-state teaser
  (~line 220) with the three starter chips (WO202)
- `src/lib/motion/presets.ts` + `useReducedMotion` — `fadeRise`/`overlayExit`; add the hero
  choreography here, not inline
- `src/styles/materials.css` — glass/suede recipes; aurora lands here as a new opt-in class
- `src/components/effects/PointerSpotlight.tsx` / `pointerSpotlightUtils.ts` — existing
  ambient-light plumbing patterns
- `public/quant.svg` — the emblem for the greeting mark
- `docs/design/visual-design-system.md` — accent ladder + "Definition of premium"; extend it

## Goal

Empty AI Builder = a hero: emblem, greeting in Inter Display with a brass→cream ombré
keyword, a slow aurora breathing behind it, and one large frosted pill composer centered
beneath — then one continuous motion on first send that docks the pill and hands the stage
to the conversation. **Workspace host only**; the Backtests-hosted panel keeps its compact
form untouched.

## Tasks

1. **`surface-aurora` (materials.css).** Opt-in class for the hero backdrop only: two or
   three large, very soft radial warm-light fields (brass/cream at low alpha over the
   warm-black) drifting on a slow keyframe cycle (≥ 20s, opacity/transform only, GPU-cheap).
   No texture, no hue outside the token family. Gated: static under
   `prefers-reduced-motion` / MotionToggle-off (`:root[data-reduced-motion='true']` pattern
   from `surface-suede`). Tunables as custom properties (`--aurora-strength`, `--aurora-
speed`). Document in the design doc that this class is **single-use by decree** (the
   reserved hero dispensation) — a guardrail comment in the CSS itself.
2. **Hero empty state** (new `src/components/backtests/setup/AiBuilderHero.tsx`, rendered
   by the workspace host when the transcript is empty): `quant.svg` emblem (~40px, subtle
   brass glow), greeting "What are we building today?" in `font-display` at ~`--text-2xl`+
   with the words "building" carrying a brass→cream gradient (`background-clip: text` —
   the tier-4 ombré jewelry; one keyword only), one quiet sub-line. Aurora behind it. The
   WO202 teaser sentence moves out of the transcript for this host (transcript renders
   nothing when empty in hero mode).
3. **Pill composer.** Extract the composer into `AiComposer.tsx` used by both modes:
   rounded-full frosted-glass pill (panel-level glass, defined outline), auto-growing
   textarea (1→~6 lines, pill relaxes its radius as it grows), **machined-brass circular
   send button inside the right edge** (replaces the standalone INTERPRET button in this
   host — it is the page's single tier-4 element), and the **model selection as a quiet
   suede chip inside the pill's left edge** (opens the WO201 grouped select — keep the
   native `<select>` as the popup mechanism via an invisible overlay or the existing
   element restyled; do not rebuild selection logic; `ai-strategy-model` testid preserved).
   The WO202 model `LabeledField` row disappears in this host. Enter sends, Shift+Enter
   newline, hint text on focus.
4. **Hero layout.** Empty mode: draft header stays at top (quiet), hero centered in the
   freed vertical space, pill beneath the greeting, the three starter chips beneath the
   pill (chips themselves are WO208's content scope — keep rendering the existing ones).
5. **Collapse choreography** (presets in `src/lib/motion/presets.ts`: `heroExit`,
   `composerDock`): on first send — greeting + emblem fade/rise out (`--motion-slow`,
   `--ease-in-out`), aurora fades to nothing, the pill animates from center to the docked
   bottom position (FLIP or `motion` layout animation — transform-only), transcript fades
   in behind it. Reverse (instant, no animation) when "New conversation" resets. Reduced
   motion: hard cut, identical end states. The docked pill _is_ the composer from then on —
   same component, docked variant styling (slightly smaller radius, full width within the
   column).
6. **Backtests host untouched.** `AiStrategyPanel` with `hideHeader=false` renders exactly
   as today (compact textarea + brass button); the hero/pill/choreography mount only in the
   workspace host. Guard with the existing prop — no new global state.

## Guardrails

> **Aurora is single-use.** It mounts only in the hero; it must never appear in any other
> surface (CSS comment + design-doc decree). It unmounts entirely after the collapse — no
> ambient animation during conversation.
> **Accent ladder intact**: ombré text = the one greeting keyword + nothing else; the send
> button is the only tier-4 element; model chip and starter chips are suede/tier-0.
> **Transform/opacity only** in all choreography (WO70–72 + WO194 rules); the collapse must
> hold 60fps — profile once with DevTools performance panel.
> **Zero behavior changes**: `submitInterpret`, session hook, save/apply/run flows, and all
> testids (`ai-strategy-message`, `ai-strategy-submit`, `ai-strategy-model`) survive — this
> WO re-stages the same controls.
> **Both hosts verified** (the WO202 lesson): run both suites, eyeball both routes.
> **No new dependencies** (`motion` covers the choreography).

## Tests

- `AiBuilderHero` test: renders greeting/emblem/aurora class in empty state; not rendered
  once transcript has entries; reduced-motion → aurora static class variant.
- Composer: Enter submits / Shift+Enter doesn't; auto-grow caps; model chip opens selection
  and `ai-strategy-model` still changes the session's provider+model (reuse the WO201 test
  patterns); send button disabled states mirror today's INTERPRET logic.
- Choreography: after first `submitInterpret`, hero unmounts and composer carries the
  docked variant (assert classes/presence, not animation frames); reset restores hero.
- Backtests host: `AiStrategyPanel` default render snapshot-equal to pre-WO207 (no hero,
  no pill).
- Full suites green.

## Docs

`docs/design/visual-design-system.md`: add the **Hero dispensation** section — aurora's
single-use rule, the ombré-keyword rule, and the pill composer as a workspace-host pattern.
Update `docs/dev/ai-builder-chat.md` hosting-modes paragraph.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the `surface-aurora` CSS as shipped, the choreography preset signatures, the
preserved testid list, confirmation the Backtests host is unchanged, and the 60fps
profiling note. Production trigger: none — the workspace is already routed.

## Out of scope

Transcript turn redesign + conversational copy/starter content (WO208); backend prompt
(WO209); voice input; streaming; per-turn model badges; Backtests-host layout changes;
using aurora anywhere else, ever.
