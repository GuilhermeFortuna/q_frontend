# Q-050 implementation plan: Execution workspace leaves q_frontend

**Status:** authoritative in the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2)  
**Specification:** [`../specs/Q-050-execution-workspace-leaves-q-frontend-spec.md`](../specs/Q-050-execution-workspace-leaves-q-frontend-spec.md)  
**Depends on:** Q-042, Q-048, Q-049

## Current-system context

The execution surface in `q_frontend/src`:

| Path                                                                                                         | Role                                                                           |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `workspaces/execution/ExecutionWorkspace.tsx` (1 306 lines)                                                  | the workspace at `/execution`                                                  |
| `workspaces/execution/ExecutionLiveWorkspace.tsx`, `ExecutionLiveChartPanel.tsx`, `liveChartMarkers.ts`      | the live monitor window                                                        |
| `workspaces/execution/__tests__/*`                                                                           | workspace, chart panel and marker tests                                        |
| `components/execution/PowerOffSlide.tsx` and its test                                                        | used only by the workspace                                                     |
| `api/queries/execution.ts`, `api/queries/__tests__/executionChart.test.ts`                                   | the polling client                                                             |
| `types/execution.ts`                                                                                         | execution types                                                                |
| `mocks/execution.ts`, and the execution handlers in `mocks/handlers.ts` (19 references)                      | MSW fixtures                                                                   |
| `app/lazyWorkspaces.tsx` (`LazyExecutionWorkspace`, `LazyExecutionLiveWorkspace`)                            | lazy imports                                                                   |
| `app/router.tsx` (`/execution` in routes and `WORKSPACE_PATH_ORDER`), `app/__tests__/executionRoute.test.ts` | routing                                                                        |
| `app/App.tsx`                                                                                                | mounts `LazyExecutionLiveWorkspace` when the window URL carries `deploymentId` |
| `components/dock/AppDock.tsx` (entry `execution`), `components/dock/DockIcons.tsx` (`ExecutionIcon`)         | dock                                                                           |
| `README.md` line 56                                                                                          | the "Execution Workspace" paragraph                                            |

Other files that match "execution" use it in unrelated senses
(`execution_assumptions` in backtests, AI chat transcripts, research
panels). They stay. `docs/design/paper-live-execution.md` and the WO documents
are historical design records, and stay with a header note.
`scripts/bundle-report.mjs` (`pnpm bundle:report`) reports chunk sizes.
`scripts/ci.sh` needs `TZ=America/Sao_Paulo`.

After Q-044, `q_backend`'s `Settings.execution_idempotency_enforced` defaults to
`False`, so that this workspace keeps working. After Q-047 to Q-049,
`q_terminal/docs/ops-parity.md` maps every field of this workspace. The
phase 2 acceptance record, `q_backend/docs/development/baselines/Q-031/phase-2-acceptance.md`,
is the template for the phase 4 record.

## Interfaces produced

```
deleted: src/workspaces/execution/**, src/components/execution/**, src/api/queries/execution.ts,
         src/api/queries/__tests__/executionChart.test.ts, src/types/execution.ts, src/mocks/execution.ts,
         src/app/__tests__/executionRoute.test.ts
changed: src/app/router.tsx            /execution → MovedToTerminalNotice; removed from WORKSPACE_PATH_ORDER
         src/app/App.tsx               deploymentId window → MovedToTerminalNotice
         src/app/lazyWorkspaces.tsx    two lazy entries removed
         src/components/dock/AppDock.tsx, DockIcons.tsx   execution entry and icon removed
         src/mocks/handlers.ts         execution handlers removed
         README.md, docs/design/paper-live-execution.md (header note)
new:     src/app/MovedToTerminalNotice.tsx + test
         docs/development/baselines/Q-050/phase-4-acceptance.md
q_backend (branch Q-050-execution-workspace-leaves-q-frontend):
         storage/settings.py           execution_idempotency_enforced default True
         tests/api/test_execution_idempotency.py   default-refusal test
         deploy/systemd/backend.env.example, README.md
```

## Implementation decisions

- **Gate first, delete second.** Step 2 reads `docs/ops-parity.md` at the
  terminal's `development` head and records its commit. An unticked, unreasoned
  row stops the task as blocked, because deleting before parity is exactly the
  drift §12 warns about.

- **A notice, not a redirect, for stale links.** The frontend cannot open the
  terminal, and must not try: it owns no other process (invariant 8). A small
  static component tells the user where operations moved, on the route and
  on the `deploymentId` window.

- **Delete the frontend's marker rules outright.** Q-049 ported them into the
  terminal as test vectors, so the oracle survives in the terminal's tests.

- **The enforcement flip is a commit in `q_backend`** on a branch of the same
  name. That is the pattern the batch-07 OpenAPI recaptures use in
  `q_contracts`. The flip belongs to the moment the last keyless client
  disappears, which is this task.

- **The acceptance record follows the phase 2 template.** It covers the
  environment; automated validation groups per repository, each with its
  reproducing command; derived figures (stream convergence seeds, frame times,
  benchmark deltas); one pending manual entry per human-verifiable criterion of
  Q-039 to Q-050 in task order; and deferred follow-ups. The known follow-ups
  are: real-money activation with a controlled-account validation record;
  FINDINGS item 3 (live holding-period matching); the invariant-3 residual in
  the research client; research-job idempotency; the `q_core` pin and contracts
  drift between repositories in `COMPAT.md`; and a streamed indicator topic.
  Each has the measurement or event that would justify it.

## Ordered implementation

- [ ] 1. Work on the branch `Q-050-execution-workspace-leaves-q-frontend` in
     `q_frontend`, created from `development` by `./work start`. Confirm Q-042,
     Q-048 and Q-049 are merged.
- [ ] 2. Parity gate: read `q_terminal/docs/ops-parity.md` at `development`. If any
     row is neither ticked nor reasoned, set the task blocked with the list and
     stop. Otherwise record the commit for the acceptance record. Commit nothing.
- [ ] 3. Run `pnpm bundle:report` and keep the output. Commit nothing.
- [ ] 4. Write `MovedToTerminalNotice.tsx` with tests for `/execution` and for the
     `deploymentId` window. Route both to it. Commit.
- [ ] 5. Delete the modules in the table above, and remove the router, lazy,
     dock and mock entries. Fix every import that breaks, without touching
     unrelated "execution" code. Confirm `pnpm typecheck`, `pnpm lint` and
     `pnpm test:run` pass. Commit.
- [ ] 6. Add the hygiene test: no `src/` file imports `@/api/queries/execution`,
     `@/types/execution`, `@/workspaces/execution` or `@/components/execution`.
     Commit.
- [ ] 7. Update `README.md` and add the header note to
     `docs/design/paper-live-execution.md`. Commit.
- [ ] 8. Run `pnpm bundle:report` again and put both reports in the handoff.
- [ ] 9. In `q_backend`, on the branch `Q-050-execution-workspace-leaves-q-frontend`:
     default enforcement on, add the default-refusal test, and update the env
     example and `README.md`. Run `scripts/ci.sh`. Commit in `q_backend`.
- [ ] 10. Write `docs/development/baselines/Q-050/phase-4-acceptance.md` per the
      decision above, naming the commit of each repository. Commit.
- [ ] 11. Run `TZ=America/Sao_Paulo scripts/ci.sh`. Fix, re-run, commit.
- [ ] 12. **Human:** human-verifiable criteria 1 and 2.
- [ ] 13. **Human:** human-verifiable criterion 3. Fill the acceptance record and
      mark phase 4 accepted.

## Validation

- **Unit:** the notice on both entry points.
- **Hygiene:** no imports of removed modules; no `/execution` in the workspace
  order.
- **Regression:** the full frontend suite, typecheck, lint, build and the
  Tauri shell stage; the backend suite with enforcement on.
- **Measurement:** bundle report before and after.
- **Manual:** research UI walk-through; a full paper session from the terminal
  alone; the acceptance record completed.

```bash
cd /home/gui/projects/q/q_frontend
TZ=America/Sao_Paulo scripts/ci.sh
pnpm bundle:report
grep -rn "queries/execution\|types/execution\|workspaces/execution\|components/execution" src || echo "execution surface removed"
cd ../q_backend && scripts/ci.sh
```

## Handoff

Give the parity document's commit and its reasoned rows. List every deleted
file. Give both bundle reports and the difference. Report the backend commit
that flips enforcement, and its test. Give the acceptance record's path and
commits, and list its pending manual entries. From the human steps, report the
research UI walk-through, the terminal-only paper session, and the phase 4
acceptance status.
