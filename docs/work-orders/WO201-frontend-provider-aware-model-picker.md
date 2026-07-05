# WO201 — Frontend: provider-aware model picker for the AI Strategy Builder

## Shared context (read first)

Second of the **WO200–WO202 group**. Execution sequence: `200 → 201 → 202`, strictly serial —
this WO consumes the wire contract WO200 defines (provider-tagged `/models`, `provider` field
on `/interpret`), and WO202 (page polish) edits the same files as this WO; do not parallelize.

After WO200 the backend serves **all configured providers** (local Ollama + Gemini) in one
tagged model list, and `/interpret` routes per request. The UI still shows a flat list under
a hardcoded — and now wrong — "Local model" label, and never sends `provider`. This WO makes
the picker provider-aware: one grouped select, `{provider, model}` carried through the
session, last choice persisted.

Frontend repo: `q_frontend` — React/TS/Vite, `pnpm` (never npm), vitest + Testing Library +
MSW. Paths relative to `C:\Users\guilherme\q\`.

## How the pieces work today (read these files)

- `src/components/backtests/setup/AiStrategyPanel.tsx` (~line 108–135) — the "Local model"
  label + flat `<select>` (`ai-strategy-model` testid), options from `availableModels`,
  "(not loaded)" suffix for `available === false`, "No local models configured" empty option
- `src/lib/strategies/useAiStrategySession.ts` — `useStrategyBuilderModels()` query
  (~line 92), `availableModels` / `provider` / `modelsLoading` / `modelsError`
  (~lines 117–124), `selectedModel` state + how `submitInterpret` builds the interpret
  payload (find where `model` is attached)
- The API layer for `useStrategyBuilderModels` and the interpret mutation (follow the imports
  from the session hook) — response/request types to extend
- `src/types/strategyBuilder.ts` — wire types (`AiStrategyResponse`, interpret request shape)
- `src/mocks/handlers.ts` — MSW handler for `/api/v1/strategy-builder/models` and
  `/interpret` (WO192 added interpret; extend both for the new fields)
- `docs/work-orders/WO200-backend-multi-provider-model-registry.md` — the contract: `models[]`
  entries gain `provider`; response gains `providers: [{id,label}]`; interpret request gains
  optional `provider`

## Goal

```tsx
<select data-testid="ai-strategy-model">
  <optgroup label="Local (Ollama)">
    <option value="openai_compatible::gemma4-e4b:latest">Gemma 4 E4B</option>
  </optgroup>
  <optgroup label="Gemini">
    <option value="gemini::gemini-2.5-flash">Gemini 2.5 Flash</option>
  </optgroup>
</select>
```

One "Model" picker grouped by provider; the interpret payload carries separate
`provider` + `model` fields; the user's last choice survives reloads.

## Tasks

1. **Types.** Mirror WO200: `AiModelOption` gains `provider: string`; models response gains
   `providers: { id: string; label: string }[]`; interpret request gains
   `provider?: string`. All optional-tolerant: a pre-WO200 backend response (no `provider`
   on options) must not crash — fall back to the response's default `provider` field for
   every option.
2. **Selection state.** `selectedModel` becomes `{ provider: string; model: string }` in
   `useAiStrategySession`. The `<option value>` uses a `provider::model` composite **only as
   DOM value plumbing** (split on first `::`); state and wire stay separate fields — never
   persist or send the composite. Default selection: `default_model` under the default
   `provider` from the response; if the persisted choice (Task 4) no longer exists in the
   list, fall back to the default (no dangling selections).
3. **Grouped picker.** Replace the flat options with one `<optgroup>` per entry in
   `providers` (only providers that actually have models); label changes from "Local model"
   to **"Model"**; drop the "(not loaded)" suffix for non-local providers (WO200 always
   marks remote models available — suffix only ever renders for `openai_compatible`).
   Empty state copy: "No models configured". Keep the `ai-strategy-model` testid and the
   disabled logic (pending/loading/empty) exactly as today.
4. **Persistence.** Store the last `{provider, model}` in the app store alongside the
   existing session persistence (find how `useAppStore` persists other Backtests session
   fields and follow that pattern — no new persistence mechanism).
5. **Wire it.** `submitInterpret` includes `provider` next to `model` in the payload.
   Omit `provider` when the response carried no `providers` list (pre-WO200 backend) so the
   old backend never sees an unknown field it might 422 on — belt-and-braces given FastAPI
   ignores unknown fields, but the session hook shouldn't rely on that.
6. **Hydration.** `hydrateFromMetadata` (saved AI strategies): if saved metadata records the
   model used, restore provider+model when still present in the current list; otherwise
   default silently.

## Guardrails

> **Wire discipline**: `provider` and `model` are separate wire fields (per WO200); the
> `::` composite exists only inside the `<select>` DOM value. No string-parsing of model
> ids anywhere else.
> **Pre-WO200 tolerance**: the panel must render correctly against an old backend response
> (no `provider` per option, no `providers` list) — single implicit group, no crash, no
> `provider` sent.
> **No `@/mocks` imports outside tests; no mock values in initial state** (house CI grep).
> **Testids preserved** (`ai-strategy-model` and all panel workflow testids); no workflow
> gating changes — this WO touches selection only.
> **No visual redesign** — the picker changes structurally (optgroups, label) but adopts no
> new styling beyond existing classes; WO202 owns the page's look.

## Tests

Extend the WO192 suites (`AiChatTranscript.test.tsx` sibling —
`src/components/backtests/setup/__tests__/` and
`src/lib/strategies/__tests__/useAiStrategySession.test.ts`), MSW handlers updated to the
WO200 shape:

- two providers in the response → two optgroups with correct labels and options;
- selecting a Gemini model → interpret payload contains `provider: "gemini"` and the bare
  model id (no `::`);
- default selection = default provider + `default_model`;
- persisted choice restored on remount; stale persisted choice (model gone) falls back to
  default;
- pre-WO200 response fixture (no provider fields) → flat single group renders, payload has
  no `provider` field;
- "(not loaded)" suffix appears only for unavailable local models, never for Gemini entries.

## Docs

Update the AI-builder frontend doc (WO192's `docs/dev/ai-builder-chat.md` or wherever it
landed): the provider+model selection model, the composite-value-is-DOM-only rule, and the
pre-WO200 tolerance behavior.

## Definition of done

`pnpm test` and `pnpm build` pass — do not report completion until both do. Final message
must include: the selection-state type as shipped, one recorded interpret request body from
a test showing separate `provider`/`model` fields, and confirmation the pre-WO200 fixture
test passes. Production trigger: none — the panel is already routed; the grouped picker
appears once the WO200 backend is deployed, and degrades gracefully before that.

## Out of scope

Page layout/visual polish (WO202); backend (WO200); per-conversation provider pinning or
per-turn model display in the transcript; API-key status indicators; model capability
badges (context size, cost).
