# WO86 — Frontend: review and isolate Quant background rewrite

## Shared context (read first)

You are working in a two-repo project on Windows. Package managers are fixed:

- **Backend** `C:\Users\guilherme\q\q_backend` — Python, uses `uv`. NEVER use pip/poetry.
- **Frontend** `C:\Users\guilherme\q\q_frontend` — React/TS/Vite, uses `pnpm`. NEVER use npm.
  - Tests: `pnpm test:run` ; typecheck: `pnpm exec tsc -p tsconfig.app.json --noEmit` ; build:
    `pnpm build`

**Context for this work:** While reviewing WO82 follow-up changes, `src/components/background/QuantBackground.tsx`
contained a large unrelated Three.js shader/particle rewrite. It may be intentional polish, but it was
not part of the exit-driven Discovery work and was not accompanied by visual/performance verification.
This WO turns that review note into a small cleanup task: either revert/split the unrelated rewrite, or
keep it with explicit tests and visual evidence.

This WO is frontend-only. It must not touch Discovery exit-search logic unless removing accidental
coupling.

---

## How the pieces work today (read these files)

- `src/components/background/QuantBackground.tsx`
  - branded/clean background images and particle overlay.
- `src/store/useAppStore.ts`
  - background mode settings if referenced by the component.
- `src/hooks/useResolvedBrightness.ts`
  - brightness variant selection.
- Existing frontend test/playwright setup if available.
- The current diff around `QuantBackground.tsx` from the WO82 implementation branch.

---

## Review finding this fixes

The exit-insight frontend work introduced or carried a large `QuantBackground.tsx` rewrite:

- custom vertex/fragment shaders,
- multiple particle layers,
- many new random buffers and animation paths,
- no clear connection to Discovery exit insights,
- no documented visual regression/performance verification.

This is scope risk. It should either be removed from the exit-search branch or validated as a separate
intentional UI change.

## Goal

The exit-driven Discovery branch should not contain unrelated, unverified background-rendering changes.

Acceptable outcomes:

1. Revert `QuantBackground.tsx` to the previous implementation in the exit-search branch; or
2. Keep the rewrite only if it is intentionally desired, isolated in its own commit/PR, and verified
   with build/typecheck plus visual/performance checks.

## Tasks

### 1. Decide whether the rewrite belongs in this branch

Check the branch/task context:

- If no product/design request exists for a background rewrite, revert only the `QuantBackground.tsx`
  changes.
- If the rewrite is intentional, move it out of the exit-search workstream or document that it is a
  separate UI polish change.

Do not revert unrelated user changes outside this file.

### 2. If reverting, keep the change surgical

Restore `src/components/background/QuantBackground.tsx` to the pre-rewrite version using git history or
the current base branch.

Verify:

- app still builds,
- background still renders in branded and clean modes,
- no Discovery exit-insight files are affected.

### 3. If keeping, add verification

If the rewrite remains:

- run typecheck/build;
- capture desktop and mobile screenshots for at least one page that uses `QuantBackground`;
- verify the canvas is nonblank and not obscuring foreground UI;
- check that animation does not create obvious CPU/GPU spikes compared with the previous component.

Add a short note in the final message explaining why the rewrite belongs.

## Guardrails

> **No exit feature changes.** This WO is only about the background rendering scope issue.

> **Do not hide scope creep in a feature branch.** If kept, the background rewrite needs explicit
> justification and evidence.

> **No destructive cleanup.** Do not reset the whole repo or discard unrelated files.

> **Responsive safety.** Text and foreground controls must remain readable over the background on mobile
> and desktop.

## Tests

- Required either way:
  - `pnpm exec tsc -p tsconfig.app.json --noEmit`
  - `pnpm build`
- If keeping the rewrite:
  - visual screenshot checks for desktop and mobile;
  - one test or manual verification note that the canvas renders nonblank.
- If reverting:
  - targeted smoke check that the app page using `QuantBackground` still renders.

## Docs

No README change is required if the rewrite is reverted. If kept as intentional polish, add a short
developer-facing note only if the project already documents background modes.

---

## Definition of done

- `QuantBackground.tsx` is either reverted out of the exit-search workstream or explicitly verified as
  intentional UI work.
- `pnpm exec tsc -p tsconfig.app.json --noEmit` and `pnpm build` pass. **Do not report completion until
  both pass.**
- Final message must paste:
  - whether the rewrite was reverted or kept,
  - verification performed,
  - confirmation that no Discovery exit-search behavior changed.

## Out of scope

- Redesigning the background from scratch.
- Discovery exit-insight or request-control work.
- Backend changes.
