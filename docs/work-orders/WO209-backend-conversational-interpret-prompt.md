# WO209 — Backend: conversational interpret prompt (draft what's known, ask what matters)

## Shared context (read first)

Third of the **WO207–WO209 group**; **runs in parallel** with WO207/208 (different repo, no
shared contract — the wire shape is untouched).

The interpret system prompt already contains the conversational rules (5: ask targeted
questions when ambiguous; 12: prefer a question over guessing; 13: incorporate answers
instead of re-asking). But its persona line — _"Convert user requests into a structured
trading strategy specification"_ — frames the model as a one-shot converter, which biases
it toward emitting a complete spec from whatever it receives, guessing where it should ask.
With WO207/208 redesigning the UI around back-and-forth, the model should meet it halfway:
**for partial or high-level requests, draft what was actually specified and return the
few highest-value questions** — incompleteness is a normal turn, not a failure.

Backend repo: `q_backend`, `uv` (`uv run pytest` — never pip/poetry). Paths relative to
`C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `q_backend/src/q_backend/strategy_builder/interpret_prompt.py` — the system prompt:
  persona line + numbered rules (~lines 63–78), slimmed capability registry, output-schema
  contract (strategy_spec / assumptions / unsupported_requests / questions / summary /
  change_notes / confidence)
- `q_backend/src/q_backend/strategy_builder/interpreter.py` — provider call + parsing
  (`parsed.questions` ~line 84)
- `q_backend/src/q_backend/strategy_builder/interpret_parser.py` — tolerant JSON parsing
- WO191's conversation handling (trimming, `change_notes`) — read its tests for the golden
  patterns to extend
- Existing interpreter tests (locate: `tests/` strategy_builder interpret suites, incl. any
  golden/fixture-based prompts from the WO177–182 hardening batch)

## Goal

```text
(persona) You are Q's strategy builder assistant — a collaborator who turns trading ideas
into structured strategy specifications through conversation. Users may arrive with a
complete spec or a rough thought; both are valid openings.
(new rule) When the request is partial or high-level: populate strategy_spec with what the
user actually specified plus clearly-flagged standard assumptions, and return at most 3
questions, ordered by how much the answer would change the strategy. Never pad questions
with trivia; never guess at the user's core intent (direction, market, style) — ask.
```

Same wire schema, same JSON contract — only the behavioral framing changes.

## Tasks

1. **Persona + rule amendment** in `interpret_prompt.py` per the Goal text (tune wording in
   place; keep it terse — this prompt already fights context limits on local models, so the
   amendment budget is ~80 words total, measured).
2. **Question quality guidance**: fold into the new rule — questions must be (a) answerable
   in a short phrase, (b) ordered by impact, (c) capped at 3 (the UI shows 3; WO208). Rule
   12's "prefer a question over guessing" gets scoped: guess-and-flag for _standard
   parameters_ (per rule 6 assumptions), ask for _core intent_.
3. **Token budget check**: assert (test, not eyeball) that the rendered system prompt's
   length stays within the current budget — measure the pre-change rendered prompt with the
   standard registry fixture, allow ≤ +500 characters.
4. **Golden two-turn test** (extend the interpreter suite with a mocked provider):
   - Turn 1: vague opener ("I want something that rides momentum") → response fixture
     asserts the _contract shape_ the prompt demands: `strategy_spec` non-null with flagged
     assumptions, 1–3 questions present. (The mock returns the fixture; the test's real
     value is locking the parsing path + documenting expected behavior.)
   - Turn 2: conversation containing the answered question → fixture with the answer
     incorporated, no repeated question.
   - Add one **live-optional** marker test (skipped unless an env flag + configured
     provider) that sends the vague opener through a real provider and asserts only:
     valid JSON contract, ≥1 question. This is the smoke that catches prompt regressions
     against reality, runnable manually.
5. **Prompt-change note**: append a dated entry to whatever prompt-versioning note exists
   (or start `strategy_builder/PROMPT_CHANGES.md`): what changed, why, the token delta.

## Guardrails

> **Wire schema frozen**: no new response keys, no changed semantics of existing keys —
> WO207/208 ship against today's contract.
> **Token discipline**: ≤ +500 chars on the rendered prompt (local Gemma models are the
> constraint, not Gemini).
> **No behavior forks per provider** — one prompt for all providers (the registry already
> slims itself; provider-specific prompts are a rejected direction).
> **Determinism in tests**: mocked-provider goldens are the CI gate; the live smoke is
> opt-in only and must skip cleanly without config.

## Tests

Per Task 3/4: prompt-length budget test; two-turn golden pair; live-optional smoke;
existing interpret suites green (the prompt change must not break the WO191 trimming or
parser tolerance tests).

## Docs

`PROMPT_CHANGES.md` entry (Task 5); one line in the AI-builder backend doc noting the
collaborator framing and the 3-question cap (cross-reference WO208's UI cap).

## Definition of done

`uv run pytest` passes — do not report completion until it does. Final message must
include: the persona/rule diff as shipped, the measured prompt-length delta, and the
golden fixtures' question lists. Production trigger: none — the prompt is read on every
interpret call.

## Out of scope

Frontend (WO207/208); response schema changes; streaming; provider-specific prompting;
model temperature/params tuning; multi-agent orchestration.
