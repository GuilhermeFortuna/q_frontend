# WO192 — Frontend: collaborative chat UI for the AI Strategy Builder

## Shared context (read first)

Second of the WO191–WO192 pair; **runs after WO191** (it renders the `change_notes` field
WO191 adds). The goal: turn the AI Strategy Builder from a one-shot generator with a
re-prompt box into a visible back-and-forth collaboration over a shared draft. The session
hook already accumulates a `conversation` and sends it (plus `current_spec`) on every
interpret call — the machinery exists; the _experience_ doesn't. Today the panel is a single
textarea; the model's `questions` render as a dead bullet list; nothing shows the user that
context accumulates or what each exchange changed.

Frontend repo: `q_frontend` — React/TS/Vite, `pnpm` (never npm), tests with vitest +
Testing Library + MSW. Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/lib/strategies/useAiStrategySession.ts` — the session hook: `conversation` state
  (wire `ConversationMessage[]`; assistant turns recorded as `result.summary`),
  `submitInterpret` (sends full conversation + `current_spec` + optional
  `validation_errors`), `revisions` + `revisionDiff` (via `createRevisionSnapshot` /
  `compareRevisionSections` — note it only diffs the _last two_ revisions), `resetDraft`,
  `updateDraft` (manual spec edits), `hydrateFromMetadata`
- `src/lib/strategies/aiStrategyMetadata.ts` — `AiRevisionSnapshot`,
  `compareRevisionSections` (section-level diff you will generalize)
- `src/components/backtests/setup/AiStrategyPanel.tsx` — current layout: model select,
  textarea (`ai-strategy-message`), submit / ask-fix / apply / reset buttons, action row,
  results block (revision diff, assumptions, unsupported, questions, validation errors),
  `StrategySpecPreview`
- `src/types/strategyBuilder.ts` — `ConversationMessage`, `AiStrategyResponse` (add
  `change_notes: string[]` mirroring WO191)
- `src/components/ui/` — design-system primitives (Panel, SectionHeader, Callout, chip
  styles); build the transcript from these, matching the panel's existing carbon/brass
  styling — no new one-off visual language

## Goal

A chat transcript inside the AI panel: user turns and assistant turns (summary + what
changed + answerable questions), a persistent composer, and a per-turn spec diff — while
every existing workflow control (apply/save/run/optimize/export, unsupported
acknowledgement, validation repair) keeps working unchanged.

## Tasks

1. Display model vs wire model. Add a local `TranscriptEntry` type in the session hook:
   `user` entries (the message), `assistant` entries (`summary`, `change_notes`,
   `questions`, `confidence`, a reference to its revision index), and `notice` entries
   (service errors, manual-edit markers, reset boundary). The **wire** `conversation` sent
   to the backend keeps today's exact shape (`role` + `content`, assistant content =
   summary) — richer content is display-only state, never sent.
2. Transcript UI (new `src/components/backtests/setup/AiChatTranscript.tsx`, rendered
   above the composer in `AiStrategyPanel`):
   - user/assistant turns visually distinct; assistant turns show summary, then
     `change_notes` as a compact "Changed this turn" list, then questions;
   - pending state: while `interpretMutation.isPending`, show the just-sent user turn plus
     an assistant placeholder (spinner);
   - service errors become inline `notice` turns (keep the existing
     `ai-strategy-service-error` Callout as-is for the current error too);
   - auto-scroll to the newest turn; container is height-bounded with its own scroll —
     the panel must not grow unboundedly;
   - empty state: current teaser copy (describe a strategy to start).
3. Answerable questions: each question in an assistant turn is a clickable chip that
   prefills the composer with the question quoted (e.g. `> Which timeframe? — `) and
   focuses it. Keep the static questions list in the results block removed or collapsed —
   the transcript is now their home (don't render them twice).
4. Per-turn spec diff: generalize the revision diff so each assistant turn can show _its_
   changes — add `compareRevisionSections(revisions[i-1], revisions[i])` per turn (helper
   already handles null previous). Render changed sections as small chips on the turn
   ("exit", "risk"); clicking expands the existing diff detail inline. The current
   "Revision changes" block for the latest turn can then be dropped from the results
   section (single source of truth).
5. Manual edits surface in the chat: when `updateDraft` changes the spec between turns,
   append a `notice` entry ("You edited the draft manually") so the transcript honestly
   reflects how the draft evolved — `current_spec` already carries the edit to the backend;
   this is display-only.
6. Composer: reuse the existing textarea + submit (keep `ai-strategy-message` /
   `ai-strategy-submit` testids and the Enter-to-send behavior); relabel submit from
   "generate"-style copy to "Send" once a conversation exists. "Reset" becomes "New
   conversation" and clears the transcript (via `resetDraft`).
7. Types: add `change_notes: string[]` to `AiStrategyResponse` in
   `src/types/strategyBuilder.ts` (default `[]` when absent so the UI tolerates a pre-WO191
   backend).
8. `hydrateFromMetadata` (opening a saved AI strategy): seed the transcript with the
   original prompt as a user turn and a synthetic assistant turn from the metadata summary,
   so continuing the conversation on a saved strategy reads naturally.

## Guardrails

> Wire compatibility: the interpret request payload must be byte-identical in shape to
> today (same fields; assistant conversation content = summary). Backend session storage is
> explicitly out — the client owns the transcript, and a page reload losing the transcript
> is accepted for this WO.
> No `@/mocks` imports outside `__tests__`/`*.test.*`; no mock values in component initial
> state — transcript initial state is `[]`, real turns come from user actions and query
> responses (per the house CI grep).
> All existing panel workflows (apply-to-setup, save, run, optimize, duplicate, export,
> unsupported acknowledgement, ask-AI-to-fix) keep their testids and behavior — this WO
> adds a transcript; it does not redesign the workflow gating.
> Performance: the transcript renders incrementally (keyed list, memoized turns) — no
> re-render of all turns per keystroke in the composer (the WO70–72 lessons apply).

## Tests

There is currently **zero** test coverage for `AiStrategyPanel` / `useAiStrategySession` —
this WO introduces it. New `src/components/backtests/setup/__tests__/AiChatTranscript.test.tsx`
and a hook test (`src/lib/strategies/__tests__/useAiStrategySession.test.ts`) with an MSW
handler for `/api/v1/strategy-builder/interpret` (add it to `src/mocks/handlers.ts`; it does
not exist yet):

- two-turn exchange → transcript shows user/assistant/user/assistant in order; wire payload
  of the second call contains the full conversation with summary-only assistant content;
- `change_notes` rendered on the assistant turn; absent field → no "Changed this turn"
  block, no crash;
- question chip click → composer prefilled and focused;
- pending placeholder appears during an in-flight call and is replaced by the response;
- interpret failure → `notice` turn + existing error Callout; conversation state does not
  gain a phantom assistant turn;
- manual `updateDraft` between turns → manual-edit notice present;
- "New conversation" clears transcript, draft, and revisions;
- per-turn diff: revision i chips reflect `compareRevisionSections(i-1, i)` (unit-test the
  generalized helper in `aiStrategyMetadata` too).

## Docs

Short section in the frontend docs where the AI builder flow is described (or a new
`docs/dev/ai-builder-chat.md` if none exists): transcript/display-model vs wire-model
distinction, and the decision that the client owns session state.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the `TranscriptEntry` type as shipped, confirmation that the interpret wire
payload is unchanged (paste one recorded request body from a test), and the list of
preserved testids. Production trigger: none — the panel is already routed; the transcript
appears for every user on deploy with empty initial state.

## Out of scope

Backend changes (WO191 owns the contract); streaming responses; persisting transcripts
across reloads or to the database; multi-session management; voice/attachments; changing
apply/save/run workflow semantics.
