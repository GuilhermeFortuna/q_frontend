# WO191 — Backend: harden AI Strategy Builder multi-turn conversation (budget, dedupe, collaborator prompt, change notes)

## Shared context (read first)

First of the WO191–WO192 "collaborative AI builder chat" pair. The interpret wire contract
already supports multi-turn work (WO93): `StrategyInterpretRequest` carries `conversation`,
`current_spec`, and `validation_errors`; the frontend session hook accumulates the
conversation and sends it on every call. WO192 builds the chat UI on top. This WO fixes the
backend weaknesses that will bite once conversations get long: unbounded history in the
prompt, the current user message duplicated into the prompt twice, a system prompt written
for one-shot generation rather than collaborative refinement, and no machine-readable
"what changed this turn" for the UI to display.

Runs after WO187 in numeric order but has no hard dependency on it — the token budgeting
matters _most_ for the local Ollama models, and the collaborator behavior benefits every
provider.

Backend repo: `q_backend`, Python managed with `uv` (`uv run pytest` — never pip/poetry).
Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/q_backend/strategy_builder/interpret_models.py` — `ConversationMessage`,
  `StrategyInterpretRequest`, `AiStrategyResponse`, `ParsedAiInterpreterPayload`
- `src/q_backend/strategy_builder/interpret_prompt.py` — `build_system_prompt` (rules 1–10 +
  slimmed capability registry; note the ~34k-token registry problem it already solves) and
  `build_user_prompt` (sections: message, current spec, validation errors, conversation —
  observe that `request.message` is _also_ the last entry of `request.conversation` as the
  frontend sends it today, so the prompt repeats it)
- `src/q_backend/strategy_builder/interpret_parser.py` — `parse_ai_interpreter_response`
- `src/q_backend/strategy_builder/interpreter.py` — orchestration (unchanged surface)
- `src/q_backend/storage/settings.py` — the `ai_strategy_*` block (env prefix `Q_`)
- `q_frontend/src/lib/strategies/useAiStrategySession.ts` — what the client actually sends:
  full conversation including the current user turn; assistant turns recorded as
  `result.summary` only (already compact — keep it that way)

## Goal

```python
# build_user_prompt: bounded, non-redundant, refinement-aware
# AiStrategyResponse gains:
change_notes: list[str] = []   # concrete edits made to the draft this turn
```

A 20-turn session produces a prompt no bigger than the configured budget, the model behaves
like a collaborator working on a shared draft, and every turn reports what it changed.

## Tasks

1. Conversation budget in `build_user_prompt`:
   - New settings `ai_strategy_max_conversation_turns: int = 12` and
     `ai_strategy_conversation_char_budget: int = 8000`.
   - Keep the most recent turns that fit both limits (whole turns only, never truncate
     mid-message); when anything is dropped, prepend a single literal line
     `"[earlier turns omitted]"` to the history section. Trimming must be deterministic
     (pure function of the request + settings).
2. Dedupe the current message: define the contract as "`conversation` may include the
   current user turn" and have `build_user_prompt` drop a trailing conversation entry whose
   role is `user` and whose content equals `request.message` (defensive server-side dedupe —
   do not require a frontend change to be correct).
3. Collaborator system prompt: extend `build_system_prompt` rules for the multi-turn case —
   when a `current_spec` draft is provided, treat it as the shared working draft: apply only
   the changes the user asked for, preserve every unrelated field verbatim, and prefer a
   targeted `questions` entry over guessing when the request is ambiguous; when the
   conversation shows the user answering a previous question, incorporate the answer instead
   of re-asking. Keep the JSON-only output contract and rules 1–10 intact.
4. `change_notes`: add `change_notes: list[str] = Field(default_factory=list)` to
   `ParsedAiInterpreterPayload` and `AiStrategyResponse`; the system prompt's output-key list
   gains `change_notes` ("short, concrete edits made to the draft this turn, e.g.
   'tightened stop_loss_points 200 -> 150'; empty when producing a first draft").
   Parser: tolerate its absence (older/looser model output) — missing → `[]`, never a
   parse error.
5. No other wire changes: `ConversationMessage`, request fields, and error shapes are
   untouched, so the existing frontend keeps working before WO192 lands.

## Guardrails

> Backwards compatible by construction: a request with no conversation/current_spec must
> produce byte-identical prompts to today except for the new system-prompt rules — assert
> this shape in tests so single-shot behavior can't regress.
> Trimming never drops `current_spec` or `validation_errors` — the draft is the source of
> truth; history is the expendable part.
> Do not echo the full spec JSON into the conversation history section (the draft already
> has its own prompt section); if an assistant conversation turn contains a JSON blob,
> include it verbatim only within the char budget like any other turn — no special casing.
> Provider code (`providers/*`) is read-only in this WO.

## Tests

Extend `tests/api/test_strategy_builder_interpret.py` and the prompt unit tests (add
`tests/api/test_strategy_builder_prompt.py` if prompt construction lacks a dedicated home):

- budget: conversation exceeding turn/char limits → oldest turns dropped whole, marker line
  present exactly once, newest turns intact; under-budget → no marker, all turns present;
- determinism: same request → identical prompt string;
- dedupe: trailing user turn equal to `message` appears once in the prompt; a _different_
  trailing user turn is preserved;
- `change_notes`: present in system-prompt key list; parser round-trips it; missing key →
  `[]`; response model serializes it;
- regression: empty-conversation request prompt matches the pre-WO shape (message + spec +
  errors sections unchanged);
- `/interpret` endpoint test with a stub provider returning `change_notes` → surfaced in the
  response payload.

## Docs

Docstrings on the new settings (what the budget protects — local-model context windows) and
on the `conversation` contract (current turn may be included; server dedupes). Note
`change_notes` in the interpret endpoint's response-model docstring.

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the final system-prompt rule list (numbered, verbatim), the trimming algorithm in
two sentences, and the new settings with defaults. Production trigger: none — live on API
restart; defaults apply without any `.env` change.

## Out of scope

The chat UI and per-turn diff rendering (WO192); streaming; server-side session storage
(the API stays stateless — the client owns the transcript); provider changes (WO187);
prompt-caching optimizations.
