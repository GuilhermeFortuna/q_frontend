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

`AiStrategyPanel` has two hosting modes. Its default renders the compact panel heading used
inside Backtests. The dedicated `/strategy-builder` workspace passes `hideHeader` and
`fillHeight`, supplies the integrated `draftHeader`, and lets the transcript consume the
remaining panel height without duplicating the page identity.
