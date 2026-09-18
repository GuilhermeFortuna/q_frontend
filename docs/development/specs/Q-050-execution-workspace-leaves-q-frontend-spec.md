# Q-050: Execution workspace leaves q_frontend

**Status:** authoritative in the [Q project board](https://github.com/users/GuilhermeFortuna/projects/2)  
**Project direction:** [`q_contracts/docs/system-architecture.md` §5.1, §9 invariant 9, §10 Phase 4, §12](https://github.com/GuilhermeFortuna/q_contracts/blob/f2273a88e52c5b9a8ad5ac9d7eb27f8069cf643d/docs/system-architecture.md#51-ui-ownership-boundary)  
**Depends on:** Q-042, Q-048, Q-049  
**Implementation plan:** [`../plans/Q-050-execution-workspace-leaves-q-frontend-plan.md`](../plans/Q-050-execution-workspace-leaves-q-frontend-plan.md)

## Purpose

§5.1 says the frontend's execution workspace is removed the moment the terminal
has a working one, and §12 names two UIs drifting apart as a risk, to be
mitigated by removing duplicated surfaces when the replacement arrives. After
Q-048 and Q-049 the terminal shows and commands everything the frontend
workspace does, checked field by field in the terminal's parity document. This
task removes the workspace, its live monitor window, its client, types, mocks
and tests from `q_frontend`, so that live trading has exactly one UI. It then
closes phase 4: the last client that sent keyless commands is gone, so the
backend starts requiring idempotency keys, and the phase's measured results are
gathered into one acceptance record.

## Requirements

### Removal

- The execution workspace, the execution live monitor window, their route
  entries, the dock entry, the execution query client, execution types, mocks,
  MSW handlers, components used only by them, and their tests are removed.
- Nothing else in the research UI changes behaviour. Code that only shares the
  word "execution" (for example backtest execution assumptions) stays.
- A user who opens a stale `/execution` link lands on a short notice that live
  trading and operations are in `q_terminal`, with no other content.
- The README and the UI docs describe the research UI without an execution
  workspace, and say where operations live.
- The bundle shrinks, and the size difference is reported.

### Gate

- The removal happens only if every row of the terminal's parity document is
  ticked, or carries a stated reason that the operator accepted. The task
  confirms this before deleting anything.

### Phase 4 close

- The backend requires idempotency keys on execution commands by default, now
  that no keyless client remains.
- A phase 4 acceptance record, written against named commits, gathers the
  automated results and the human-verified results of Q-039 to Q-050. It states
  what phase 4 delivered against architecture §10, and lists deferred
  follow-ups, each with the measurement or event that would justify it.

## Constraints and non-goals

- **No change to any research surface.** Backtests, optimization, discovery,
  walk-forward, research, the strategy builder, storage and system settings
  are untouched.
- **No change to backend routes.** The paged execution routes stay, because the
  terminal uses them for older rows and the chart route for overlays.
- **The research UI keeps no live market stream** beyond what research
  surfaces already use (§5.1).
- **No real-money activation.**

## Acceptance criteria

### Agent-verifiable

1. Before any deletion, the terminal's `docs/ops-parity.md` at its pinned commit
   has every row ticked or reasoned. The task records that commit.
2. No file under `src/` imports from the removed modules, and a search for the
   execution workspace, the execution query client and the execution types
   finds nothing.
3. `/execution` and the former monitor route render the notice. A test covers
   both.
4. The dock and router tests pass without an execution entry, and the workspace
   order no longer contains `/execution`.
5. The production bundle report shows the size before and after.
6. In `q_backend`, the shipped idempotency enforcement default is on. The API
   tests pass with it, and a test proves a keyless execution command is refused
   by default.
7. The phase 4 acceptance record exists, names its commits, and has an entry for
   every human-verifiable criterion of Q-039 to Q-050, each with its command and
   the figure it is compared against.
8. `TZ=America/Sao_Paulo scripts/ci.sh` passes, as does the backend's
   `scripts/ci.sh` on its branch.

### Human-verifiable

1. The research UI starts, every remaining workspace opens and works, and
   `/execution` shows the notice.
   Command: `pnpm tauri dev`
2. A full paper session runs from the terminal alone: deploy, start, entry,
   exit, flatten and stop. At no point is the frontend needed.
   Command: `cd ../q_terminal && make run`
3. The phase 4 acceptance record's pending entries are filled from the recorded
   human results of Q-039 to Q-050, and phase 4 is marked accepted.
   Command: `$EDITOR docs/development/baselines/Q-050/phase-4-acceptance.md`
