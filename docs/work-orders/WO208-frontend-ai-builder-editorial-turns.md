# WO208 — Frontend: editorial assistant turns + conversational affordances

## Shared context (read first)

Second of the **WO207–WO209 group**. Execution sequence: `207 → 208` strictly serial (same
files: `AiChatTranscript`, `AiStrategyPanel`, the hero's starter chips) · WO209 (backend)
parallel.

Two ideas land here. First, the remaining Neural-Expressive structural idea: **editorial
hierarchy in responses** — an assistant turn should read like a well-edited brief (one bold
isolated headline, supporting detail beneath, depth collapsible), not a uniform block of
chat text. Second, the **conversational reframing** diagnosed from the live page: every
current affordance teaches "describe everything in one message" — the placeholder is a
complete end-to-end command, the teaser says "Describe a strategy", the three starter chips
are all _finished_ strategies, and the button used to say "Interpret". The backend already
converses (prompt rules 5/12/13 send questions and absorb answers; the full conversation
ships every turn) — the UI just never invites it.

Frontend repo: `q_frontend` — React/TS/Vite, `pnpm` (never npm), vitest + Testing Library.
Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/components/backtests/setup/AiChatTranscript.tsx` — `TranscriptEntry` rendering:
  assistant turns show `entry.summary` (~line 92), `change_notes` list (~line 95),
  `questions` chips (~line 131); user/notice kinds (~lines 176–179); per-turn revision diff
  chips (WO192)
- `src/components/backtests/setup/AiStrategyPanel.tsx` — composer placeholder (~line 216),
  send-label logic (`hasConversation`), question-chip → composer prefill mechanism (WO192)
- `src/components/backtests/setup/AiBuilderHero.tsx` (WO207) — hosts the starter chips
- `src/lib/strategies/useAiStrategySession.ts` — `TranscriptEntry` type (summary,
  change_notes, questions, confidence, revision index)
- `src/components/ui/` — `Callout`, chip styles, `SectionHeader`; the WO195 materials
- `docs/design/visual-design-system.md` — accent ladder (questions = the turn's accent
  moment, but tier-3 at most)

## Goal

An assistant turn that guides the eye: **headline first** (what changed, bold, isolated),
questions as prominent brass-edged cards right under it (the conversation's forward edge),
then change chips, then collapsible depth — and an empty state whose copy and starters
teach that a rough idea is a valid opening move.

## Tasks

1. **Editorial turn layout** (`AiChatTranscript.tsx`, assistant entries):
   - **Headline**: the turn's first element — `entry.summary` distilled to its first
     sentence, set larger (`--text-base`/550) and isolated with clear space; remaining
     summary sentences follow as quiet body text (`--text-sm`, silver-400). No parsing
     heroics: split on first sentence boundary; if the summary is one sentence, it _is_
     the headline.
   - **Question cards**: promote `entry.questions` from small chips to full-width cards
     directly under the headline — suede body, brass left edge (tier-3), the question text
     readable, click prefills+focuses the composer (keep the exact WO192 mechanism and
     test). One card per question, max 3 visible (rest behind "N more questions").
   - **Change chips + depth**: `change_notes` and the revision-diff chips move below the
     question cards into a single compact row; the expanded diff detail becomes a
     collapsible "Details" section (collapsed by default from the second turn on; first
     turn expanded).
   - **Pending turn**: while `isPending`, the placeholder assistant turn shows a short
     shimmer line where the headline will land — the shimmer is the one sanctioned
     ombré-adjacent motion here (reduced-motion: static dots).
2. **Conversational copy sweep**:
   - Composer placeholder → a partial, natural opener: `"A full spec or a rough idea —
e.g. 'I want to buy pullbacks in an uptrend'"`.
   - Hero sub-line (WO207's quiet line) → "Start with whatever you have — the builder
     will ask for what it needs."
   - Send button: reads **"Send"** from turn zero in the workspace host (kill the
     "Interpret" first-turn label there; Backtests host may keep its current labels).
3. **Starter chips at three completeness levels** (hero, replacing WO202's three
   finished-strategy chips):
   - _Vague_: "I have a rough idea about momentum" → prefills "I want something that
     rides momentum but I'm not sure about entries or exits yet."
   - _Partial_: "Buy pullbacks in an uptrend" → prefills "Buy pullbacks in an uptrend —
     you pick sensible indicators; I want a tight stop."
   - _Complete_: "Full spec: EMA crossover" → prefills the current EMA 20/50 + 3% stop
     example.
     Label each chip with a tiny tier-1 caption ("rough idea" / "half-formed" / "full
     spec") so the page _demonstrates_ that all three are valid entries.
4. **Question-answer continuity**: when the user clicks a question card and sends, the
   resulting user turn renders with a small "answering:" reference line (quote-style, the
   question truncated to one line) — the transcript visibly threads Q→A. Display-only;
   the wire payload is unchanged (WO192's rule stands).

## Guardrails

> **Wire untouched**: `TranscriptEntry` display model may gain presentation fields, but
> the interpret request/conversation payload stays byte-identical (WO191/192 contract).
> **Accent ladder**: question cards are tier-3 (brass edge), never tier-4; the shimmer is
> pending-state only; headlines are weight/size, not color.
> **Perf**: memoized turns stand (WO192 guardrail) — the collapsible details must not
> re-render other turns; keyed list preserved.
> **Both hosts**: the editorial turn layout applies to the shared transcript (both hosts
> benefit); copy changes in Task 2/3 are workspace-host-scoped where noted.
> **No summarization/LLM calls client-side** — the headline is a string split, nothing
> smarter.

## Tests

Extend `AiChatTranscript` + panel suites:

- assistant turn: headline = first sentence isolated; multi-sentence summary → remainder
  as body; single-sentence → headline only;
- questions → cards (not chips), max 3 + overflow control; card click prefills + focuses
  composer (existing assertion updated);
- details collapsed by default on turn ≥ 2, expanded on turn 1; toggling one turn doesn't
  re-render siblings (row-identity assertion per the DataTable test pattern);
- pending turn shows shimmer placeholder; reduced-motion variant static;
- starter chips: three levels render with captions; each prefills its copy;
- answering-reference line renders when a send originated from a question card; wire
  payload recorded in the test contains no new fields.

## Docs

`docs/dev/ai-builder-chat.md`: the editorial turn anatomy (headline/questions/chips/depth)
and the three-level starter convention. Design doc: one paragraph adding "editorial turn"
to the component patterns.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the turn anatomy as shipped (ordered element list), the final copy strings
(placeholder, sub-line, three starters + prefills), and confirmation the interpret payload
is unchanged (paste one recorded request from a test). Production trigger: none — renders
wherever the transcript already renders.

## Out of scope

Hero/composer/choreography (WO207); backend prompt behavior (WO209); markdown rendering in
summaries; streaming tokens; rich media in turns (charts/images — a future "generative UI"
exploration, not this WO); voice.
