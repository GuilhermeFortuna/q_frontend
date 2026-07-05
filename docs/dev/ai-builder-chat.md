# AI Strategy Builder chat

The AI Strategy Builder panel keeps two parallel representations of a session:

## Wire model (`conversation`)

What the client sends on every `POST /api/v1/strategy-builder/interpret` call:

- `message` — the current user turn
- `conversation` — prior turns as `{ role, content }` pairs
- Assistant turns on the wire use `content = summary` only (compact, model-facing)
- `current_spec`, `validation_errors`, and other request fields are unchanged from WO93
- `provider` and `model` are separate fields. The selected option's `provider::model`
  composite is DOM-only plumbing and is never persisted or sent over the wire.

The backend is stateless. The client owns the transcript and resends the full conversation on each call.

## Display model (`transcript`)

Rich UI state in `useAiStrategySession` (`TranscriptEntry[]`):

- **user** — the message text
- **assistant** — `summary`, `change_notes`, `questions`, `confidence`, and a `revisionIndex` for per-turn spec diffs
- **notice** — service errors, manual-edit markers, and other non-model events

Display-only fields are never sent to the API.

## Session lifecycle

- Transcript starts empty on panel mount; a page reload clears it (accepted for WO192).
- `hydrateFromMetadata` seeds user + assistant turns when opening a saved AI strategy.
- **New conversation** (`resetDraft`) clears transcript, wire conversation, draft, and revisions.
- Manual spec edits append a notice turn; the edited spec is still sent as `current_spec` on the next interpret call.

## UI

`AiChatTranscript` renders above the composer in `AiStrategyPanel`. Question chips prefill the composer; per-turn revision chips use `compareRevisionSections(revisions[i - 1], revisions[i])`.

The model picker groups models by the provider summaries returned from `/models`. The last
`{ provider, model }` selection is persisted in the Backtests session. Responses from a
pre-WO200 backend are normalized into one implicit provider group and omit `provider` from
interpret requests for compatibility.

`AiStrategyPanel` has two hosting modes:

1. **Compact Backtests host** (`hideHeader=false`): Renders the compact panel heading, a compact model dropdown row, and standard compact input layout.
2. **Workspace host** (`hideHeader=true`): Renders the premium AI Builder layout. If the transcript is empty, it mounts the `AiBuilderHero` (with a breathing `surface-aurora` background, logo, display greeting, and starter chips) and centers the `AiComposer` in a rounded frosted-glass pill variant. Upon the first submit, a collapse choreography unmounts/fades the hero, fades out the aurora, and docks the composer pill to the bottom, transitioning into the active transcript layout. Resetting the draft instantly returns the layout to the empty state without animations. Reduced motion preferences disable the keyframe animations of the aurora background and force layout updates to snap instantly.

## Editorial Turn Anatomy

Assistant turns are styled as well-edited briefs with a clear structural hierarchy:

- **Headline & Body** — The first sentence of `entry.summary` is rendered as an isolated, larger, bold headline. Subsequent sentences are rendered underneath in a smaller, quieter body style.
- **Question Cards** — Prominent suede cards with a brass left edge (tier-3 accent) rendered directly beneath the summary block. Cards invite direct interaction, clicking a card pre-fills the composer with a quoted prefill and focuses the input. Max 3 questions are visible, additional questions are collapsible.
- **Collapsible Details** — A toggleable "Details" section containing change notes and revision chips moves below the questions. It is expanded by default on the first assistant turn (revision index 0) and collapsed by default from the second turn on.
- **Pending Shimmer** — While waiting for the AI response (`isPending` is true), an animated gradient shimmer line is displayed where the headline will land. If reduced motion is active, the animaton is replaced by a set of static dots.

## Three-Level Starter Chips

To guide user expectations, starter chips are provided at three completeness levels:

1. **Rough Idea (Vague)** — "I have a rough idea about momentum" (pre-fills: _"I want something that rides momentum but I'm not sure about entries or exits yet."_)
2. **Half-formed (Partial)** — "Buy pullbacks in an uptrend" (pre-fills: _"Buy pullbacks in an uptrend — you pick sensible indicators; I want a tight stop."_)
3. **Full Spec (Complete)** — "Full spec: EMA crossover" (pre-fills: _"Create a trend strategy using EMA 20 and EMA 50 with a 3% stop."_)
